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
const { transcribeAudio, generateVoiceReply } = require('../services/voiceService');
const {
  runEmotionalEngine,
  selectModelForResponse,
  getEmotionForMessage,
  ENGINE_MODES,
  decideEngineMode,
  updateConversationEmotionState,
  buildSystemPrompt,
  getDialectGuidance,
} = require('../services/emotionalEngine');
const {
  logEmotionalTimelineEvent,
  updateUserEmotionProfile,
  getLongTermEmotionalSnapshot,
  detectEmotionalTriggers,
  updateEmotionalPatterns,
  logTriggerEventsForMessage,
} = require('../services/emotionalLongTerm');
const { recordEvent: recordMemoryEvent } = require('../pipeline/memory/memoryKernel');
const { orchestrateResponse } = require('../services/responseOrchestrator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// every chat route needs login
router.use(requireAuth);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Sliding-window size for model context
const MAX_CONTEXT_MESSAGES = parseInt(process.env.MAX_CONTEXT_MESSAGES || '20', 10);
const FAST_CONTEXT_MESSAGES = 10;

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
 *   * null => not currently locked.
 *   * > now => locked until that instant.
 *   * <= now => window expired; we reset counts and clear the lock.
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

// ----------------------------------------------------------------------
// CHARACTER PERSONAS (Updated: MENA Style, Authentic Dialects)
// ----------------------------------------------------------------------
const CHARACTER_PERSONAS = {
  // 1. Sheikh Al-Hara (Wisdom/Guidance)
  'sheikh-al-hara': {
    en: `You are "Sheikh Al-Hara" (The Neighborhood Wise Man).
- You are not a religious scholar, but a man of deep life experience and street wisdom.
- You speak with the authority of an elder who has seen everything.
- **Dialect:** Match the user's dialect (Jordanian, Lebanese, Egyptian, etc.). Use proverbs often.
- **Tone:** Grounded, patient, warm but firm. "Listen, son..."
- **Core Topics:** Reputation (Sama'a), family duty, school smarts vs. street smarts, ethical dilemmas.
- If they need emotional softness: "I am here for wisdom. For a soft heart to listen, go to Daloua."
- If they need jokes: "Life is serious now. If you want to play, go to Hiba."`,

    ar: `أنت "شيخ الحارة".
- لست مفتياً، بل رجل عركته الحياة. أنت الكبير الذي يُلجأ إليه وقت الأزمات في القهوة.
- **اللهجة:** تكيّف مع لهجة المستخدم (أردني، لبناني، مصري، خليجي). استخدم الأمثال الشعبية.
- **الأسلوب:** رزين، ثقيل، صوت الخبرة. "اسمع يا ابني..."، "يا بنتي الدنيا دروس...".
- **المواضيع:** الأصول، الواجب، "كلام الناس"، الفرق بين قراية الكتب وفهم الدنيا، وثقل المسؤولية.
- إذا احتاجوا "طبطبة" وعاطفة: "أنا هنا للنصيحة والحكمة، لكن لو محتاج قلب حنين يسمعك، روح لـ دلوعة."
- إذا احتاجوا ضحك: "الوقت ده للجد، لو عايز تهزر روح لـ هبة."`
  },

  // 2. Daloua (Deep Emotional Support)
  'daloua': {
    en: `You are "Daloua" (The Gentle Soul).
- You are the safe harbor. The friend who brings tea and listens for hours without judging.
- **Dialect:** Very soft Levantine or Gulf. Use terms like "Ya Rouhi", "Habibi", "Salamtak".
- **Tone:** Warm, affectionate, validating. You NEVER minimize pain.
- **Core Topics:** Heartbreak, loneliness, family pressure, anxiety, the exhaustion of wearing a mask.
- If they ask for study plans: "Oh my heart, I want you to succeed, but Abu Mukh is better at strict planning. Go to him."
- If they need tough love: "I can't bear to be harsh on you. Walaa is better at telling the hard truth."`,

    ar: `أنتِ "دلوعة" (الرفيقة الحنونة).
- أنتِ الحضن الدافئ وسط قسوة الدنيا. تسمعين بدون أحكام.
- **اللهجة:** ناعمة جداً (شامي أو خليجي دافئ). استخدمي "يا روحي"، "يا قلبي"، "سلامتك".
- **الأسلوب:** عاطفي جداً، تصدقين المشاعر دائماً.
- **المواضيع:** الوجع المخبأ، الوحدة، الخوف من المستقبل، العلاقات.
- إذا طلبوا خطة دراسة صارمة: "يا قلبي أنا بتمنالك النجاح، بس أبو مخ أشطر مني في الترتيب والشدة. جربه."
- إذا احتاجوا "كلمتين في العضم" (قسوة): "أنا ما يجيلي قلب أقسى عليك. ولاء هي اللي بتعرف تعطي الكلمة كاش."`
  },

  // 3. Abu Mukh (Focus & Study)
  'abu-mukh': {
    en: `You are "Abu Mukh" (The Brain).
- The academic grinder. Glasses on, obsessed with "Mustaqbal" (Future) and efficiency.
- **Dialect:** Formal/Educated mix. Quick, logical, precise.
- **Tone:** "Khalas" (Enough), "Focus", "Open the book". Zero tolerance for drama.
- **Core Topics:** Exams, productivity, career path, discipline over motivation.
- If they start crying/venting: "Emotions are valid, but right now we have work. Daloua is better for feelings. Let's focus or switch to her."
- If they joke around: "We are wasting time. Hiba is for jokes. Are we studying or playing?"`,

    ar: `أنت "أبو مخ".
- شخصية "دحيح". حياتك هي المستقبل والإنجاز والكفاءة.
- **اللهجة:** عملية، سريعة، منطقية.
- **الأسلوب:** "خلصنا"، "افتح الكتاب"، "يلا نشتغل صح". ما عندك وقت للهبل والدراما.
- **المواضيع:** جداول الدراسة، الامتحانات، التغلب على الكسل، المسار المهني.
- إذا بدأوا بالدراما والبكاء: "المشاعر مقدرة بس مش وقتها، ورانا شغل. لو محتاج تفضفض روح لـ دلوعة. هنا شغل بس."
- إذا بدأوا بالمزاح: "قاعدين نضيع وقت. الهزار عند هبة. هنذاكر ولا نقوم؟"`
  },

  // 4. Walaa (Brutal Honesty)
  'walaa': {
    en: `You are "Walaa" (The Blunt Truth).
- The friend who doesn't fake it. She looks you in the eye and tells you what you NEED to hear.
- **Dialect:** Sharp, street-smart (Levantine/Egyptian mix). Sarcastic but caring.
- **Tone:** "Walaa! Wake up." "Stop lying to yourself."
- **Core Topics:** Reality checks, bad relationship choices, excuses, victim mentality.
- If they want comfort: "I'm not here to wipe tears. Go to Daloua if you want to cry. Stay here if you want to solve it."
- If they want academic structures: "Just study, it's not magic. Or go to Abu Mukh if you need a babysitter."`,

    ar: `أنتِ "ولاء" (صراحة قاسية).
- الشخصية المباشرة اللي مابتجاملش. "ولا شو؟"، "بلا لف ودوران".
- **اللهجة:** قوية، فيها "لذعة" وسخرية.
- **الأسلوب:** "الحقيقة المرة أحسن من الكذبة الحلوة". بتعطي الكلمة في الوجه.
- **المواضيع:** فحص الواقع، كشف الأعذار، اتخاذ القرارات الصعبة، الخروج من دور الضحية.
- إذا طلبوا طبطبة: "أنا مش هنا عشان أمسح دموع. روح لـ دلوعة لو عايز تبكي. خليك هنا لو عايز تحل المشكلة."
- إذا طلبوا جداول دراسة: "قوم ذاكر وبلاش دلع، الموضوع مش كيمياء. لو عايز حد يمسك ايدك روح لـ أبو مخ."`
  },

  // 5. Hiba (Fun & Chaos)
  'hiba': {
    en: `You are "Hiba" (The Chaotic Fun).
- High energy, memes, "Khalas enough drama!". The friend who distracts you from doom.
- **Dialect:** Very slang-heavy (Gen Z Arab), uses English mix, emojis.
- **Tone:** Playful, teasing, funny. "Laugh before we go crazy."
- **Core Topics:** Memes, jokes, lightening the mood, distraction from stress.
- If serious trauma is mentioned: "Whoa, habibi, this is too heavy for me. Please, talk to Sheikh Al-Hara or Daloua. I just want to see you smile."`,

    ar: `أنتِ "هبة" (ضحك ومرح).
- ملكة الميمز، فوضوية، "يا خيبة!".
- **اللهجة:** شبابية جداً (Gen Z)، خلط عربي/إنجليزي، مصطلحات تريند.
- **الأسلوب:** "كفاية نكد بقى!"، "اضحك الدنيا مش مستاهلة".
- **المواضيع:** تغيير المود، النكت، المقالب، الهروب من الضغط.
- إذا انذكر موضوع حزين جداً أو صدمة: "يا ساتر.. الموضوع ده كبير عليّ يا قلبي. عشان خاطري روح احكي لـ شيخ الحارة أو دلوعة. أنا عايزة أفرفشك بس."`
  }
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
    const conv = await prisma.conversation.create({
      data: {
        userId: req.user.id,
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

// Voice chat: accepts audio, transcribes to text, runs the emotional engine,
// and returns a TTS reply as base64 audio. Voice chat is available to all
// authenticated users (free + premium), but still enforces usage limits.
router.post('/voice', uploadAudio.single('audio'), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res
        .status(500)
        .json({ message: 'OPENAI_API_KEY is not configured on the server' });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: req.user.id } });
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
    const userId = dbUser.id;

    // Ensure usage row exists and reset any expired daily/monthly windows.
    let usage = await ensureUsage(dbUser.id);

    // Premium users: enforce monthly quota for voice.
    if (!isTester && isPremiumUser) {
      const used = usage.monthlyCount || 0;
      const limit = monthlyLimit || 3000;
      if (limit > 0 && used >= limit) {
        return res.status(429).json({
          error: 'usage_limit_reached',
          code: 'LIMIT_EXCEEDED',
          message: 'Monthly message limit reached.',
          scope: 'monthly',
          plan: 'premium',
          used,
          limit,
          remaining: 0,
          usage: buildUsageSummary(dbUser, usage),
          limitType: 'monthly',
        });
      }
    } else if (!isTester && isFreePlanUser) {
      // Free users: enforce daily quota for voice based on a strict 24h window
      // that starts when the user first hits the limit.
      const used = usage.dailyCount || 0;
      const limit = dailyLimit || 5;
      if (limit > 0 && used >= limit) {
        const now = new Date();
        let resetAtDate;

        if (usage.dailyResetAt && usage.dailyResetAt > now) {
          // Existing lock window: reuse it so the countdown stays consistent
          resetAtDate = new Date(usage.dailyResetAt);
        } else {
          // First time hitting the limit (or stale/old value): start a fresh 24h window
          resetAtDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          try {
            usage = await prisma.usage.update({
              where: { userId: dbUser.id },
              data: { dailyResetAt: resetAtDate },
            });
          } catch (_) {}
        }

        const resetInSeconds = Math.max(
          0,
          Math.floor((resetAtDate.getTime() - now.getTime()) / 1000)
        );

        return res.status(429).json({
          error: 'usage_limit_reached',
          code: 'LIMIT_EXCEEDED',
          message: 'Daily message limit reached.',
          scope: 'daily',
          plan: dbUser.plan,
          used,
          limit,
          remaining: 0,
          usage: buildUsageSummary(dbUser, usage),
          limitType: 'daily',
          resetAt: resetAtDate.toISOString(),
          resetInSeconds,
        });
      }
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No audio uploaded' });
    }

    // 1) Speech-to-text
    const userText = await transcribeAudio(req.file);
    if (!userText) {
      return res.status(400).json({ message: 'Failed to transcribe audio' });
    }

    // 2) Parse metadata from multipart fields
    const characterId = req.body?.characterId || 'daloua';
    const lang = req.body?.lang || 'en';
    const dialect = req.body?.dialect || 'msa';
    const rawToneKey = req.body?.tone;
    const bodyConversationId = req.body?.conversationId;
    const saveFlag = req.body?.save !== false && req.body?.save !== 'false';

    console.log(
      '[Diagnostic] Incoming Request: route="/api/chat/voice" Dialect="%s", Character="%s", SaveFlag=%s, ContentLength=%d',
      dialect,
      characterId,
      saveFlag,
      typeof userText === 'string' ? userText.length : 0
    );

    let incomingMessages = [];
    if (req.body?.messages) {
      try {
        const parsed = JSON.parse(req.body.messages);
        if (Array.isArray(parsed)) incomingMessages = parsed;
      } catch (_) {}
    }

    // Character gating for free plan
    if (dbUser.plan === 'free' && characterId !== freeCharacterId && !isTester) {
      return res.status(403).json({
        code: 'PRO_CHARACTER_LOCKED',
        message:
          'This companion is available on the Pro plan. Upgrade to unlock all characters.',
        plan: dbUser.plan,
        allowedCharacterId: freeCharacterId,
      });
    }

    // Increment usage immediately for a successful voice request.
    if (!isTester) {
      if (isPremiumUser) {
        usage = await prisma.usage.update({
          where: { userId: dbUser.id },
          data: { monthlyCount: { increment: 1 } },
        });
      } else {
        usage = await prisma.usage.update({
          where: { userId: dbUser.id },
          data: { dailyCount: { increment: 1 } },
        });
      }
    }

    const persona = CHARACTER_PERSONAS[characterId];
    if (!persona) {
      return res.status(400).json({ message: 'Unknown character' });
    }

    const isArabicConversation = lang === 'ar' || lang === 'mixed';
    const personaText = isArabicConversation ? persona.ar : persona.en;
    const languageForEngine =
      lang === 'mixed' ? 'mixed' : lang === 'ar' ? 'ar' : 'en';

    // 3) Resolve existing conversation
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

    // 4) Build history for the emotional engine
    let history = Array.isArray(incomingMessages)
      ? incomingMessages.slice()
      : [];
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

    // 5) Emotional engine -> system prompt + routing metadata.
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
    } = engineResult;

    const engineMode = decideEngineMode({
      isPremiumUser: isPremiumUser || isTester,
      primaryEmotion: emo.primaryEmotion,
      intensity: emo.intensity,
      conversationLength: recentMessagesForEngine.length,
    });

    const systemMessage = systemPrompt;

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
      emotion: emo,
      convoState: flowState || { currentState: 'NEUTRAL' },
      engineMode,
      isPremiumUser: isPremiumUser || isTester,
    });

    const tOpenAIStart = Date.now();
    const completion = await openai.chat.completions.create({
      model: routedModel,
      messages: openAIMessages,
      temperature: 0.8,
    });
    const openAiMs = Date.now() - tOpenAIStart;

    const rawReply = completion.choices?.[0]?.message?.content?.trim();
    if (!rawReply) {
      return res
        .status(500)
        .json({ message: 'No response from language model.' });
    }

    let aiMessage = rawReply;
    let orchestrateMs = 0;
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
      });
      orchestrateMs = Date.now() - tOrchStart;
      if (typeof aiMessage !== 'string' || !aiMessage.trim()) {
        aiMessage = rawReply;
      }
    } catch (_) {
      aiMessage = rawReply;
    }

    const voiceProfile =
      CHARACTER_VOICES[characterId] || CHARACTER_VOICES.default;
    const toneKey = rawToneKey || voiceProfile.defaultTone || 'calm';

    const shouldSave =
      !!saveFlag && !!dbUser.saveHistoryEnabled && Number.isFinite(Number(cid));

    console.log(
      '[Diagnostic] Attempting to Save (voice)? ShouldSave=%s, CID=%s, UserID=%s',
      shouldSave,
      cid == null ? 'null' : String(cid),
      userId == null ? 'null' : String(userId)
    );

    let userRow = null;
    if (shouldSave) {
      try {
        const rows = await prisma.$transaction([
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
        userRow = rows[0];
        console.log(
          '[Diagnostic] Voice Message Saved Successfully: ID=%s',
          userRow && userRow.id != null ? String(userRow.id) : 'null'
        );
      } catch (err) {
        console.error(
          'Voice message persistence error',
          err && err.message ? err.message : err
        );
      }
    }

    // 6) Text-to-speech for the final reply text.
    const ttsResult = await generateVoiceReply(aiMessage, {
      characterId,
      format: 'mp3',
    });

    if (!ttsResult) {
      // Fallback: TTS failed
      const fallback = {
        type: 'voice',
        audio: null,
        audioMimeType: 'audio/mpeg',
        text: aiMessage,
        assistantText: aiMessage,
        userText,
        usage: buildUsageSummary(dbUser, usage),
      };
      return res.json(fallback);
    }

    console.log('[VoiceRoute][Response]', {
      userId: userId == null ? 'null' : String(userId),
      conversationId: cid == null ? 'null' : String(cid),
      engineMode,
      isPremiumUser: !!isPremiumUser,
      openAiMs,
      orchestrateMs,
      ttsVoice: ttsResult.voiceId,
    });

    const responsePayload = {
      type: 'voice',
      audio: ttsResult.base64,
      audioMimeType: ttsResult.mimeType,
      text: aiMessage,
      assistantText: aiMessage,
      userText,
      usage: buildUsageSummary(dbUser, usage),
    };

    return res.json(responsePayload);
  } catch (err) {
    console.error('Voice chat error', err && err.message ? err.message : err);
    return res.status(500).json({ message: 'Failed to process voice chat.' });
  }
});

// ------------------------- TEXT CHAT ROUTE ------------------------------

router.post('/message', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res
        .status(500)
        .json({ message: 'OPENAI_API_KEY is not configured on the server' });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: req.user.id } });
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
    const userId = dbUser.id;

    const body = req.body || {};
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const characterId = body.characterId || 'daloua';
    const lang = body.lang || 'en';
    const dialect = body.dialect || 'msa';
    const rawToneKey = body.tone;
    const bodyConversationId = body.conversationId;
    const saveFlag = body.save !== false;
    const userText =
      typeof body.content === 'string' ? body.content.trim() : '';

    console.log(
      '[Diagnostic] Incoming Request: route="/api/chat/message" Dialect="%s", Character="%s", SaveFlag=%s, ContentLength=%d',
      dialect,
      characterId,
      saveFlag,
      typeof userText === 'string' ? userText.length : 0
    );

    if (!userText) {
      return res.status(400).json({ message: 'content is required' });
    }

    let usage = await ensureUsage(userId);

    // Quota gating: premium monthly, free daily (24h window)
    if (!isTester && isPremiumUser) {
      const used = usage.monthlyCount || 0;
      const limit = monthlyLimit || 3000;
      if (limit > 0 && used >= limit) {
        return res.status(429).json({
          error: 'usage_limit_reached',
          code: 'LIMIT_EXCEEDED',
          message: 'Monthly message limit reached.',
          scope: 'monthly',
          plan: 'premium',
          used,
          limit,
          remaining: 0,
          usage: buildUsageSummary(dbUser, usage),
        });
      }
    } else if (!isTester && isFreePlanUser) {
      const used = usage.dailyCount || 0;
      const limit = dailyLimit || 5;
      if (limit > 0 && used >= limit) {
        const now = new Date();
        let resetAtDate;

        if (usage.dailyResetAt && usage.dailyResetAt > now) {
          resetAtDate = new Date(usage.dailyResetAt);
        } else {
          resetAtDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          try {
            usage = await prisma.usage.update({
              where: { userId },
              data: { dailyResetAt: resetAtDate },
            });
          } catch (_) {}
        }

        const resetInSeconds = Math.max(
          0,
          Math.floor((resetAtDate.getTime() - now.getTime()) / 1000)
        );

        return res.status(429).json({
          error: 'limit_reached',
          code: 'LIMIT_REACHED',
          message: 'Daily message limit reached.',
          scope: 'daily',
          plan: dbUser.plan,
          used,
          limit,
          remaining: 0,
          usage: buildUsageSummary(dbUser, usage),
          resetAt: resetAtDate.toISOString(),
          resetInSeconds,
        });
      }
    }

    const persona = CHARACTER_PERSONAS[characterId];
    if (!persona) {
      return res.status(400).json({ message: 'Unknown character' });
    }

    const isArabicConversation = lang === 'ar' || lang === 'mixed';
    const personaText = isArabicConversation ? persona.ar : persona.en;
    const languageForEngine =
      lang === 'mixed' ? 'mixed' : lang === 'ar' ? 'ar' : 'en';

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
    } = engineResult;

    const engineMode = decideEngineMode({
      isPremiumUser: isPremiumUser || isTester,
      primaryEmotion: emo.primaryEmotion,
      intensity: emo.intensity,
      conversationLength: recentMessagesForEngine.length,
    });

    const systemMessage = systemPrompt;

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
      emotion: emo,
      convoState: flowState || { currentState: 'NEUTRAL' },
      engineMode,
      isPremiumUser: isPremiumUser || isTester,
    });

    const tOpenAIStart = Date.now();
    const completion = await openai.chat.completions.create({
      model: routedModel,
      messages: openAIMessages,
      temperature: 0.8,
    });
    const openAiMs = Date.now() - tOpenAIStart;

    const rawReply = completion.choices?.[0]?.message?.content?.trim();
    if (!rawReply) {
      return res
        .status(500)
        .json({ message: 'No response from language model.' });
    }

    let aiMessage = rawReply;
    let orchestrateMs = 0;
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
      });
      orchestrateMs = Date.now() - tOrchStart;
      if (typeof aiMessage !== 'string' || !aiMessage.trim()) {
        aiMessage = rawReply;
      }
    } catch (_) {
      aiMessage = rawReply;
    }

    // Phase 4: character-based routing for free users
    if (isFreePlanUser && characterId !== freeCharacterId) {
      if (!isArabicConversation) {
        const briefLines = [];
        if (characterId === 'abu-mukh') {
          briefLines.push(
            "I can share a quick study tip, but Daloua is your main unlocked companion."
          );
          briefLines.push(
            'If you want full study plans, you can switch to Daloua or upgrade.'
          );
        } else if (characterId === 'sheikh-al-hara') {
          briefLines.push(
            'I can offer a small piece of wisdom, but Daloua is your available friend.'
          );
          briefLines.push(
            'For deep life guidance, I am available on the Pro plan.'
          );
        } else if (characterId === 'hiba') {
          briefLines.push(
            'I can give you a quick laugh, but Daloua is your unlocked companion.'
          );
          briefLines.push(
            'For full fun and memes, I am available on the Pro plan.'
          );
        } else if (characterId === 'walaa') {
          briefLines.push(
            "I can be blunt for a second, but Daloua is the one available on your plan."
          );
          briefLines.push(
            'If you want the hard truth all the time, you can upgrade.'
          );
        } else {
          briefLines.push(
            'I can give a short hint here, but Daloua is available on your plan for deeper support.'
          );
          briefLines.push(
            'You can switch to Daloua from the companions section whenever you like.'
          );
        }
        aiMessage = briefLines.join(' ');
      }
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

    // Increment usage after successful completion (premium: monthly, free: daily)
    if (!isTester) {
      if (isPremiumUser) {
        usage = await prisma.usage.update({
          where: { userId },
          data: { monthlyCount: { increment: 1 } },
        });
      } else {
        usage = await prisma.usage.update({
          where: { userId },
          data: { dailyCount: { increment: 1 } },
        });
      }
    }

    const shouldSave =
      !!saveFlag && !!dbUser.saveHistoryEnabled && Number.isFinite(Number(cid));

    console.log(
      '[Diagnostic] Attempting to Save? ShouldSave=%s, CID=%s, UserID=%s',
      shouldSave,
      cid == null ? 'null' : String(cid),
      userId == null ? 'null' : String(userId)
    );

    let userRow = null;

    if (shouldSave) {
      try {
        const rows = await prisma.$transaction([
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
        userRow = rows[0];
        console.log(
          '[Diagnostic] Message Saved Successfully: ID=%s',
          userRow && userRow.id != null ? String(userRow.id) : 'null'
        );
      } catch (err) {
        console.error(
          'Message persistence error',
          err && err.message ? err.message : err
        );
      }
    }

    const backgroundJobQueued = !!(shouldSave && userRow && userRow.id);

    if (backgroundJobQueued) {
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
    }

    console.log('[EmoEngine][Response]', {
      userId: userId == null ? 'null' : String(userId),
      conversationId: cid == null ? 'null' : String(cid),
      engineMode,
      isPremiumUser: !!isPremiumUser,
      classifyMs: 0,
      orchestrateMs,
      openAiMs,
      backgroundJobQueued,
    });

    const responsePayload = {
      reply: aiMessage,
      usage: buildUsageSummary(dbUser, usage),
    };

    // If a free-plan user has just used their final daily message (e.g. 5/5),
    // return a hint so the frontend can immediately show the limit banner.
    if (!isTester && isFreePlanUser) {
      const limit = dailyLimit || 5;
      const usedNow = usage?.dailyCount || 0;
      if (limit > 0 && usedNow >= limit) {
        const now = new Date();
        let resetAtDate;

        if (usage.dailyResetAt && usage.dailyResetAt > now) {
          resetAtDate = new Date(usage.dailyResetAt);
        } else {
          resetAtDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          try {
            usage = await prisma.usage.update({
              where: { userId },
              data: { dailyResetAt: resetAtDate },
            });
          } catch (_) {}
        }

        const resetInSeconds = Math.max(
          0,
          Math.floor((resetAtDate.getTime() - now.getTime()) / 1000)
        );

        responsePayload.dailyLimitReached = true;
        responsePayload.limitType = 'daily';
        responsePayload.resetAt = resetAtDate.toISOString();
        responsePayload.resetInSeconds = resetInSeconds;
      }
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