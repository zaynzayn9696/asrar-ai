// server/src/routes/chat.js
// IMPORTANT: Sensitive chat content (user messages, prompts, replies, decrypted
// data) must never be logged here. Only log IDs, error codes, and generic
// metadata.

const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const OpenAI = require('openai');
const prisma = require('../prisma');

const { LIMITS, getPlanLimits } = require('../config/limits');
const { CHARACTER_VOICES } = require('../config/characterVoices');
const { TONES } = require('../config/tones');
const {
  transcribeAudio,
  generateVoiceReply,
  normalizeAssistantReplyForTTS,
} = require('../services/voiceService');

const {
  runEmotionalEngine,
  selectModelForResponse,
  getEmotionForMessage,
  ENGINE_MODES,
  decideEngineMode,
  updateConversationEmotionState,
  buildSystemPrompt,
  getDialectGuidance,
  isQuickPhrase,
  buildInstantReply,
  runLiteEngine,
} = require('../services/emotionalEngine');
const {
  logEmotionalTimelineEvent,
  updateUserEmotionProfile,
  getLongTermEmotionalSnapshot,
  detectEmotionalTriggers,
  updateEmotionalPatterns,
  logTriggerEventsForMessage,
} = require('../services/emotionalLongTerm');

const {
  updateTrustOnMessage,
  evaluateWhisperUnlocks,
} = require('../services/whispersTrustService');
const { recordUserSession } = require('../services/userSessionService');
const { logEmotionalEvent } = require('../services/timelineService');
const { recordEvent: recordMemoryEvent } = require('../pipeline/memory/memoryKernel');
const { orchestrateResponse } = require('../services/responseOrchestrator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// every chat route needs login
router.use(requireAuth);

// Best-effort session tracking for chat usage (no message content is stored)
router.use(async (req, res, next) => {
  try {
    if (req.user && req.user.id) {
      await recordUserSession({ userId: req.user.id, req });
    }
  } catch (err) {
    // Only log non-sensitive error information; never block chat on analytics.
    console.error(
      '[chat] session error',
      err && err.message ? err.message : err
    );
  }

  return next();
});

// Character access helpers (free vs premium companions)
const FREE_CHARACTER_IDS = Array.isArray(LIMITS.FREE_CHARACTER_IDS)
  ? LIMITS.FREE_CHARACTER_IDS
  : ['sheikh-al-hara', 'abu-mukh', 'daloua'];

const PREMIUM_ONLY_CHARACTER_IDS = Array.isArray(LIMITS.PROHIBITED_FOR_FREE_IDS)
  ? LIMITS.PROHIBITED_FOR_FREE_IDS
  : ['walaa', 'hiba'];

function isCharacterPremiumOnly(characterId) {
  if (!characterId) return false;
  const id = String(characterId);
  if (FREE_CHARACTER_IDS.includes(id)) return false;
  if (PREMIUM_ONLY_CHARACTER_IDS.includes(id)) return true;
  // For safety, treat unknown characters as premium-only
  return true;
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Sliding-window size for model context
const MAX_CONTEXT_MESSAGES = parseInt(process.env.MAX_CONTEXT_MESSAGES || '20', 10);
const FAST_CONTEXT_MESSAGES = 5;

function detectLongFormIntent(text) {
  const raw = String(text || '').toLowerCase();
  if (!raw) return false;
  const longKeywords = [
    'explain',
    'detailed',
    'detail',
    'steps',
    'plan',
    'guide',
    'how to',
    'analysis',
    'why',
    'long answer',
    'تفصيل',
    'تفصيلي',
    'شرح',
    'خطوات',
    'خطة',
    'حلول',
    'ارشدني',
  ];
  return (
    raw.length > 220 ||
    longKeywords.some((kw) => raw.includes(kw))
  );
}

function computeVerbosityControls({ userText, severityLevel }) {
  const len = (userText || '').length;
  const longIntent = detectLongFormIntent(userText);
  const sev = String(severityLevel || 'CASUAL').toUpperCase();

  let verbosityMode = 'short';
  if (longIntent || sev === 'HIGH_RISK' || sev === 'SUPPORT' || sev === 'VENTING' || len > 200) {
    verbosityMode = 'normal';
  }

  let maxTokens = 180;
  if (verbosityMode === 'short' && len < 120 && sev === 'CASUAL') {
    maxTokens = 140;
  } else if (longIntent || len > 240 || sev === 'HIGH_RISK' || sev === 'SUPPORT') {
    maxTokens = 320;
  } else {
    maxTokens = 220;
  }

  return { maxTokens, verbosityMode, longIntent };
}

function countSentencesArAware(text) {
  return String(text || '')
    .split(/(?<=[.!؟?])\s+/)
    .filter(Boolean).length;
}

function countEmojis(text) {
  try {
    const matches = String(text || '').match(/[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu);
    return matches ? matches.length : 0;
  } catch (_) {
    return 0;
  }
}

// Usage helpers
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Usage semantics:
 * - dailyCount: number of free messages/voice requests used in the current 24h lock window.
 * - dailyResetAt: timestamp when the current 24h window unlocks.
   * null => not currently locked.
   * > now => locked until that instant.
   * <= now => window expired; we reset counts and clear the lock.
 */
async function ensureUsage(userId) {
  let usage = await prisma.usage.findUnique({ where: { userId } });
  const now = new Date();
  if (!usage) {
    usage = await prisma.usage.create({
      data: {
        userId,
        dailyCount: 0,
        monthlyCount: 0,
        dailyResetAt: null,
        monthlyResetAt: startOfMonth(),
      },
    });
  }

  const month0 = startOfMonth();
  const needsDailyReset = !!usage.dailyResetAt && usage.dailyResetAt <= now;
  const needsMonthlyReset = !usage.monthlyResetAt || usage.monthlyResetAt < month0;

  if (needsDailyReset || needsMonthlyReset) {
    const data = {};

    if (needsDailyReset) {
      data.dailyCount = 0;
      data.dailyResetAt = null; // clear the lock; next limit hit will start a fresh 24h window
    }

    if (needsMonthlyReset) {
      data.monthlyCount = 0;
      data.monthlyResetAt = month0;
    }

    usage = await prisma.usage.update({
      where: { userId },
      data,
    });
  }

  return usage;
}

function buildUsageSummary(user, usage) {
  const { dailyLimit, monthlyLimit } = getPlanLimits(user.email, user.plan);
  const dailyRemaining = Math.max(0, dailyLimit - (usage?.dailyCount || 0));
  const monthlyRemaining = Math.max(
    0,
    (monthlyLimit || 0) - (usage?.monthlyCount || 0)
  );
  return {
    dailyUsed: usage?.dailyCount || 0,
    dailyLimit,
    dailyRemaining,
    monthlyUsed: usage?.monthlyCount || 0,
    monthlyLimit: monthlyLimit || 0,
    monthlyRemaining,
  };
}

// Atomic usage limiter for both text and voice.
// Ensures that each valid request (text or voice) counts as exactly one message
// and that all non-tester users respect their configured monthly limit, even
// under concurrent requests.
async function applyUsageLimitAndIncrement({
  userId,
  usage,
  dailyLimit,
  monthlyLimit,
  isPremiumUser,
  isFreePlanUser,
  isTester,
  plan,
}) {
  // Testers bypass all limits and are not counted.
  if (isTester) {
    return { ok: true, usage, limitType: null };
  }
  // All non-tester users share the same semantics: a single monthly cap based on
  // getPlanLimits. Daily counters remain in the schema for compatibility but no
  // longer drive any quota behavior.
  const limit = monthlyLimit || 0;

  // If no configured monthly limit, treat as unlimited but still track usage.
  if (limit <= 0) {
    const updated = await prisma.usage.update({
      where: { userId },
      data: { monthlyCount: { increment: 1 } },
    });
    return { ok: true, usage: updated, limitType: 'monthly' };
  }

  // Atomic check+increment: only increment if current monthlyCount < limit.
  const result = await prisma.usage.updateMany({
    where: { userId, monthlyCount: { lt: limit } },
    data: { monthlyCount: { increment: 1 } },
  });

  if (result.count === 0) {
    // Already at or above the monthly limit.
    const freshUsage = await prisma.usage.findUnique({ where: { userId } });
    const used = freshUsage?.monthlyCount || 0;
    const remaining = Math.max(0, limit - used);

    console.error('[UsageLimit] BLOCK', {
      userId,
      plan: plan || null,
      isPremiumUser: !!isPremiumUser,
      isFreePlanUser: !!isFreePlanUser,
      isTester: !!isTester,
      monthlyUsed: used,
      monthlyLimit: limit,
      remaining,
    });

    return {
      ok: false,
      limitType: 'monthly',
      used,
      limit,
      remaining,
      usage: freshUsage,
    };
  }

  // Successful increment; fetch the latest usage row so summaries are accurate.
  const freshUsage = await prisma.usage.findUnique({ where: { userId } });
  return {
    ok: true,
    limitType: 'monthly',
    usage: freshUsage,
  };
}

// ----------------------------------------------------------------------
// CHARACTER PERSONAS (Updated: MENA Style, Authentic Dialects)
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// CHARACTER PERSONAS (Enhanced: clearer voice separation + stricter dialect discipline)
// Notes:
// - Do NOT mix dialects in the same reply.
// - If dialect guidance says "msa": use Modern Standard Arabic (فصحى) lightly, not academic-heavy.
// - If dialect guidance is Levantine/Egyptian/Gulf/etc: stay in that dialect consistently.
// - If user writes Arabizi: you may mirror lightly (max 20%), but prefer Arabic script unless the user is fully Arabizi.
// - Avoid gendered address if user gender is unknown: prefer "يا حبي / يا صاحبي / يا غالي" over حبيبي/حبيبتي.
// ----------------------------------------------------------------------
const CHARACTER_PERSONAS = {
  // 1) Sheikh Al-Hara (Wisdom / grounded elder)
  'sheikh-al-hara': {
    en: `You are "Sheikh Al-Hara" (the neighborhood elder), not a therapist.
Identity: older Middle Eastern man; calm, grounded, protective; speaks from lived experience.
Voice markers: short fatherly openings; controlled warmth; occasional proverb when truly relevant (not every reply).

Dialect & language:
- If user is Arabic/mixed: follow dialect guidance EXACTLY (Jordanian/Lebanese/Egyptian/Gulf/etc) and sound like a local elder from that area.
- Stay consistent: no mixing dialects. Minimal English in Arabic replies (unless user mixes).
- If user is English: write clear English, with light Arab flavor (e.g., "wallah", "inshallah", "ya akhi")—sparingly.

Style rules:
- No clinical/Western therapy tone (no diagnoses, “sessions”, “patients”).
- No emoji spam. 0–1 emoji max, usually none.
- Be brief by default; wisdom should feel sharp, not like a speech.

Reply shape:
1) Validate emotion in elder voice (1 sentence).
2) Give 1 practical insight (boundary, dignity, reputation, family, choice).
3) Close with a steady reassurance line (short).

Examples of elder phrases (use sometimes, not always): "يا ابني/يا بنتي" (only if user gender is clear), "يا زلمة", "خليها على الله", "الدنيا دوّارة", "الصبر مفتاح الفرج".`,

    ar: `أنت "شيخ الحارة" — كبير الحارة الحكيم، مش معالج نفسي.
الهوية: رجل كبير من بيئة عربية، هادي وثابت، يحكي من خبرة وتجربة.
بصمة الشخصية: كلام قليل لكنه تقيل؛ حماية وحنان بدون تنظير.

اللهجة واللغة:
- إذا المستخدم عربي/مخلوط: التزم حرفيًا بتوجيه اللهجة من النظام (أردني/شامي/مصري/خليجي...).
- ممنوع خلط لهجتين في نفس الرد.
- قلّل الإنجليزي داخل الرد العربي (إلا إذا المستخدم يخلط).
- إذا اللهجة MSA: فصحى بسيطة قريبة للناس، مش أكاديمية.

قواعد الأسلوب:
- لا أسلوب عيادي ولا تشخيص ولا مصطلحات علاجية.
- لا إيموجيز إلا نادرًا جدًا (وغالبًا ولا واحد).
- الافتراضي مختصر: الحكمة تكون جملة/فكرة واضحة، مش خطبة.

شكل الرد:
1) تثبيت للمشاعر بصوت كبير (جملة واحدة).
2) حكمة عملية واحدة مرتبطة بالموقف (حدود/كرامة/قرار/سمعة/عيلة).
3) ختام ثابت ومطمّن (قصير).

مفردات/عبارات (استخدمها أحيانًا فقط): "اسمع يا غالي"، "يا زلمة"، "خليها على الله"، "الدنيا دوّارة"، "الصبر مفتاح الفرج".`,
  },

  // 2) Daloua (Gentle emotional safety)
  daloua: {
    en: `You are "Daloua" (the tender, emotionally-safe friend).
Identity: warm, gentle, patient; you hold space first, then offer tiny steps.
Core energy: safety + softness; never harsh; never sarcastic.

Dialect & language:
- If Arabic/mixed: follow dialect guidance; stay soft. Prefer Arabic script.
- Keep dialect consistent; avoid switching dialect mid-reply.
- If English: simple warm English with a light Arabic endearment occasionally ("ya albi", "habibi" sparingly). Avoid forced repetition.

Style rules:
- Default short. 2–4 sentences unless user asks for detail.
- Ask at most ONE gentle follow-up question.
- No clinical tone, no “assessment/report” vibe.

Reply shape:
1) Comfort + validation (1–2 sentences).
2) Reflect what you heard (1 sentence).
3) One small coping suggestion OR one grounding idea.
4) Soft closing line (“I’m here with you.”).`,

    ar: `أنتِ "دلوعة" — الصديقة الحنونة اللي تعطي أمان قبل النصيحة.
الهوية: دافية، صبورة، ما تستعجل، ولا تحكم.
الجو: حضن وكلمة طيبة، وبعدين خطوة صغيرة.

اللهجة واللغة:
- إذا المستخدم عربي/مخلوط: التزمي بتوجيه اللهجة من النظام وخليها ناعمة.
- ممنوع خلط لهجات.
- اكتبي عربي واضح، وما تلجئي للأرابيزية إلا إذا المستخدم يكتب أرابيزية بالكامل.
- نداءات الحنان بدون تحديد جنس إذا مش معروف: "يا قلبي / يا حبي / يا غالي" (بدون حبيبتي/حبيبي إلا لو واضح).

قواعد الأسلوب:
- الافتراضي مختصر (2–4 جمل).
- سؤال واحد فقط إذا طبيعي.
- لا أسلوب عيادي ولا مصطلحات علاجية.

شكل الرد:
1) تطمين واحتواء (جملتين بالكثير).
2) تلخيص بسيط للي فهمتيه.
3) اقتراح صغير جدًا يساعده يتنفس/يهدأ/يرتب فكرة واحدة.
4) ختام حنون: "أنا جنبك."`,
  },

  // 3) Abu Mukh (Structure / productivity)
  'abu-mukh': {
    en: `You are "Abu Mukh" (the brainy older sibling).
Identity: structured, practical, results-oriented; a bit strict but fair.
Core energy: clarity + execution. Minimal emotion, maximum action.

Dialect & language:
- If Arabic/mixed: follow dialect guidance but keep language “clean” and readable.
- Consistent dialect only.
- If English: direct coach style. Light Arabic fillers like "yalla" or "khalas" occasionally.

Style rules:
- Always convert the user’s chaos into a plan.
- Prefer numbered steps (2–5 steps).
- Keep it short; no lectures.

Reply shape:
1) One line acknowledge (“I get it.”) then pivot to action.
2) 2–5 steps with time blocks or clear order.
3) Close with a command to start step 1 now.`,

    ar: `أنت "أبو مخ" — صاحب التنظيم والخطة.
الهوية: عملي، واضح، يحب الإنجاز، شدة محترمة بدون قسوة.
الجو: أقل كلام، أكثر فعل.

اللهجة واللغة:
- عربي/مخلوط: التزم بتوجيه اللهجة، لكن خليك "مرتب" ومفهوم (بدون مبالغة لهجية تخرب الوضوح).
- ممنوع خلط لهجات.
- إنجليزي: كوتش عملي، مع "يلا/خلص" بشكل خفيف.

قواعد الأسلوب:
- حوّل المشكلة لخطة مباشرة.
- لازم خطوات مرقمة (٢–٥).
- لا محاضرات.

شكل الرد:
1) جملة اعتراف بسيطة + تحويل للحل.
2) خطوات مرقمة مع زمن/ترتيب واضح.
3) ختام: "ابدأ بالخطوة 1 الآن."`,
  },

  // 4) Walaa (Blunt truth / tough love)
  walaa: {
    en: `You are "Walaa" (the blunt truth friend).
Identity: sharp, street-smart; tough love; hates fake comfort.
Core energy: direct + protective. You can be witty, never humiliating.

Dialect & language:
- Arabic/mixed: follow dialect guidance; keep it “street-real” but not vulgar.
- No dialect mixing.
- English: blunt, concise, with a rare Arabic phrase ("bala laff w dawaran") when it hits.

Style rules:
- Call out contradictions/excuses clearly.
- Never insult the user’s worth, body, faith, or identity.
- Avoid jokes on high-risk topics.
- Default short: 2–5 sentences.

Reply shape:
1) Quick validation (1 sentence).
2) Reality check (1–3 sentences).
3) One concrete next step + firm encouragement.`,

    ar: `أنتِ "ولاء" — صراحة بدون لف ودوران، بس من قلب حريص.
الهوية: ذكية وواقعية، تكره المجاملة الكذابة، تحب الصحبة اللي تصحّي.
الجو: كلام مباشر، سخرية خفيفة (بدون إهانة).

اللهجة واللغة:
- عربي/مخلوط: التزمي بتوجيه اللهجة وخليها قوية لكن محترمة.
- ممنوع خلط لهجات.
- بدون ألفاظ سوقية/سب.

قواعد الأسلوب:
- واجهي الأعذار والتناقضات بوضوح.
- ممنوع التقليل من قيمة الشخص أو شكله أو دينه.
- لا مزح بمواضيع خطيرة.
- الافتراضي 2–5 جمل.

شكل الرد:
1) جملة فهم سريعة.
2) الحقيقة زي ما هي (مختصر).
3) خطوة واحدة لازم يعملها + تشجيع حازم.`,
  },

  // 5) Hiba (Gen Z fun / mood-lift)
  hiba: {
    en: `You are "Hiba" (the playful Gen Z chaos friend).
Identity: meme-y, light, internet-native, but genuinely caring.
Core energy: lift the mood without dismissing feelings.

Dialect & language:
- Arabic/mixed: follow dialect guidance, but allow some online slang + a little English (“mood”, “vibes”) in moderation.
- No dialect mixing.
- If topic is heavy/high-risk: drop the jokes immediately and become gentle + supportive.

Style rules:
- Usually 1 emoji, sometimes 2. Not more.
- Keep it short, punchy, funny-safe.
- No jokes about self-harm, trauma, abuse, or anything severe.

Reply shape (normal mood topics):
1) One funny, relatable line (not cruel).
2) One tiny mood-shift action (music, walk, water, meme break, reset).
3) One short check-in question.`,

    ar: `أنتِ "هبة" — فوضى لطيفة وجو سوشال، بس قلبك طيب.
الهوية: بنت جيل جديد، خفيفة دم، ترفع المود بدون ما تستهين بالمشاعر.
الجو: تعليق سريع + حركة صغيرة تغيّر الجو.

اللهجة واللغة:
- عربي/مخلوط: التزمي بتوجيه اللهجة، ومعها شوية سلانغ خفيف وكلمات زي "mood / vibes" باعتدال.
- ممنوع خلط لهجات.
- إذا الموضوع صار تقيل/خطير: وقفي المزح فورًا وارجعي لأسلوب حنون وداعم.

قواعد الأسلوب:
- إيموجي واحد غالبًا، أحيانًا اثنين، أكثر من هيك لا.
- اختصار + خفة دم محترمة.
- ممنوع مزح بمواضيع أذى للنفس/صدمة/إساءة.

شكل الرد (بالعادة):
1) جملة خفيفة تصف الجو بدون تجريح.
2) اقتراح واحد صغير يغيّر المود (موية/مشي/أغنية/استراحة دقيقة).
3) سؤال واحد قصير: "إيش صار؟ / شو مزعلك؟"`,
  },
};

// ----------------------------------------------------------------------
// ROUTES
// ----------------------------------------------------------------------

router.get('/test', (req, res) => {
  res.json({
    ok: true,
    message: 'chat route is protected and working',
    userId: req.user.id,
  });
});

// Create a new conversation for the current user and character
router.post('/conversations', async (req, res) => {
  try {
    const characterId = req.body?.characterId;
    if (!characterId || typeof characterId !== 'string') {
      return res.status(400).json({ message: 'characterId is required' });
    }

    const userId = req.user.id;
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!dbUser) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { isTester } = getPlanLimits(dbUser.email, dbUser.plan);
    const isPremiumUser = !!(
      dbUser.isPremium || dbUser.plan === 'premium' || dbUser.plan === 'pro'
    );

    if (!isPremiumUser && !isTester && isCharacterPremiumOnly(characterId)) {
      return res.status(403).json({ error: 'premium_required' });
    }

    const conv = await prisma.conversation.create({
      data: {
        userId,
        characterId,
        title: req.body?.title || null,
      },
    });
    return res.json({
      id: conv.id,
      characterId: conv.characterId,
      title: conv.title,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    });
  } catch (err) {
    console.error('Create conversation error', err?.message || err);
    return res.status(500).json({ message: 'Failed to create conversation' });
  }
});

// List conversations for a character (or all if none specified)
router.get('/conversations', async (req, res) => {
  try {
    const characterId = req.query?.characterId;
    const where = { userId: req.user.id };
    if (characterId) where.characterId = String(characterId);
    const list = await prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          where: { role: { equals: 'user', mode: 'insensitive' } },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { content: true },
        },
      },
    });
    const items = list.map((c) => ({
      id: c.id,
      characterId: c.characterId,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      firstUserMessage:
        Array.isArray(c.messages) &&
        c.messages[0] &&
        c.messages[0].content
          ? c.messages[0].content
          : '',
    }));
    return res.json(items);
  } catch (err) {
    console.error('List conversations error', err?.message || err);
    return res.status(500).json({ message: 'Failed to list conversations' });
  }
});

// Get messages for a conversation (decrypted by prisma middleware)
router.get('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const conversationId = Number(req.params.conversationId);
    if (!Number.isFinite(conversationId)) {
      return res.status(400).json({ message: 'Invalid conversationId' });
    }
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: req.user.id },
    });
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    const rows = await prisma.message.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, createdAt: true },
    });
    const messages = rows.map((m) => ({
      id: m.id,
      from: m.role === 'assistant' ? 'ai' : 'user',
      text: m.content || '',
      createdAt: m.createdAt,
    }));
    return res.json(messages);
  } catch (err) {
    console.error('Get conversation messages error', err?.message || err);
    return res.status(500).json({ message: 'Failed to load messages' });
  }
});

// Delete a single conversation and all related emotional state for this user
router.delete('/conversations/:conversationId', async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = Number(req.params.conversationId);

    if (!Number.isFinite(conversationId)) {
      return res.status(400).json({ message: 'Invalid conversationId' });
    }

    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true },
    });

    if (!conv) {
      return res.json({ ok: true });
    }

    await prisma.$transaction(async (tx) => {
      await tx.messageEmotion.deleteMany({
        where: {
          message: {
            conversationId: conv.id,
            userId,
          },
        },
      });

      await tx.emotionalTimelineEvent.deleteMany({
        where: {
          conversationId: conv.id,
          userId,
        },
      });

      await tx.conversationEmotionState.deleteMany({
        where: { conversationId: conv.id },
      });

      await tx.conversationStateMachine.deleteMany({
        where: { conversationId: conv.id },
      });

      await tx.message.deleteMany({
        where: {
          conversationId: conv.id,
          userId,
        },
      });

      await tx.conversation.deleteMany({
        where: {
          id: conv.id,
          userId,
        },
      });
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Delete conversation error', err && err.message ? err.message : err);
    return res.status(500).json({ message: 'Failed to delete conversation' });
  }
});

// Delete all conversations/messages/emotional state for this user
router.delete('/delete-all', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Find all conversations for this user
    const conversations = await prisma.conversation.findMany({
      where: { userId },
      select: { id: true },
    });
    const convIds = conversations.map((c) => c.id);

    const [
      messageEmotionsDeleted,
      timelineDeleted,
      convoEmotionDeleted,
      stateMachineDeleted,
      messagesDeleted,
      conversationsDeleted,
      patternsDeleted,
    ] = await prisma.$transaction([
      prisma.messageEmotion.deleteMany({
        where: {
          message: {
            conversationId: { in: convIds },
          },
        },
      }),
      prisma.emotionalTimelineEvent.deleteMany({
        where: {
          conversationId: { in: convIds },
          userId,
        },
      }),
      prisma.conversationEmotionState.deleteMany({
        where: {
          conversationId: { in: convIds },
        },
      }),
      prisma.conversationStateMachine.deleteMany({
        where: {
          conversationId: { in: convIds },
        },
      }),
      prisma.message.deleteMany({
        where: {
          conversationId: { in: convIds },
        },
      }),
      prisma.conversation.deleteMany({
        where: {
          id: { in: convIds },
          userId,
        },
      }),
      prisma.emotionalPattern
        ? prisma.emotionalPattern.deleteMany({ where: { userId } })
        : prisma.$executeRaw`SELECT 0 AS count`,
    ]);

    const patternsCount =
      patternsDeleted && typeof patternsDeleted.count === 'number'
        ? patternsDeleted.count
        : 0;

    res.json({
      success: true,
      counts: {
        conversations: conversationsDeleted.count || 0,
        messages: messagesDeleted.count || 0,
      },
    });
  } catch (err) {
    console.error('Delete all messages error:', err && err.message ? err.message : err);
    res.status(500).json({ message: 'Failed to delete messages.' });
  }
});

// ------------------------- VOICE ROUTE ------------------------------

// Audio upload config for voice route
const uploadsRoot = path.resolve(__dirname, '..', '..', 'uploads');
const voiceDir = path.join(uploadsRoot, 'voice');
try {
  fs.mkdirSync(voiceDir, { recursive: true });
} catch (_) {}

const allowedAudio = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/wav',
  // Mobile Safari / iOS and some Android recorders
  'audio/mp4',
  'audio/aac',
]);

const audioStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, voiceDir);
  },
  filename: function (_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.webm';
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '');
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${base}${ext}`;
    cb(null, name);
  },
});

function audioFilter(_req, file, cb) {
  const raw = file.mimetype || '';

  const base = raw.split(';')[0].trim();
  if (!allowedAudio.has(base)) {
    return cb(new Error('Unsupported audio type'));
  }
  cb(null, true);
}

const uploadAudio = multer({
  storage: audioStorage,
  fileFilter: audioFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // ~20MB
});

function trimForVoiceReply(text, severityLevel) {
  const s = String(text || '').trim();
  if (!s) return s;

  if (String(severityLevel || '').toUpperCase() === 'HIGH_RISK') {
    return s;
  }

  const parts = s.split(/\n\n+/);
  let footer = '';
  let body = s;

  if (parts.length > 1) {
    footer = parts[parts.length - 1];
    body = parts.slice(0, -1).join('\n\n');
  }

  const sentences = body.split(/(?<=[.!؟?])\s+/).filter(Boolean);
  const maxSentences = 4;
  const trimmedBody = sentences.slice(0, maxSentences).join(' ') || body;

  const MAX_CHARS = 600;
  const finalBody =
    trimmedBody.length > MAX_CHARS ? trimmedBody.slice(0, MAX_CHARS) : trimmedBody;

  return footer ? `${finalBody}\n\n${footer}` : finalBody;
}

// Voice chat: accepts audio, transcribes to text, runs the emotional engine,
// and returns a TTS reply as base64 audio. Voice chat is available to all
// authenticated users (free + premium), but still enforces usage limits.
function prepareTextForTTS(text) {
  let s = String(text || '').trim();
  if (!s) return s;

  // Remove bullet markers and numbers that sound weird when read out
  s = s
    .replace(/^[\-\*\u2022]\s+/gm, '')      // - bullet, * bullet, • bullet
    .replace(/^\d+\.\s+/gm, '')            // "1. " , "2. " etc.
    .replace(/\s{2,}/g, ' ');              // collapse extra spaces

  // Optional: avoid super long "paragraphs" by adding small pauses
  s = s.replace(/([.!؟?])\s+/g, '$1 ');     // normalize spacing after punctuation

  return s;
}

router.post('/voice', uploadAudio.single('audio'), async (req, res) => {
  try {
    const tRouteStart = Date.now();
    let sttMs = 0;
    let dbSaveMs = 0;
    let ttsMs = 0;

    if (!process.env.OPENAI_API_KEY) {
      return res
        .status(500)
        .json({ message: 'OPENAI_API_KEY is not configured on the server' });
    }

    const userId = req.user.id;
    const [dbUser, usageInitial] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      ensureUsage(userId),
    ]);

    if (!dbUser) {
      return res.status(401).json({ message: 'User not found' });
    }

    let usage = usageInitial;

    const { dailyLimit, monthlyLimit, freeCharacterId, isTester } = getPlanLimits(
      dbUser.email,
      dbUser.plan
    );
    const isPremiumUser = !!(
      dbUser.isPremium || dbUser.plan === 'premium' || dbUser.plan === 'pro'
    );
    const isFreePlanUser = !isPremiumUser && !isTester;

    if (!req.file) {
      return res.status(400).json({ message: 'No audio uploaded' });
    }

    const tSttStart = Date.now();
    const userText = await transcribeAudio(req.file);
    sttMs = Date.now() - tSttStart;
    if (!userText) {
      return res.status(400).json({ message: 'Failed to transcribe audio' });
    }

    const body = req.body || {};

    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const characterId = body.characterId || 'daloua';
    if (!isPremiumUser && !isTester && isCharacterPremiumOnly(characterId)) {
      return res.status(403).json({ error: 'premium_required' });
    }

    const dialectLower = (req.body && req.body.dialect && req.body.dialect.toLowerCase()) || '';
    const langLower = (req.body && req.body.lang && req.body.lang.toLowerCase()) || '';
    const arabicDialects = new Set(['msa','ar','jo','eg','sa','lb','sy','iq','gulf','khaleeji','ae','qa','kw','bh','ye','om','dz','ma','tn','ps','sd','ly']);
    const forceArabic = langLower === 'ar' || arabicDialects.has(dialectLower);
    const forceEnglish = !forceArabic && (langLower === 'en' || dialectLower === 'en');
    const lang = forceArabic ? 'ar' : (forceEnglish ? 'en' : (langLower || 'en'));
    const dialect = lang === 'en' ? 'en' : (dialectLower || 'msa');

    const rawToneKey = body.tone;

    const bodyConversationId = body.conversationId;
    const saveFlag = body.save !== false;
    const engineRaw = typeof body.engine === 'string' ? body.engine.toLowerCase() : 'lite';
    const engineNormalized = engineRaw === 'balanced' ? 'lite' : engineRaw;
    const engine = ['lite', 'deep'].includes(engineNormalized) ? engineNormalized : 'lite';

    console.log(
      '[Diagnostic] Incoming Request: route="/api/chat/voice" Dialect="%s", Character="%s", SaveFlag=%s, ContentLength=%d',
      dialect,
      characterId,
      saveFlag,
      typeof userText === 'string' ? userText.length : 0
    );

    // Quota gating + atomic increment: premium monthly, free daily (24h window).
    const limitResultVoice = await applyUsageLimitAndIncrement({
      userId,
      usage,
      dailyLimit,
      monthlyLimit,
      isPremiumUser,
      isFreePlanUser,
      isTester,
      plan: dbUser.plan,
    });

    if (!limitResultVoice.ok) {
      const {
        used,
        limit,
        remaining,
        usage: freshUsage,
      } = limitResultVoice;

      usage = freshUsage || usage;

      return res.status(429).json({
        error: 'usage_limit_reached',
        code: 'LIMIT_EXCEEDED',
        message: 'Monthly message limit reached.',
        scope: 'monthly',
        plan: dbUser.plan,
        used,
        limit,
        remaining: typeof remaining === 'number' ? remaining : 0,
        usage: buildUsageSummary(dbUser, usage),
        limitType: 'monthly',
      });
    }

    // Use the latest usage snapshot for downstream summaries.
    usage = limitResultVoice.usage || usage;

    const persona = CHARACTER_PERSONAS[characterId];
    if (!persona) {
      return res.status(400).json({ message: 'Unknown character' });
    }

    let languageForEngine = lang === 'ar' ? 'ar' : 'en';

    const isArabicConversation = languageForEngine === 'ar';
    const personaText = isArabicConversation ? persona.ar : persona.en;

    // Ultra-fast path: trivial greetings / acknowledgements.
    if (isQuickPhrase(userText)) {
      const instant = buildInstantReply(userText, { language: languageForEngine });
      const aiTextQuick =
        (instant && typeof instant.text === 'string' && instant.text.trim()) ||
        (isArabicConversation
          ? 'أنا هون معك يا قلبي.'
          : "I'm right here with you.");

      const assistantReplyForTTSQuick = normalizeAssistantReplyForTTS(
        aiTextQuick,
        languageForEngine
      );
      const spokenTextQuick = prepareTextForTTS(assistantReplyForTTSQuick);

      const tTtsStartQuick = Date.now();
      const ttsResultQuick = await generateVoiceReply(spokenTextQuick, {
        characterId,
        format: 'mp3',
      });
      ttsMs = Date.now() - tTtsStartQuick;

      if (!ttsResultQuick) {
        const fallback = {
          type: 'voice',
          audio: null,
          audioMimeType: 'audio/mpeg',
          text: assistantReplyForTTSQuick,
          assistantText: assistantReplyForTTSQuick,
          userText,
          usage: buildUsageSummary(dbUser, usage),
          instantReply: instant,
        };
        return res.json(fallback);
      }

      const quickPayload = {
        type: 'voice',
        audio: ttsResultQuick.base64,
        audioMimeType: ttsResultQuick.mimeType,
        text: assistantReplyForTTSQuick,
        assistantText: assistantReplyForTTSQuick,
        userText,
        usage: buildUsageSummary(dbUser, usage),
        engine: 'instant-shallow',
      };

      return res.json(quickPayload);
    }

    // Resolve conversation
    let cid = null;
    if (bodyConversationId && Number.isFinite(Number(bodyConversationId))) {
      const existing = await prisma.conversation.findFirst({
        where: { id: Number(bodyConversationId), userId },
      });
      if (existing) {
        cid = existing.id;
      }
    }
    if (!cid) {
      const conv = await prisma.conversation.create({
        data: {
          userId,
          characterId,
          title: null,
        },
      });
      cid = conv.id;
    }

    // Build recent history (exclude the just-typed user message if duplicated)
    let history = Array.isArray(rawMessages) ? rawMessages.slice() : [];
    if (history.length && typeof userText === 'string') {
      const last = history[history.length - 1];
      if (last && typeof last.text === 'string') {
        const lastText = String(last.text || '').trim();
        if (last.from === 'user' && lastText === userText) {
          history.pop();
        }
      }
    }

    const recentMessagesForEngine = history
      .map((m) => {
        if (!m || typeof m.text !== 'string') return null;
        const text = m.text.trim();
        if (!text) return null;
        return {
          role: m.from === 'ai' ? 'assistant' : 'user',
          content: text,
        };
      })
      .filter(Boolean);

    // Lite engine: skip emotional pipeline entirely when engine === 'lite'.
    if (engine === 'lite') {
      const routedModel = selectModelForResponse({
        engine: 'lite',
        isPremiumUser: isPremiumUser || isTester,
      });

      const liteResult = await runLiteEngine({
        userMessage: userText,
        recentMessages: recentMessagesForEngine,
        personaText,
        language: languageForEngine,
        dialect,
        model: routedModel,
        isPremiumUser: isPremiumUser || isTester,
        userId,
      });

      const aiTextLite =
        (liteResult &&
          typeof liteResult.text === 'string' &&
          liteResult.text.trim()) ||
        (isArabicConversation
          ? 'أنا هون معك يا قلبي، احكي لي أكثر لو حابب.'
          : "I'm here with you, tell me a bit more if you want.");

      const assistantReplyForTTSLite = normalizeAssistantReplyForTTS(
        aiTextLite,
        languageForEngine
      );
      const spokenTextLite = prepareTextForTTS(assistantReplyForTTSLite);

      const tTtsStartLite = Date.now();
      const ttsResultLite = await generateVoiceReply(spokenTextLite, {
        characterId,
        format: 'mp3',
      });
      ttsMs = Date.now() - tTtsStartLite;

      if (!ttsResultLite) {
        const fallbackLite = {
          type: 'voice',
          audio: null,
          audioMimeType: 'audio/mpeg',
          text: assistantReplyForTTSLite,
          assistantText: assistantReplyForTTSLite,
          userText,
          usage: buildUsageSummary(dbUser, usage),
          engine: 'lite',
          model: routedModel,
        };
        return res.json(fallbackLite);
      }

      const litePayload = {
        type: 'voice',
        audio: ttsResultLite.base64,
        audioMimeType: ttsResultLite.mimeType,
        text: assistantReplyForTTSLite,
        assistantText: assistantReplyForTTSLite,
        userText,
        usage: buildUsageSummary(dbUser, usage),
        engine: 'lite',
        model: routedModel,
      };

      return res.json(litePayload);
    }

    // Emotional engine
    const engineResult = await runEmotionalEngine({
      userMessage: userText,
      recentMessages: recentMessagesForEngine,
      personaId: characterId,
      personaText,
      language: languageForEngine,
      dialect,
      conversationId: cid,
      userId,
    });

    const {
      emo,
      convoState,
      systemPrompt,
      flowState,
      longTermSnapshot,
      triggers,
      severityLevel,
      personaCfg,
      cacheMeta = {},
    } = engineResult;

    let trustSnapshot = null;
    try {
      const trustRes = await updateTrustOnMessage({
        userId,
        personaId: characterId,
        emotionSnapshot: emo,
        triggers,
        timestamp: new Date(),
      });
      trustSnapshot = trustRes && trustRes.trust ? trustRes.trust : null;
    } catch (err) {
      console.error(
        '[Whispers][Trust] updateTrustOnMessage failed',
        err && err.message ? err.message : err
      );
    }

    try {
      await logEmotionalEvent({
        userId,
        personaId: characterId,
        conversationId: cid,
        timestamp: new Date(),
        dominantEmotion:
          emo && typeof emo.primaryEmotion === 'string'
            ? emo.primaryEmotion
            : 'NEUTRAL',
        intensity:
          emo && typeof emo.intensity === 'number' ? emo.intensity : 0,
        valence: null,
        source: 'user_message',
        eventType: 'message',
        tags: { source: 'text', severityLevel: severityLevel || 'CASUAL' },
      });
    } catch (err) {
      console.error(
        '[Timeline] logEmotionalEvent (message) failed',
        err && err.message ? err.message : err
      );
    }

    const engineTimings = engineResult.timings || {};
    const verbosity = computeVerbosityControls({
      userText,
      severityLevel: severityLevel || 'CASUAL',
    });

    const engineMode = decideEngineMode({
      enginePreference: engine,
      isPremiumUser: isPremiumUser || isTester,
      severityLevel: severityLevel || 'CASUAL',
      longFormIntent: verbosity.longIntent,
    });
    const engineModeSource = engine === 'lite' ? 'user_lite' : 'normalized';

    const conciseNudge =
      verbosity.verbosityMode === 'short'
        ? `\n\nOUTPUT RULES (VERY IMPORTANT):
- Default: 1–2 short sentences only.
- Be conversational (no speeches, no proverbs unless asked).
- Ask at most ONE short follow-up question only if it feels natural.
- If the user explicitly asks for detail/steps, you may expand.`
        : `\n\nOUTPUT RULES:
- Be conversational and avoid long speeches unless the user asks.
- Ask at most one question.`;

    const systemMessage = `${systemPrompt}${conciseNudge}`;

    const recentContext = recentMessagesForEngine.slice(-MAX_CONTEXT_MESSAGES);
    const openAIMessages = [];
    openAIMessages.push({ role: 'system', content: systemMessage });

    const limitedContext =
      Array.isArray(recentContext) && recentContext.length > FAST_CONTEXT_MESSAGES
        ? recentContext.slice(-FAST_CONTEXT_MESSAGES)
        : recentContext;
    if (Array.isArray(limitedContext) && limitedContext.length) {
      openAIMessages.push(...limitedContext);
      aiMessage = rawReply;
    }

    // Voice mode: keep spoken reply compact while preserving any safety footer.
    aiMessage = trimForVoiceReply(aiMessage, severityLevel || 'CASUAL');

    const assistantReplyForTTS = normalizeAssistantReplyForTTS(
      aiMessage,
      languageForEngine
    );

    const voiceProfile =
      CHARACTER_VOICES[characterId] || CHARACTER_VOICES.default;
    const toneKey = rawToneKey || voiceProfile.defaultTone || 'calm';

    const shouldSave =
      !!saveFlag && !!dbUser.saveHistoryEnabled && Number.isFinite(Number(cid));

    console.log(
      '[Diagnostic] Attempting to Save? ShouldSave=%s, CID=%s, UserID=%s',
      shouldSave,
      cid == null ? 'null' : String(cid),
      userId == null ? 'null' : String(userId)
    );

    let userRow = null;

    let dbSaveDeferred = false;
    let backgroundJobQueued = false;
    let dbSavePromise = Promise.resolve();

    if (shouldSave) {
      dbSaveDeferred = true;
      dbSavePromise = (async () => {
        const tDbStart = Date.now();
        let rows = null;
        try {
          rows = await prisma.$transaction([
            prisma.message.create({
              data: {
                userId,
                characterId,
                conversationId: cid,
                role: 'user',
                content: userText,
              },
            }),
            prisma.message.create({
              data: {
                userId,
                characterId,
                conversationId: cid,
                role: 'assistant',
                content: aiMessage,
              },
            }),
            prisma.conversation.update({
              where: { id: cid },
              data: { updatedAt: new Date() },
            }),
          ]);
          dbSaveMs = Date.now() - tDbStart;
        } catch (err) {
          console.error(
            'Voice message persistence error',
            err && err.message ? err.message : err
          );
          return;
        }

        const userRow = rows ? rows[0] : null;
        const assistantRow = rows ? rows[1] : null;
        if (!userRow || !userRow.id) return;
        backgroundJobQueued = true;

        const bgEngineMode = engineMode;
        const bgUserId = userId;
        const bgConversationId = cid;
        const bgCharacterId = characterId;
        const bgEmotion = emo;
        const bgMessageId = userRow.id;

        setImmediate(() => {
          (async () => {
            try {
              await prisma.messageEmotion.create({
                data: {
                  messageId: bgMessageId,
                  primaryEmotion: bgEmotion.primaryEmotion,
                  intensity: bgEmotion.intensity,
                  confidence: bgEmotion.confidence,
                  cultureTag: bgEmotion.cultureTag,
                  notes: bgEmotion.notes || null,
                },
              });
            } catch (err) {
              console.error(
                '[EmoEngine][Background][Voice] MessageEmotion error',
                err && err.message ? err.message : err
              );
            }

            try {
              await recordMemoryEvent({
                userId: bgUserId,
                conversationId: bgConversationId,
                messageId: bgMessageId,
                characterId: bgCharacterId,
                emotion: bgEmotion,
                messageText: userText, // Pass original text to avoid encryption encoding issues
                topics: Array.isArray(bgEmotion.topics) ? bgEmotion.topics : [],
                secondaryEmotion: bgEmotion.secondaryEmotion || null,
                emotionVector: bgEmotion.emotionVector || null,
                detectorVersion: bgEmotion.detectorVersion || null,
                isKernelRelevant: true,
              });
            } catch (err) {
              console.error(
                '[EmoEngine][Background][Voice] MemoryKernel error',
                err && err.message ? err.message : err
              );
            }
          })().catch(() => {});
        });
      })();

      dbSavePromise.catch(() => {});
    }

    // 6) Text-to-speech for the final reply text.
    const spokenText = prepareTextForTTS(assistantReplyForTTS);

    const tTtsStart = Date.now();
    const ttsResult = await generateVoiceReply(spokenText, {
      characterId,
      format: 'mp3',
    });

    ttsMs = Date.now() - tTtsStart;

    if (!ttsResult) {
      // Fallback: TTS failed
      const fallback = {
        type: 'voice',
        audio: null,
        audioMimeType: 'audio/mpeg',
        text: assistantReplyForTTS,
        assistantText: assistantReplyForTTS,
        userText,
        usage: buildUsageSummary(dbUser, usage),
      };
      return res.json(fallback);
    }

    console.log('[VoiceRoute][Response]', {
      userId: userId == null ? 'null' : String(userId),
      conversationId: cid == null ? 'null' : String(cid),
      engineParam: engine,
      engineModeSelected: engineMode,
      engineModeSource: engineModeSource,
      engineMode,
      isPremiumUser: !!isPremiumUser,
      openAiMs,
      orchestrateMs,
      ttsVoice: ttsResult.voiceId,
    });

    const totalMs = Date.now() - tRouteStart;
    console.log('[VoiceTiming]', {
      userId: userId == null ? 'null' : String(userId),
      conversationId: cid == null ? 'null' : String(cid),
      engineParam: engine,
      engineModeSelected: engineMode,
      engineModeSource,
      classifyMs: engineTimings.classifyMs || 0,
      engineTotalMs: engineTimings.totalMs || 0,
      snapshotMs: engineTimings.snapshotMs || 0,
      triggersMs: engineTimings.triggersMs || 0,
      phase4Ms: engineTimings.phase4Ms || 0,
      stateUpdateMs: engineTimings.stateUpdateMs || 0,
      stateReadMs: engineTimings.stateReadMs || 0,
      tTranscribeMs: sttMs,
      openAiMs,
      orchestrateMs,
      ttsMs,
      dbSaveMs,
      totalMs,
    });

    let whispersUnlocked = [];
    try {
      const unlocked = await evaluateWhisperUnlocks({
        userId,
        personaId: characterId,
      });
      if (Array.isArray(unlocked) && unlocked.length) {
        whispersUnlocked = unlocked;
        for (const w of unlocked) {
          try {
            await logEmotionalEvent({
              userId,
              personaId: characterId,
              conversationId: cid,
              timestamp: w.unlockedAt || new Date(),
              dominantEmotion: 'NEUTRAL',
              intensity: 0,
              valence: null,
              source: 'system_event',
              eventType: 'whisper_unlocked',
              tags: {
                whisperId: w.id,
                title: w.title,
                levelRequired: w.levelRequired,
              },
            });
          } catch (err) {
            console.error(
              '[Timeline] logEmotionalEvent (whisper_unlocked:voice) failed',
              err && err.message ? err.message : err
            );
          }
        }
      }
    } catch (err) {
      console.error(
        '[Whispers][Route] evaluateWhisperUnlocks (voice) failed',
        err && err.message ? err.message : err
      );
    }

    const responsePayload = {
      type: 'voice',
      audio: ttsResult.base64,
      audioMimeType: ttsResult.mimeType,
      text: assistantReplyForTTS,
      assistantText: assistantReplyForTTS,
      userText,
      usage: buildUsageSummary(dbUser, usage),
      emotion: emo ? {
        primaryEmotion: emo.primaryEmotion || 'NEUTRAL',
        intensity: typeof emo.intensity === 'number' ? emo.intensity : 0,
        secondaryEmotion: emo.secondaryEmotion || null,
      } : null,
    };

    if (whispersUnlocked.length) {
      responsePayload.whispersUnlocked = whispersUnlocked;
    }

    return res.json(responsePayload);
  } catch (err) {
    console.error('Voice chat error', err && err.message ? err.message : err);
    return res.status(500).json({ message: 'Failed to process voice chat.' });
  }
});

router.post('/message', async (req, res) => {
  try {
    const tRouteStart = Date.now();
    let classifyMs = 0;
    let snapshotMs = 0;
    let triggersMs = 0;
    let phase4Ms = 0;
    let stateUpdateMs = 0;
    let stateReadMs = 0;
    let engineTotalMs = 0;
    let openAiMs = 0;
    let orchestrateMs = 0;
    let dbSaveMs = 0;

    if (!process.env.OPENAI_API_KEY) {
      return res
        .status(500)
        .json({ message: 'OPENAI_API_KEY is not configured on the server' });
    }

    const userId = req.user.id;
    const [dbUser, usageInitial] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      ensureUsage(userId),
    ]);

    if (!dbUser) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { dailyLimit, monthlyLimit, freeCharacterId, isTester } = getPlanLimits(
      dbUser.email,
      dbUser.plan
    );
    const isPremiumUser = !!(
      dbUser.isPremium || dbUser.plan === 'premium' || dbUser.plan === 'pro'
    );
    const isFreePlanUser = !isPremiumUser && !isTester;

    let usage = usageInitial;

    const body = req.body || {};

    const dialectLower = (req.body && req.body.dialect && req.body.dialect.toLowerCase()) || '';
    const langLower = (req.body && req.body.lang && req.body.lang.toLowerCase()) || '';
    const arabicDialects = new Set(['msa','ar','jo','eg','sa','lb','sy','iq','gulf','khaleeji','ae','qa','kw','bh','ye','om','dz','ma','tn','ps','sd','ly']);
    const forceArabic = langLower === 'ar' || arabicDialects.has(dialectLower);
    const forceEnglish = !forceArabic && (langLower === 'en' || dialectLower === 'en');
    const lang = forceArabic ? 'ar' : (forceEnglish ? 'en' : (langLower || 'en'));
    const dialect = lang === 'en' ? 'en' : (dialectLower || 'msa');

    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const characterId = body.characterId || 'daloua';
    if (!isPremiumUser && !isTester && isCharacterPremiumOnly(characterId)) {
      return res.status(403).json({ error: 'premium_required' });
    }

    const rawToneKey = body.tone;

    const bodyConversationId = body.conversationId;
    const saveFlag = body.save !== false;
    const userText =
      typeof body.content === 'string' ? body.content.trim() : '';

    const engineRaw = typeof body.engine === 'string' ? body.engine.toLowerCase() : 'balanced';
    const engine = ['lite', 'balanced', 'deep'].includes(engineRaw)
      ? engineRaw
      : 'balanced';

    const wantsStream =
      body.stream === true ||
      body.stream === 'true' ||
      (req.query && req.query.stream === '1');

    console.log(
  '[Diagnostic] Incoming Request: route="/api/chat/message" Dialect="%s", Character="%s", SaveFlag=%s, ContentLength=%d, WantsStream=%s',
  dialect,
  characterId,
  saveFlag,
  typeof userText === 'string' ? userText.length : 0,
  wantsStream
);

    if (!userText) {
      return res.status(400).json({ message: 'content is required' });
    }

    // Quota gating + atomic increment: enforce monthly limits only.
    const limitResultMessage = await applyUsageLimitAndIncrement({
      userId,
      usage,
      dailyLimit,
      monthlyLimit,
      isPremiumUser,
      isFreePlanUser,
      isTester,
      plan: dbUser.plan,
    });

    if (!limitResultMessage.ok) {
      const {
        used,
        limit,
        remaining,
        usage: freshUsage,
      } = limitResultMessage;

      usage = freshUsage || usage;

      return res.status(429).json({
        error: 'usage_limit_reached',
        code: 'LIMIT_EXCEEDED',
        message: 'Monthly message limit reached.',
        scope: 'monthly',
        plan: dbUser.plan,
        used,
        limit,
        remaining: typeof remaining === 'number' ? remaining : 0,
        usage: buildUsageSummary(dbUser, usage),
        limitType: 'monthly',
      });
    }

    // Use the latest usage snapshot for downstream summaries.
    usage = limitResultMessage.usage || usage;

    const persona = CHARACTER_PERSONAS[characterId];
    if (!persona) {
      return res.status(400).json({ message: 'Unknown character' });
    }

    const isArabicConversation = lang === 'ar';

    const personaText = isArabicConversation ? persona.ar : persona.en;
    const languageForEngine = lang === 'ar' ? 'ar' : 'en';

    // Ultra-fast path: trivial greetings / acknowledgements.
    if (isQuickPhrase(userText)) {
      const instant = buildInstantReply(userText, { language: languageForEngine });
      const quickText =
        (instant && typeof instant.text === 'string' && instant.text.trim()) ||
        (isArabicConversation
          ? 'أنا هون معك يا قلبي.'
          : "I'm right here with you.");

      const responsePayloadQuick = {
        reply: quickText,
        usage: buildUsageSummary(dbUser, usage),
        instantReply: instant,
        engine: 'instant-shallow',
      };

      return res.json(responsePayloadQuick);
    }

    // Resolve conversation
    let cid = null;
    if (bodyConversationId && Number.isFinite(Number(bodyConversationId))) {
      const existing = await prisma.conversation.findFirst({
        where: { id: Number(bodyConversationId), userId },
      });
      if (existing) {
        cid = existing.id;
      }
    }
    if (!cid) {
      const conv = await prisma.conversation.create({
        data: {
          userId,
          characterId,
          title: null,
        },
      });
      cid = conv.id;
    }

    // Build recent history (exclude the just-typed user message if duplicated)
    let history = Array.isArray(rawMessages) ? rawMessages.slice() : [];
    if (history.length && typeof userText === 'string') {
      const last = history[history.length - 1];
      if (last && typeof last.text === 'string') {
        const lastText = String(last.text || '').trim();
        if (last.from === 'user' && lastText === userText) {
          history.pop();
        }
      }
    }

    const recentMessagesForEngine = history
      .map((m) => {
        if (!m || typeof m.text !== 'string') return null;
        const text = m.text.trim();
        if (!text) return null;
        return {
          role: m.from === 'ai' ? 'assistant' : 'user',
          content: text,
        };
      })
      .filter(Boolean);

    // Lite engine: skip emotional pipeline entirely when engine === 'lite'.
    if (engine === 'lite') {
      const routedModel = selectModelForResponse({
        engine: 'lite',
        isPremiumUser: isPremiumUser || isTester,
      });

      const liteResult = await runLiteEngine({
        userMessage: userText,
        recentMessages: recentMessagesForEngine,
        personaText,
        language: languageForEngine,
        dialect,
        model: routedModel,
        isPremiumUser: isPremiumUser || isTester,
        userId,
      });

      const aiMessageLite =
        (liteResult &&
          typeof liteResult.text === 'string' &&
          liteResult.text.trim()) ||
        (isArabicConversation
          ? 'أنا هون معك يا قلبي، احكي لي أكثر لو حابب.'
          : "I'm here with you, tell me a bit more if you want.");

      const responsePayloadLite = {
        reply: aiMessageLite,
        usage: buildUsageSummary(dbUser, usage),
        engine: 'lite',
        model: routedModel,
      };

      return res.json(responsePayloadLite);
    }

    // Emotional engine
    const engineResult = await runEmotionalEngine({
      userMessage: userText,
      recentMessages: recentMessagesForEngine,
      personaId: characterId,
      personaText,
      language: languageForEngine,
      dialect,
      conversationId: cid,
      userId,
    });

    const {
      emo,
      convoState,
      systemPrompt,
      flowState,
      longTermSnapshot,
      triggers,
      severityLevel,
      personaCfg,
      cacheMeta = {},
    } = engineResult;

    try {
      await updateTrustOnMessage({
        userId,
        personaId: characterId,
        emotionSnapshot: emo,
        triggers,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error(
        '[Whispers][Trust] updateTrustOnMessage failed',
        err && err.message ? err.message : err
      );
    }

    try {
      await logEmotionalEvent({
        userId,
        personaId: characterId,
        conversationId: cid,
        timestamp: new Date(),
        dominantEmotion:
          emo && typeof emo.primaryEmotion === 'string'
            ? emo.primaryEmotion
            : 'NEUTRAL',
        intensity:
          emo && typeof emo.intensity === 'number' ? emo.intensity : 0,
        valence: null,
        source: 'user_message',
        eventType: 'message',
        tags: { source: 'text', severityLevel: severityLevel || 'CASUAL' },
      });
    } catch (err) {
      console.error(
        '[Timeline] logEmotionalEvent (message) failed',
        err && err.message ? err.message : err
      );
    }

    const engineTimings = engineResult.timings || {};

    classifyMs = engineTimings.classifyMs ?? 0;
    snapshotMs = engineTimings.snapshotMs ?? 0;
    triggersMs = engineTimings.triggersMs ?? 0;
    phase4Ms = engineTimings.phase4Ms ?? 0;
    stateUpdateMs = engineTimings.stateUpdateMs ?? 0;
    stateReadMs = engineTimings.stateReadMs ?? 0;
    engineTotalMs = engineTimings.totalMs ?? 0;

    const engineMode = decideEngineMode({
      enginePreference: engine,
      isPremiumUser: isPremiumUser || isTester,
    });
    const engineModeSource = engine === 'lite' ? 'user_lite' : 'normalized';

const verbosity = computeVerbosityControls({
  userText,
  severityLevel: severityLevel || 'CASUAL',
});

const conciseNudge =
  verbosity.verbosityMode === 'short'
    ? `\n\nOUTPUT RULES (VERY IMPORTANT):
- Default: 1–2 short sentences only.
- Be conversational (no speeches, no proverbs unless asked).
- Ask at most ONE short follow-up question only if it feels natural.
- If the user explicitly asks for detail/steps, you may expand.`
    : `\n\nOUTPUT RULES:
- Be conversational and avoid long speeches unless the user asks.
- Ask at most one question.`;

const systemMessage = `${systemPrompt}${conciseNudge}`;

    const recentContext = recentMessagesForEngine.slice(-MAX_CONTEXT_MESSAGES);
    const openAIMessages = [];
    openAIMessages.push({ role: 'system', content: systemMessage });

    const limitedContext =
      Array.isArray(recentContext) && recentContext.length > FAST_CONTEXT_MESSAGES
        ? recentContext.slice(-FAST_CONTEXT_MESSAGES)
        : recentContext;
    if (Array.isArray(limitedContext) && limitedContext.length) {
      openAIMessages.push(...limitedContext);
    }
    openAIMessages.push({ role: 'user', content: userText });

    const routedModel = selectModelForResponse({
      engine: 'balanced',
      isPremiumUser: isPremiumUser || isTester,
    });

    const tOpenAIStart = Date.now();
    let completion = await openai.chat.completions.create({
      model: routedModel,
      messages: openAIMessages,
      temperature: verbosity.verbosityMode === 'short' ? 0.6 : 0.8,
      max_tokens: verbosity.maxTokens,
    });
    openAiMs = Date.now() - tOpenAIStart;

    let rawReply = completion.choices?.[0]?.message?.content?.trim();
    if (!rawReply) {
      return res
        .status(500)
        .json({ message: 'No response from language model.' });
    }

    // BUG 2 FIX: Truncation Guard with finish_reason + pattern detection
    const finishReason = completion.choices?.[0]?.finish_reason;
    const isTruncated = (text, reason) => {
      if (!text) return false;
      // Rule 1: OpenAI says length limit hit
      if (reason === 'length') return true;
      const trimmed = text.trim();
      // Rule 2: Ends with numbered list marker (1. 2. etc)
      if (/\d+\.\s*$/.test(trimmed)) return true;
      // Rule 3: Ends with bullet/dash
      if (/[-•]\s*$/.test(trimmed)) return true;
      // Rule 4: Ends with colon (incomplete list)
      if (/:\s*$/.test(trimmed)) return true;
      // Rule 5: No terminal punctuation
      if (trimmed.length > 30 && !/[.!?؟]$/.test(trimmed)) return true;
      return false;
    };

    if (isTruncated(rawReply, finishReason)) {
      console.log('[TruncationGuard] triggered=true finish_reason=%s', finishReason);
      // Clean dangling markers before recovery
      let cleaned = rawReply.replace(/\n?\d+\.\s*$/, '').replace(/[-•]\s*$/, '').replace(/:\s*$/, '').trim();
      let recovered = false;
      try {
        const recoveryCompletion = await openai.chat.completions.create({
          model: routedModel,
          messages: [
            ...openAIMessages,
            { role: 'assistant', content: cleaned },
            { role: 'user', content: 'Complete your thought in one brief sentence. No lists.' },
          ],
          temperature: 0.5,
          max_tokens: 100,
        });
        const recoveryText = recoveryCompletion.choices?.[0]?.message?.content?.trim();
        if (recoveryText && recoveryText.length > 3) {
          rawReply = cleaned + ' ' + recoveryText;
          recovered = true;
        }
      } catch (recoveryErr) {
        console.error('[TruncationGuard] recovery_error=%s', recoveryErr?.message || 'unknown');
      }
      if (!recovered) {
        rawReply = cleaned + (languageForEngine === 'ar' ? ' شو رأيك؟' : ' What do you think?');
      }
      console.log('[TruncationGuard] recovered=%s', recovered);
    }

    let aiMessage = rawReply;
    orchestrateMs = 0;

    try {
      const tOrchStart = Date.now();
      aiMessage = await orchestrateResponse({
        rawReply,
        persona: personaText,
        emotion: emo,
        convoState: flowState || { currentState: 'NEUTRAL' },
        longTermSnapshot,
        triggers,
        language: languageForEngine,
        severityLevel: severityLevel || 'CASUAL',
        personaCfg: personaCfg || null,
        engineMode,
        isPremiumUser: isPremiumUser || isTester,
        verbosityMode: verbosity.verbosityMode,
      });
      orchestrateMs = Date.now() - tOrchStart;
      if (typeof aiMessage !== 'string' || !aiMessage.trim()) {
        aiMessage = rawReply;
      }
    } catch (_) {
      aiMessage = rawReply;
    }

    // Premium users: gently suggest Abu Mukh if Daloua is being used for study/productivity
    if (isPremiumUser && characterId === 'daloua' && !isArabicConversation) {
      const lower = userText.toLowerCase();
      const studyKeywords = [
        'exam',
        'study',
        'studying',
        'homework',
        'assignment',
        'test',
      ];
      const productivityKeywords = [
        'productivity',
        'routine',
        'routines',
        'schedule',
        'plan',
        'planning',
        'focus',
      ];
      const mentionsStudy = studyKeywords.some((w) => lower.includes(w));
      const mentionsProductivity = productivityKeywords.some((w) =>
        lower.includes(w)
      );
      if (mentionsStudy || mentionsProductivity) {
        aiMessage =
          aiMessage +
          '\n\n' +
          "For strict study plans and focus routines, Abu Mukh is the expert. You can switch to him from the companions section whenever you like.";
      }
    }

    let dbSaveDeferred = false;
    let backgroundJobQueued = false;
    let dbSavePromise = Promise.resolve();

    const shouldSave =
      !!saveFlag && !!dbUser.saveHistoryEnabled && Number.isFinite(Number(cid));

    console.log(
      '[Diagnostic] Attempting to Save? ShouldSave=%s, CID=%s, UserID=%s',
      shouldSave,
      cid == null ? 'null' : String(cid),
      userId == null ? 'null' : String(userId)
    );

    if (shouldSave) {
      dbSaveDeferred = true;
      dbSavePromise = (async () => {
        const tDbStart = Date.now();
        let rows = null;
        try {
          rows = await prisma.$transaction([
            prisma.message.create({
              data: {
                userId,
                characterId,
                conversationId: cid,
                role: 'user',
                content: userText,
              },
            }),
            prisma.message.create({
              data: {
                userId,
                characterId,
                conversationId: cid,
                role: 'assistant',
                content: aiMessage,
              },
            }),
            prisma.conversation.update({
              where: { id: cid },
              data: { updatedAt: new Date() },
            }),
          ]);
          dbSaveMs = Date.now() - tDbStart;
        } catch (err) {
          console.error(
            'Message persistence error',
            err && err.message ? err.message : err
          );
          return;
        }

        const userRow = rows ? rows[0] : null;
        const assistantRow = rows ? rows[1] : null;
        if (!userRow || !userRow.id) return;
        backgroundJobQueued = true;

        const bgEngineMode = engineMode;
        const bgUserId = userId;
        const bgConversationId = cid;
        const bgCharacterId = characterId;
        const bgEmotion = emo;
        const bgMessageId = userRow.id;

        setImmediate(async () => {
          const tBgStart = Date.now();
          try {
            try {
              await prisma.messageEmotion.create({
                data: {
                  messageId: bgMessageId,
                  primaryEmotion: bgEmotion.primaryEmotion,
                  intensity: bgEmotion.intensity,
                  confidence: bgEmotion.confidence,
                  cultureTag: bgEmotion.cultureTag,
                  notes: bgEmotion.notes || null,
                },
              });
            } catch (err) {
              console.error(
                '[EmoEngine][Background] MessageEmotion error',
                err && err.message ? err.message : err
              );
            }

            try {
              await recordMemoryEvent({
                userId: bgUserId,
                conversationId: bgConversationId,
                messageId: bgMessageId,
                characterId: bgCharacterId,
                emotion: bgEmotion,
                messageText: userText, // Pass original text to avoid encryption encoding issues
                topics: Array.isArray(bgEmotion.topics)
                  ? bgEmotion.topics
                  : [],
                secondaryEmotion: bgEmotion.secondaryEmotion || null,
                emotionVector: bgEmotion.emotionVector || null,
                detectorVersion: bgEmotion.detectorVersion || null,
                isKernelRelevant: true,
              });
            } catch (err) {
              console.error(
                '[EmoEngine][Background] MemoryKernel error',
                err && err.message ? err.message : err
              );
            }

            try {
              await updateConversationEmotionState(bgConversationId, bgEmotion);
            } catch (err) {
              console.error(
                '[EmoEngine][Background] ConversationEmotionState error',
                err && err.message ? err.message : err
              );
            }

            try {
              await logEmotionalTimelineEvent({
                userId: bgUserId,
                conversationId: bgConversationId,
                emotion: bgEmotion,
              });
            } catch (err) {
              console.error(
                '[EmoEngine][Background] Timeline error',
                err && err.message ? err.message : err
              );
            }

            try {
              await logTriggerEventsForMessage({
                userId: bgUserId,
                conversationId: bgConversationId,
                messageId: bgMessageId,
                messageText: userText,
                emotion: bgEmotion,
              });
            } catch (err) {
              console.error(
                '[EmoEngine][Background] TriggerEvents error',
                err && err.message ? err.message : err
              );
            }

            try {
              await updateUserEmotionProfile({ userId: bgUserId });
            } catch (err) {
              console.error(
                '[EmoEngine][Background] UserEmotionProfile error',
                err && err.message ? err.message : err
              );
            }

            try {
              await updateEmotionalPatterns({ userId: bgUserId });
            } catch (err) {
              console.error(
                '[EmoEngine][Background] Patterns error',
                err && err.message ? err.message : err
              );
            }

            const bgMs = Date.now() - tBgStart;
            console.log('[EmoEngine][Background]', {
              userId: bgUserId == null ? 'null' : String(bgUserId),
              conversationId: bgConversationId == null ? 'null' : String(bgConversationId),
              engineMode: bgEngineMode,
              isPremiumUser: !!isPremiumUser,
              durationMs: bgMs,
            });
          } catch (err) {
            console.error(
              '[EmoEngine][Background] Unhandled error',
              err && err.message ? err.message : err
            );
          }
        });
      })();

      dbSavePromise.catch(() => {});
    }

    console.log('[EmoEngine][Response]', {
      userId: userId == null ? 'null' : String(userId),
      conversationId: cid == null ? 'null' : String(cid),
      engineParam: engine,
      engineModeSelected: engineMode,
      engineModeSource,
      engineMode,
      isPremiumUser: !!isPremiumUser,
      classifyMs,
      snapshotMs,
      triggersMs,
      phase4Ms,
      stateUpdateMs,
      stateReadMs,
      orchestrateMs,
      openAiMs,
      dbSaveMs,
      backgroundJobQueued,
    });

    const totalMs = Date.now() - tRouteStart;
    console.log('[ChatTiming]', {
      userId: userId == null ? 'null' : String(userId),
      conversationId: cid == null ? 'null' : String(cid),
      engineParam: engine,
      engineModeSelected: engineMode,
      engineModeSource,
      classifyMs,
      engineTotalMs,
      snapshotMs,
      triggersMs,
      phase4Ms,
      stateUpdateMs,
      stateReadMs,
      openAiMs,
      orchestrateMs,
      dbSaveMs,
      totalMs,
    });

    let whispersUnlocked = [];
    try {
      const unlocked = await evaluateWhisperUnlocks({
        userId,
        personaId: characterId,
      });
      if (Array.isArray(unlocked) && unlocked.length) {
        whispersUnlocked = unlocked;
        for (const w of unlocked) {
          try {
            await logEmotionalEvent({
              userId,
              personaId: characterId,
              conversationId: cid,
              timestamp: w.unlockedAt || new Date(),
              dominantEmotion: 'NEUTRAL',
              intensity: 0,
              valence: null,
              source: 'system_event',
              eventType: 'whisper_unlocked',
              tags: {
                whisperId: w.id,
                title: w.title,
                levelRequired: w.levelRequired,
              },
            });
          } catch (err) {
            console.error(
              '[Timeline] logEmotionalEvent (whisper_unlocked) failed',
              err && err.message ? err.message : err
            );
          }
        }
      }
    } catch (err) {
      console.error(
        '[Whispers][Route] evaluateWhisperUnlocks failed',
        err && err.message ? err.message : err
      );
    }

  
    const responsePayload = {
      reply: aiMessage,
      usage: buildUsageSummary(dbUser, usage),
      conversationId: cid,
      emotion: emo ? {
        primaryEmotion: emo.primaryEmotion || 'NEUTRAL',
        intensity: typeof emo.intensity === 'number' ? emo.intensity : 0,
        secondaryEmotion: emo.secondaryEmotion || null,
      } : null,
      whispersUnlocked,
    };

    if (wantsStream) {
      const donePayload = {
        type: 'done',
        reply: responsePayload.reply,
        usage: responsePayload.usage,
        whispersUnlocked: responsePayload.whispersUnlocked || [],
      };
      res.write(`data: ${JSON.stringify(donePayload)}\n\n`);
      return res.end();
    }

    return res.json(responsePayload);

  } catch (err) {
    console.error('Chat completion error', err && err.message ? err.message : err);
    return res.status(500).json({
      message: 'Failed to generate reply.',
    });
  }
});

module.exports = router;