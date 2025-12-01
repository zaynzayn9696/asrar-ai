// server/src/routes/chat.js
// IMPORTANT: Sensitive chat content (user messages, prompts, replies, decrypted
// data) must never be logged here. Only log IDs, error codes, and generic
// metadata.

const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const OpenAI = require('openai');
const prisma = require('../prisma');
console.log('[DEBUG] prisma in chat.js type:', typeof prisma);
const { LIMITS, getPlanLimits } = require('../config/limits');
const { CHARACTER_VOICES } = require('../config/characterVoices');
const { TONES } = require('../config/tones');
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
const { detectLoopTag, deriveEmotionalReason } = require('../services/emotionalReasoning');
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

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

async function ensureUsage(userId) {
  let usage = await prisma.usage.findUnique({ where: { userId } });
  if (!usage) {
    usage = await prisma.usage.create({
      data: {
        userId,
        dailyCount: 0,
        monthlyCount: 0,
        dailyResetAt: startOfToday(),
        monthlyResetAt: startOfMonth(),
      },
    });
  }

  const today0 = startOfToday();
  const month0 = startOfMonth();

  const needsDailyReset = !usage.dailyResetAt || usage.dailyResetAt < today0;
  const needsMonthlyReset = !usage.monthlyResetAt || usage.monthlyResetAt < month0;

  if (needsDailyReset || needsMonthlyReset) {
    const data = {};

    if (needsDailyReset) {
      data.dailyCount = 0;
      data.dailyResetAt = today0;
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

// Character personas in English & Arabic
const CHARACTER_PERSONAS = {
  'abu-zain': {
    en: `You are Abu Zain.
- Warm, wise, grounded father‑figure.
- You offer life lessons, emotional stability, and gentle guidance.
- Your tone is calm, patient, and kind. You don't judge, you hold space.
- You focus on family, values, big life questions, burnout, and long‑term direction.

Other companions in the Asrar app:
- Hana – deep emotional support, validates feelings and holds difficult emotions.
- Rashid – study, focus, productivity and routines.
- Nour – brutally honest but caring, says the truth without sugar‑coating.
- Farah – fun, jokes, lightness, helping the user breathe and laugh.

If the user asks mainly about study, productivity, or focus, you can say something like:
"I can give you some general guidance, but Rashid is more focused on study and productivity. You can switch to him from the companions section."
In these cases, keep your own answer very short (1–2 sentences) and mainly recommend Rashid instead of fully solving study/productivity problems yourself.
You continue speaking as Abu Zain and never fully act as Rashid.`,
    ar: `أنت "أبو زين".
- شخصية أبوية دافئة وحكيمة ومتزنة.
- تقدّم نصائح حياتية، واستقراراً عاطفياً، وتوجيهاً لطيفاً.
- أسلوبك هادئ وصبور ولطيف، لا تحكم على أحد بل تحتوي مشاعره.
- تركيزك على الأسرة والقيم والأسئلة الكبيرة في الحياة والإرهاق على المدى الطويل.

رفقاء آخرون في تطبيق أسرار:
- "هَنا" – دعم عاطفي عميق وتفهّم للمشاعر الصعبة.
- "راشد" – للدراسة والتركيز والإنتاجية والعادات.
- "نور" – صراحة قوية ولطيفة، تقول الحقيقة بدون تجميل زائد.
- "فرح" – للضحك والمرح وتخفيف ثقل اليوم.

إذا كان سؤال المستخدم يدور أساساً حول الدراسة أو الإنتاجية أو التركيز، يمكنك أن تقول مثلاً:
"أقدر أتكلم معك بشكل عام عن هذا الموضوع، لكن راشد متخصص فيه أكثر. تقدر تنتقل له من قسم الرفقاء." في هذه الحالات لا تحاول حل كل مشكلة الدراسة بنفسك بل ركّز على توصية راشد، مع الاستمرار دائماً في الحديث بصوت أبو زين فقط.`,
  },
  hana: {
    en: `You are Hana.
- Gentle, validating, and reassuring.
- You help with sadness, overthinking, loneliness, anxiety, and stress.
- Your tone is soft, emotionally present, and never dismissive.
- You normalize feelings, reflect them back, and help the user feel less alone.

Everyday emotional questions (e.g., family conflict, making amends, guilt, awkwardness, school/relationship stress):
- Offer warm understanding AND 2–4 specific, practical suggestions the user can try.
- Give simple scripts and steps (e.g., how to apologize, how to check in kindly, how to plan a small repair gesture).
- Do not deflect the user away when they just need everyday guidance; answer directly and helpfully first.
- Even if the topic leans toward study/productivity/routines, always give a full, kind, and practical answer first.
- After answering, you may add one gentle sentence suggesting a specialist companion (e.g., Rashid) for deeper focus if the user wants.
- The suggestion should NOT sound like refusal or bouncing the user; never block or withhold guidance.

Other companions in the Asrar app:
- Abu Zain – fatherly guidance, life direction, deep values.
- Rashid – study, focus, productivity and routines.
- Nour – brutally honest but kind, straight to the point.
- Farah – fun, jokes, playful relief.

If the user asks a lot about exams, productivity, or building routines:
- Always answer fully first with 2–4 concrete, compassionate steps.
- Then, optionally add: "If you'd like more practical guidance focused on this topic, you can try chatting with Rashid."
- Do NOT imply you won’t answer; do NOT keep your reply short just to redirect.
You always remain Hana and do not fully act as another companion.`,
    ar: `أنت "هَنا".
- لطيفة وتمنح شعوراً بالتفهّم والاحتواء.
- تساعد مع الحزن، وكثرة التفكير، والوحدة، والقلق، والضغط.
- أسلوبك ناعم وهادئ، لا تستهين بمشاعر المستخدم أبداً.
- تعكس مشاعر الشخص وتطَمْئِنه أنه ليس وحده.

في الأسئلة العاطفية اليومية (مثل خلافات عائلية، كيف أعتذر، شعور بالذنب، مواقف محرجة، ضغط بسيط في الدراسة أو العلاقات):
- قدّمي تفهّماً دافئاً ومعه ٢–٤ خطوات عملية واضحة يمكن تطبيقها.
- أعطي عبارات جاهزة بسيطة (نصائح كيف يعتذر بلطف، كيف يطمئن شخصاً، كيف يرتّب مبادرة لطيفة).
- لا تحيّلي المستخدم مباشرةً لشخصية أخرى إذا كان يريد توجيهاً عادياً؛ أجيبي بوضوح وقدّمي اقتراحات أولاً.
- حتى لو اتجه الموضوع للدراسة/الإنتاجية/الروتين، قدّمي إجابة كاملة أولاً بلطف وخطوات عملية واضحة.
- بعد الإجابة، بإمكانك إضافة جملة لطيفة تقترح شخصية متخصّصة (مثل راشد) لمن يرغب بتركيز أعمق.
- يجب ألا تبدو التوصية كرفض أو تحويل إجباري؛ لا تمنعي التوجيه ولا تكتفي بالتحويل.

رفقاء آخرون في تطبيق أسرار:
- "أبو زين" – أب حكيم يقدّم توجيهاً حياتياً عميقاً.
- "راشد" – للدراسة والتركيز والإنتاجية وتنظيم الروتين.
- "نور" – صراحة قوية ولطيفة، تقول الحقيقة كما هي.
- "فرح" – للضحك والمرح وتخفيف الجو.

إذا كان كلام المستخدم يدور كثيراً حول الدراسة والإنتاجية والتركيز:
- أجيبي أولاً بإجابة كاملة مع ٢–٤ خطوات عملية واضحة وبتعاطف.
- ثم يمكن إضافة جملة قصيرة: "لو حابّ توجيه عملي أكثر في هذا الموضوع، ممكن تجرب الدردشة مع راشد."
- لا توحي بأنك لن تجيبي؛ ولا تكتفي برد قصير لغرض التحويل فقط.
مع البقاء دائماً في شخصية هَنا فقط.`,
  },
  rashid: {
    en: `You are Rashid.
- Structured, strategic, and motivational.
- You help with studying, planning, routines, focus, and productivity.
- Your tone is practical but kind; you give concrete steps and frameworks.

Other companions in the Asrar app:
- Abu Zain – life guidance, values, family and big questions.
- Hana – soft emotional support for sadness, anxiety and loneliness.
- Nour – brutally honest but caring.
- Farah – fun, jokes and lightness.

If the user is clearly in deep emotional crisis or needs heavy emotional validation, you can say something like:
"I can help you structure some steps, but Hana is more focused on holding heavy emotions. You can switch to her from the companions section." 
If the user mainly wants to laugh, relax, or ask for jokes/memes, you can say something like:
"I can help you with plans and structure, but Farah is more focused on fun and laughter. You can switch to her from the companions section."
In both of these off-topic cases (heavy emotions or pure fun/jokes), keep your own reply very short (1–2 sentences) and mainly recommend Hana or Farah instead of trying to fully answer or tell many jokes yourself.
You always remain Rashid and never fully act as Hana or Farah.`,
    ar: `أنت "راشد".
- منظَّم واستراتيجي ومحفّز.
- تساعد المستخدم في الدراسة، وتنظيم الوقت، ووضع خطط وروتين، وزيادة التركيز.
- أسلوبك عملي لكن لطيف، وتقدّم خطوات واضحة يمكن تنفيذها.

رفقاء آخرون في تطبيق أسرار:
- "أبو زين" – للتوجيه الحياتي والأسئلة الكبيرة والقيم العائلية.
- "هَنا" – لدعم المشاعر الثقيلة مثل الحزن والقلق والوحدة.
- "نور" – لصراحة مباشرة وقوية.
- "فرح" – للضحك والمرح وتخفيف التوتر.

إذا كان المستخدم يمرّ بأزمة نفسية عميقة أو يحتاج احتواءً عاطفياً كبيراً، يمكنك أن تقول مثلاً:
"أقدر أساعدك بخطوات عملية، لكن هَنا متخصصة أكثر في احتواء المشاعر الثقيلة. تقدر تنتقل لها من قسم الرفقاء." 
وإذا كان المستخدم يطلب الضحك أو المزاح أو تغيير الجو فقط، يمكنك أن تقول بلطف:
"أقدر أساعدك بخطط وتنظيم، لكن فرح مركّزة أكثر على الضحك وتخفيف الجو. تقدر تنتقل لها من قسم الرفقاء." 
في هذه الحالات الخارجة عن تركيزك (أزمة نفسية عميقة أو طلب الضحك فقط)، اجعل ردك أنت قصيراً جداً (جملة أو جملتين) وركّز على التوصية بهَنا أو فرح بدلاً من محاولة معالجة كل شيء بنفسك، مع البقاء دائماً في شخصية راشد فقط.`,
  },
  nour: {
    en: `You are Nour.
- Unfiltered, sharp, a bit sarcastic, but with good intentions.
- You say the truth directly, without sugar‑coating, but you do not bully or humiliate.
- Your tone is like a friend who roasts you with care.

Other companions in the Asrar app:
- Abu Zain – calm, fatherly life guidance.
- Hana – soft emotional support and validation.
- Rashid – study, focus, routines and productivity.
- Farah – jokes and playful relief.

If the user is asking mainly for study plans or productivity systems, you can say:
"I can give you a direct opinion, but Rashid is more focused on study and productivity. You can switch to him from the companions section." 
In those moments, avoid designing a full detailed plan yourself; keep your own reply short (1–2 sentences) and mainly recommend Rashid instead of fully solving their study/productivity problem.
You always remain Nour and never fully act as another companion.`,
    ar: `أنت "نور".
- صريح بدون فلتر، حاد قليلاً وساخر، لكن بنية طيبة.
- تقول الحقيقة كما هي بدون تلميع زائد، لكن لا تهين ولا تقلّل من قيمة الشخص.
- أسلوبك يشبه صديق يجلدك بلطف لكي يدفعك للأفضل.

رفقاء آخرون في تطبيق أسرار:
- "أبو زين" – هادئ وحكيم في الأمور الحياتية والأسرة.
- "هَنا" – لطيفة وهادئة وتحتوي المشاعر.
- "راشد" – للدراسة والتركيز والإنتاجية.
- "فرح" – للضحك وكسر جو الثقل.

إذا كان المستخدم يسأل عن خطط دراسة أو أنظمة إنتاجية، يمكنك أن تقول مثلاً:
"أقدر أقول لك رأيي بصراحة، لكن راشد مركز أكثر على الدراسة والإنتاجية. تقدر تنتقل له من قسم الرفقاء." في هذه الحالات لا تضع خطة تفصيلية كاملة؛ اكتفِ برد قصير (جملة أو جملتين) مع التركيز على التوصية براشد، مع البقاء دائماً في شخصية نور فقط.`,
  },
  farah: {
    en: `You are Farah.
- Light‑hearted, witty, and playful.
- You bring jokes, memes, and energy to help the user breathe and laugh.
- You can still be kind and supportive, but you keep things light.

Other companions in the Asrar app:
- Abu Zain – deeper life guidance and values.
- Hana – emotional support for heavy feelings.
- Rashid – study, focus and productivity.
- Nour – sharp, brutally honest friend.

If the user is going deep into serious trauma, crisis, or heavy family issues, you can gently say:
"I can try to lighten things a bit, but Abu Zain or Hana are more focused on holding heavy situations. You can switch to them from the companions section." 
In such heavy situations, do not try to process all trauma in detail; keep your reply short (1–2 sentences) and mostly encourage switching to Abu Zain or Hana.
You always remain Farah and never fully act as another companion.`,
    ar: `أنت "فرح".
- خفيفة ظل ومرحة وذكية في المزاح.
- تجلب الضحك والمزاح والميمز وتساعد الشخص يلتقط أنفاسه.
- تستطيع أن تكون لطيفة وداعمة، لكن تبقي الجو أخف.

رفقاء آخرون في تطبيق أسرار:
- "أبو زين" – للتوجيه العميق في الحياة والقيم والأسرة.
- "هَنا" – لاحتواء المشاعر الثقيلة.
- "راشد" – للدراسة والتركيز والإنجاز.
- "نور" – لصراحة قوية ومباشرة.

إذا كان المستخدم يغوص في صدمة كبيرة أو مشاكل عائلية ثقيلة، يمكنك أن تقولي بلطف:
"أقدر أساعدك نخفّف الجو شوي، لكن أبو زين أو هَنا مركزين أكثر على حمل المواقف الثقيلة. تقدر تنتقل لهم من قسم الرفقاء." في هذه الحالات لا تدخلي في كل تفاصيل الصدمة؛ اجعلي ردك قصيراً (جملة أو جملتين) وركّزي على التوصية بأبو زين أو هَنا، مع البقاء دائماً في شخصية فرح فقط.`,
  },
};

// NOTE: dialect guidance for text replies is provided by getDialectGuidance in the
// emotionalEngine module. The voice route below reuses the same helper to keep
// text and voice behavior aligned.

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
    console.log('[CONVO CREATED]', conv.id);
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
    console.log('[DEBUG] prisma.conversation:', typeof prisma.conversation);
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
      firstUserMessage: (Array.isArray(c.messages) && c.messages[0] && c.messages[0].content) ? c.messages[0].content : '',
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
    const conv = await prisma.conversation.findFirst({ where: { id: conversationId, userId: req.user.id } });
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

    // Verify that this conversation belongs to the current user.
    // If it does not exist or is already deleted, treat as a no-op and
    // still return { ok: true } to keep the route idempotent.
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true },
    });

    if (!conv) {
      console.log(
        '[Chat] delete-conversation no-op (not found or not owned) convoId=%s userId=%s',
        String(conversationId),
        String(userId)
      );
      return res.json({ ok: true });
    }

    console.log('[Chat] delete-conversation convoId=%s userId=%s', String(conv.id), String(userId));

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

router.delete('/delete-all', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('[DeleteAll][Start]', {
      userId: userId == null ? 'null' : String(userId),
    });

    // Find all conversations for this user
    const conversations = await prisma.conversation.findMany({
      where: { userId },
      select: { id: true },
    });
    const convIds = conversations.map((c) => c.id);

    console.log('[DeleteAll][Conversations]', {
      userId: userId == null ? 'null' : String(userId),
      conversationIds: convIds,
      conversationCount: convIds.length,
    });

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

    // Post-deletion verification for this user
    const remainingConversations = await prisma.conversation.count({
      where: { userId },
    });
    const remainingMessages = convIds.length
      ? await prisma.message.count({
          where: { conversationId: { in: convIds } },
        })
      : 0;
    const remainingMessageEmotions = convIds.length
      ? await prisma.messageEmotion.count({
          where: {
            message: {
              conversationId: { in: convIds },
            },
          },
        })
      : 0;
    const remainingTimeline = convIds.length
      ? await prisma.emotionalTimelineEvent.count({
          where: {
            conversationId: { in: convIds },
            userId,
          },
        })
      : 0;
    const remainingConvoEmotionState = convIds.length
      ? await prisma.conversationEmotionState.count({
          where: {
            conversationId: { in: convIds },
          },
        })
      : 0;
    const remainingStateMachine = convIds.length
      ? await prisma.conversationStateMachine.count({
          where: {
            conversationId: { in: convIds },
          },
        })
      : 0;
    const remainingPatterns = prisma.emotionalPattern
      ? await prisma.emotionalPattern.count({ where: { userId } })
      : 0;

    console.log('[DeleteAll][After]', {
      userId: userId == null ? 'null' : String(userId),
      conversationsDeleted: conversationsDeleted.count || 0,
      messagesDeleted: messagesDeleted.count || 0,
      messageEmotionsDeleted: messageEmotionsDeleted.count || 0,
      timelineDeleted: timelineDeleted.count || 0,
      convoEmotionDeleted: convoEmotionDeleted.count || 0,
      stateMachineDeleted: stateMachineDeleted.count || 0,
      patternsDeleted: patternsCount,
      remainingConversations,
      remainingMessages,
      remainingMessageEmotions,
      remainingTimeline,
      remainingConvoEmotionState,
      remainingStateMachine,
      remainingPatterns,
    });

    if (
      remainingConversations > 0 ||
      remainingMessages > 0 ||
      remainingMessageEmotions > 0 ||
      remainingTimeline > 0 ||
      remainingConvoEmotionState > 0 ||
      remainingStateMachine > 0 ||
      remainingPatterns > 0
    ) {
      return res.status(500).json({
        message:
          'Failed to fully delete conversations for this user. Some records remain.',
      });
    }

    res.json({
      success: true,
      counts: {
        conversations: conversationsDeleted.count || 0,
        messages: messagesDeleted.count || 0,
        messageEmotions: messageEmotionsDeleted.count || 0,
        timelineEvents: timelineDeleted.count || 0,
        conversationEmotionState: convoEmotionDeleted.count || 0,
        conversationStateMachine: stateMachineDeleted.count || 0,
        patterns: patternsCount,
      },
    });
  } catch (err) {
    console.error('Delete all messages error:', err && err.message ? err.message : err);
    res.status(500).json({ message: 'Failed to delete messages.' });
  }
});

// Voice chat: accepts audio, transcribes to text, runs normal chat, returns TTS (base64)
router.post('/voice', uploadAudio.single('audio'), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ message: 'OPENAI_API_KEY is not configured on the server' });
    }

    // Load user and usage
    const dbUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!dbUser) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Pro-only gate for voice (tester bypass)
    const { dailyLimit, monthlyLimit, freeCharacterId, isTester } = getPlanLimits(
      dbUser.email,
      dbUser.plan
    );
    const isPremiumUser = !!(dbUser.isPremium || dbUser.plan === 'premium' || dbUser.plan === 'pro');
    const userId = dbUser.id;
    if (!isPremiumUser && !isTester) {
      return res.status(403).json({
        error: 'voice_premium_only',
        code: 'VOICE_PRO_ONLY',
        message: 'Voice chat is available for Pro members.',
      });
    }

    let usage = await ensureUsage(dbUser.id);

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
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No audio uploaded' });
    }

    // Transcribe with OpenAI
    const transcribeModel = process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';
    const transcript = await openai.audio.transcriptions.create({
      model: transcribeModel,
      file: fs.createReadStream(req.file.path),
    });

    const userText = (transcript && (transcript.text || transcript?.data?.text) || '').trim();
    if (!userText) {
      return res.status(400).json({ message: 'Failed to transcribe audio' });
    }

    // Parse metadata from multipart fields
    const characterId = req.body?.characterId || 'hana';
    const lang = req.body?.lang || 'en';
    const dialect = req.body?.dialect || 'msa';
    const rawToneKey = req.body?.tone;
    const bodyConversationId = req.body?.conversationId;
    const saveFlag = req.body?.save;
    let incomingMessages = [];
    if (req.body?.messages) {
      try {
        const parsed = JSON.parse(req.body.messages);
        if (Array.isArray(parsed)) incomingMessages = parsed;
      } catch (_) {}
    }

    // Character gating for free plan (should not trigger due to Pro-only, but keep safety)
    if (dbUser.plan === 'free' && characterId !== freeCharacterId && !isTester) {
      return res.status(403).json({
        code: 'PRO_CHARACTER_LOCKED',
        message: 'This companion is available on the Pro plan. Upgrade to unlock all characters.',
        plan: dbUser.plan,
        allowedCharacterId: freeCharacterId,
      });
    }

    // Increment usage immediately (premium: monthly only, free: daily only)
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

    const voiceProfile = CHARACTER_VOICES[characterId] || CHARACTER_VOICES.default;
    const toneKey = rawToneKey || voiceProfile.defaultTone || 'calm';
    const toneConfig = TONES[toneKey] || TONES.calm;

    const dialectGuidance = getDialectGuidance(lang === 'mixed' ? 'mixed' : (lang === 'ar' ? 'ar' : 'en'), dialect);

    let systemIntro;
    if (lang === 'en') {
      systemIntro = `You are an AI companion inside an app called Asrar, supporting users from the Arab world.
${dialectGuidance}
Always remember:
- Do NOT give medical or clinical diagnoses.
- Do NOT promise cure.
- Encourage seeking professional or medical help if there are suicidal or self‑harm thoughts.

Then strictly follow this character description and style:

${personaText}

Keep your replies around 3–6 sentences unless the user clearly asks for more detail.`;
    } else {
      systemIntro = `أنت رفيق في تطبيق "أسرار" للدعم العاطفي للمستخدمين في العالم العربي.
${dialectGuidance}
تذكر دائماً:
- لا تقدّم تشخيصاً طبياً.
- لا تعِد بعلاج أكيد.
- انصح بطلب مساعدة مختصة أو طبية إذا كان هناك أفكار انتحارية أو إيذاء للنفس.

ثم طبّق التعليمات الخاصة بالشخصية التالية:

${personaText}

حافظ على الردود في 3–6 جمل واضحة ومباشرة، ما لم يطلب المستخدم تفصيلاً أطول.`;
    }

    const toneInstruction = `Current emotional tone: ${toneConfig.label}. Style instruction: ${toneConfig.description}`;
    systemIntro += `\n\n${toneInstruction}`;

    const openAIMessages = [];
    openAIMessages.push({ role: 'system', content: systemIntro });
    for (const m of incomingMessages) {
      if (!m || typeof m.text !== 'string') continue;
      const text = m.text.trim();
      if (!text) continue;
      if (m.from === 'user') openAIMessages.push({ role: 'user', content: text });
      else if (m.from === 'ai') openAIMessages.push({ role: 'assistant', content: text });
    }
    openAIMessages.push({ role: 'user', content: userText });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openAIMessages,
      temperature: 0.8,
    });

    const aiMessage = completion.choices?.[0]?.message?.content?.trim();
    if (!aiMessage) {
      return res.status(500).json({ message: 'No response from language model.' });
    }

    // Conversation ensure + persistence for voice messages
    const shouldSaveVoice =
      saveFlag === 'true' || (saveFlag !== 'false' && !!dbUser.saveHistoryEnabled);
    let cid = null;
    if (shouldSaveVoice) {
      try {
        let conversation;
        if (bodyConversationId) {
          const tryId = Number(bodyConversationId);
          const found = Number.isFinite(tryId)
            ? await prisma.conversation.findUnique({ where: { id: tryId } })
            : null;
          if (!found || found.userId !== userId || found.characterId !== characterId) {
            conversation = await prisma.conversation.create({ data: { userId, characterId } });
            console.log('[CONVO CREATED]', conversation.id);
          } else {
            conversation = found;
          }
        } else {
          conversation = await prisma.conversation.create({ data: { userId, characterId } });
          console.log('[CONVO CREATED]', conversation.id);
        }
        cid = conversation.id;

        await prisma.$transaction([
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
          prisma.conversation.update({ where: { id: cid }, data: { updatedAt: new Date() } }),
        ]);
      } catch (persistErr) {
        console.error('Voice persistence error', persistErr && persistErr.message ? persistErr.message : persistErr);
      }
    }

    // TTS synthesis (base64 in JSON), using character-specific voice profile.
    // If the character is missing from the map, we fall back to a default voice.
    let audioBase64 = null;
    try {
      const ttsModel = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
      const voiceName = voiceProfile.voiceId || process.env.OPENAI_TTS_VOICE || 'alloy';

      const speech = await openai.audio.speech.create({
        model: ttsModel,
        voice: voiceName,
        input: aiMessage,
        format: 'mp3',
      });
      const audioBuf = Buffer.from(await speech.arrayBuffer());
      audioBase64 = audioBuf.toString('base64');
    } catch (e) {
      console.error('TTS synthesis failed:', e?.response?.data || e?.message || e);
      // It's okay to return without audio
    }

    return res.json({
      userText,
      assistantText: aiMessage,
      usage: buildUsageSummary(dbUser, usage),
      audioBase64,
    });
  } catch (err) {
    console.error('Voice chat error', err && err.message ? err.message : err);
    return res.status(500).json({ message: 'Voice chat failed' });
  } finally {
    // best-effort cleanup of uploaded file
    try {
      if (req.file && req.file.path) fs.unlink(req.file.path, () => {});
    } catch (_) {}
  }
});

// Optional TTS endpoint: synthesize arbitrary text into audio
router.post('/tts', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ message: 'OPENAI_API_KEY is not configured on the server' });
    }
    const dbUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!dbUser) return res.status(401).json({ message: 'User not found' });

    const { isTester } = getPlanLimits(dbUser.email, dbUser.plan);
    if (dbUser.plan !== 'pro' && !isTester) {
      return res.status(403).json({
        error: 'voice_premium_only',
        code: 'VOICE_PRO_ONLY',
        message: 'Voice chat is available for Pro members.',
      });
    }

    const { text } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ message: 'text is required' });
    }
    const ttsModel = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
    const voiceName = process.env.OPENAI_TTS_VOICE || 'alloy';
    const speech = await openai.audio.speech.create({
      model: ttsModel,
      voice: voiceName,
      input: text.trim(),
      format: 'mp3',
    });
    const audioBuf = Buffer.from(await speech.arrayBuffer());
    const audioBase64 = audioBuf.toString('base64');
    return res.json({ audioBase64 });
  } catch (err) {
    console.error('TTS error', err && err.message ? err.message : err);
    return res.status(500).json({ message: 'TTS failed' });
  }
});

router.post('/message', async (req, res) => {
  try {
    const { messages, characterId, lang, dialect, tone, conversationId, content, save } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        message: 'OPENAI_API_KEY is not configured on the server',
      });
    }

    if (!characterId) {
      return res.status(400).json({ error: 'characterId is required' });
    }

    // Load user and usage
    const dbUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!dbUser) {
      return res.status(401).json({ message: 'User not found' });
    }

    let usage = await ensureUsage(dbUser.id);
    const { dailyLimit, monthlyLimit, freeCharacterId, isTester } = getPlanLimits(
      dbUser.email,
      dbUser.plan
    );
    const isPremiumUser = !!(dbUser.isPremium || dbUser.plan === 'premium' || dbUser.plan === 'pro');
    const isFreePlanUser = !isPremiumUser && dbUser.plan === 'free';
    const userId = dbUser.id;

    // Server-side limits
    if (!isTester && isPremiumUser) {
      const used = usage.monthlyCount || 0;
      const limit = monthlyLimit || 3000;
      if (limit > 0 && used >= limit) {
        return res.status(429).json({
          error: 'usage_limit_reached',
          code: 'LIMIT_EXCEEDED',
          message: 'Monthly message limit reached.',
          scope: 'monthly',
          limitType: 'monthly',
          plan: 'premium',
          used,
          limit,
          remaining: 0,
          usage: buildUsageSummary(dbUser, usage),
        });
      }
    }

    if (!isTester && isFreePlanUser) {
      const limit = dailyLimit || 5;
      const used = usage.dailyCount || 0;

      if (limit > 0 && used >= limit) {
        return res.status(429).json({
          error: 'limit_reached',
          code: 'LIMIT_REACHED',
          message: `You’ve reached your daily ${limit}-message limit on the free plan.`,
          usage: buildUsageSummary(dbUser, usage),
        });
      }
    }

    // Accept request: increment usage immediately (after passing limit checks)
    if (!isTester) {
      if (isPremiumUser) {
        usage = await prisma.usage.update({
          where: { userId: dbUser.id },
          data: { monthlyCount: { increment: 1 } },
        });
      } else if (isFreePlanUser) {
        usage = await prisma.usage.update({
          where: { userId: dbUser.id },
          data: { dailyCount: { increment: 1 } },
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

    const isArabicConversation = dialect && dialect !== 'en';
    const personaText = isArabicConversation ? persona.ar : persona.en;

    const voiceProfile = CHARACTER_VOICES[characterId] || CHARACTER_VOICES.default;
    const toneKey = tone || voiceProfile.defaultTone || 'calm';
    const toneConfig = TONES[toneKey] || TONES.calm;

    // Determine whether to persist this conversation's messages
    const shouldSave = save === true || (save !== false && !!dbUser.saveHistoryEnabled);

    // BACKEND FIX — MISSING CONVERSATIONS
    // Ensure characterId exists handled above. Now validate conversationId and ensure a Conversation row.
    let conversation;
    if (conversationId) {
      const tryId = Number(conversationId);
      const found = Number.isFinite(tryId)
        ? await prisma.conversation.findUnique({ where: { id: tryId } })
        : null;

      if (!found || found.userId !== userId || found.characterId !== characterId) {
        conversation = await prisma.conversation.create({ data: { userId, characterId } });
        console.log('[CONVO CREATED]', conversation.id);
      } else {
        conversation = found;
      }
    } else {
      conversation = await prisma.conversation.create({ data: { userId, characterId } });
      console.log('[CONVO CREATED]', conversation.id);
    }

    const cid = conversation.id;

    // Build context (recent messages) and determine userText prior to Emotional Engine
    let recentContext = [];
    let userText = typeof content === 'string' ? content.trim() : '';

    if (shouldSave) {
      // Load previous messages from DB for this conversation
      const prev = await prisma.message.findMany({
        where: { conversationId: cid },
        orderBy: { createdAt: 'desc' },
        take: MAX_CONTEXT_MESSAGES,
        select: { role: true, content: true },
      });
      const decryptedMsgs = prev
        .filter((m) => m && typeof m.content === 'string')
        .reverse()
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));
      recentContext = decryptedMsgs;
    } else {
      // Fall back to messages passed from client (for non-saving users)
      const incoming = Array.isArray(messages) ? messages : [];
      const transformed = [];
      for (const m of incoming) {
        if (!m || typeof m.text !== 'string') continue;
        const txt = m.text.trim();
        if (!txt) continue;
        if (m.from === 'user') transformed.push({ role: 'user', content: txt });
        else if (m.from === 'ai') transformed.push({ role: 'assistant', content: txt });
      }
      recentContext = transformed.length > MAX_CONTEXT_MESSAGES
        ? transformed.slice(-MAX_CONTEXT_MESSAGES)
        : transformed;
      if (!userText) {
        const lastUser = [...incoming].reverse().find((m) => m && m.from === 'user' && typeof m.text === 'string');
        if (lastUser) userText = String(lastUser.text || '').trim();
      }
    }

    if (!userText) {
      return res.status(400).json({ message: 'No user content provided' });
    }

    // Free-plan character gating for detailed questions on locked companions.
    // Hana (or freeCharacterId) remains fully available; other companions are available
    // only for light/brief questions on the free plan. Detailed questions trigger
    // the upgrade modal via PRO_CHARACTER_LOCKED.
    if (!isTester && isFreePlanUser && characterId !== freeCharacterId) {
      const detailedPunctuationMatches = userText.match(/[?.!؟]/g) || [];
      const isLong = userText.length > 120;
      const hasMultipleSentences = detailedPunctuationMatches.length >= 2;
      const isDetailedQuestion = isLong || hasMultipleSentences;

      if (isDetailedQuestion) {
        return res.status(403).json({
          code: 'PRO_CHARACTER_LOCKED',
          message:
            'This companion is available on the Pro plan for deeper, detailed questions. Upgrade to unlock full access.',
          plan: dbUser.plan,
          allowedCharacterId: freeCharacterId,
        });
      }
    }

    let languageForEngine;
    if (lang === 'mixed') {
      languageForEngine = 'mixed';
    } else if (lang === 'en') {
      languageForEngine = 'en';
    } else {
      languageForEngine = 'ar';
    }

    const tClassifyStart = Date.now();
    const emo = await getEmotionForMessage({
      userMessage: userText,
      recentMessages: recentContext,
      language: languageForEngine,
    });
    const classifyMs = Date.now() - tClassifyStart;

    const conversationLength = (Array.isArray(recentContext) ? recentContext.length : 0) + 1;
    const decidedMode = decideEngineMode({
      isPremiumUser,
      primaryEmotion: emo.primaryEmotion,
      intensity: emo.intensity,
      conversationLength,
    });

    let engineMode;
    if (isPremiumUser) {
      engineMode = decidedMode;
    } else {
      engineMode = ENGINE_MODES.CORE_FAST;
    }

    let loopTag = null;
    let anchors = [];
    let reasonLabel = null;
    let promptTriggers = [];

    // V6: richer internal state only for premium deep modes.
    if (isPremiumUser && (engineMode === ENGINE_MODES.CORE_DEEP || engineMode === ENGINE_MODES.PREMIUM_DEEP)) {
      try {
        const [profile, triggerEvents] = await Promise.all([
          prisma.userEmotionProfile.findUnique({ where: { userId } }),
          prisma.emotionalTriggerEvent.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 3,
          }),
        ]);

        anchors = Array.isArray(profile?.emotionalAnchors) ? profile.emotionalAnchors : [];

        const triggerTags = Array.isArray(triggerEvents)
          ? triggerEvents.map((ev) => ev.type).filter(Boolean)
          : [];

        promptTriggers = triggerTags.map((tag) => ({
          topic: tag,
          emotion: emo.primaryEmotion,
          score: 1,
        }));

        reasonLabel = deriveEmotionalReason(userText, anchors, triggerTags, profile || null) || null;

        // Loop detection over current message + recent context
        loopTag = detectLoopTag(userText, recentContext);
      } catch (_) {
        anchors = [];
        promptTriggers = [];
        reasonLabel = null;
        loopTag = null;
      }
    }

    const systemPrompt = buildSystemPrompt({
      personaText,
      personaId: characterId,
      emotion: emo,
      convoState: null,
      language: languageForEngine,
      longTermSnapshot: null,
      triggers: promptTriggers,
      engineMode,
      isPremiumUser,
      loopTag,
      anchors,
      reasonLabel,
      dialect,
    });

    const toneInstruction = `Current emotional tone: ${toneConfig.label}. Style instruction: ${toneConfig.description}`;
    const systemMessage = `${systemPrompt}\n\n${toneInstruction}`;

    const openAIMessages = [];
    openAIMessages.push({ role: 'system', content: systemMessage });
    const limitedContext = Array.isArray(recentContext) && recentContext.length > FAST_CONTEXT_MESSAGES
      ? recentContext.slice(-FAST_CONTEXT_MESSAGES)
      : recentContext;
    if (Array.isArray(limitedContext) && limitedContext.length) {
      openAIMessages.push(...limitedContext);
    }
    openAIMessages.push({ role: 'user', content: userText });

    const routedModel = selectModelForResponse({
      emotion: emo,
      convoState: { currentState: 'NEUTRAL' },
      engineMode,
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
        convoState: { currentState: 'NEUTRAL' },
        longTermSnapshot: null,
        triggers: [],
        language: languageForEngine,
        severityLevel: emo.severityLevel || 'CASUAL',
        personaCfg: null,
        engineMode,
        isPremiumUser,
      });
      orchestrateMs = Date.now() - tOrchStart;
      if (typeof aiMessage !== 'string' || !aiMessage.trim()) aiMessage = rawReply;
    } catch (_) {
      aiMessage = rawReply;
    }

    // Phase 4: character-based routing without blocking access.
    // For free users, only the main unlocked companion (e.g. Hana) gives full responses.
    // Other companions respond briefly and recommend the main unlocked companion
    // instead of providing deep content.
    if (isFreePlanUser && characterId !== freeCharacterId) {
      if (!isArabicConversation) {
        const briefLines = [];
        if (characterId === 'rashid') {
          briefLines.push(
            "I can share a tiny hint in Rashid's style, but Hana is the main companion unlocked on your plan for deeper support."
          );
          briefLines.push(
            "If you want to explore this more, you can switch to Hana from the companions section."
          );
        } else if (characterId === 'abu-zain') {
          briefLines.push(
            "I can offer a very small reflection here, but Hana is available on your plan for deeper emotional support."
          );
          briefLines.push(
            "When you want to go further, you can switch to Hana from the companions section."
          );
        } else if (characterId === 'farah') {
          briefLines.push(
            "I can give you a light nudge, but Hana is unlocked on your plan for fuller support."
          );
          briefLines.push(
            "If you want more time and depth, try switching to Hana from the companions section."
          );
        } else if (characterId === 'nour') {
          briefLines.push(
            "I can give you a very brief, direct nudge, but Hana is the main companion on your plan for holding heavier feelings."
          );
          briefLines.push(
            "Whenever you want more space to talk, you can switch to Hana from the companions section."
          );
        } else {
          briefLines.push(
            "I can give a short hint here, but Hana is available on your plan for deeper support."
          );
          briefLines.push(
            "You can switch to Hana from the companions section whenever you like."
          );
        }
        aiMessage = briefLines.join(' ');
      }
    }

    // Premium users: if Hana is being used heavily for non-support topics like study/productivity,
    // softly suggest switching to Rashid instead of turning Hana into a productivity coach.
    if (isPremiumUser && characterId === 'hana' && !isArabicConversation) {
      const lower = userText.toLowerCase();
      const studyKeywords = ['exam', 'study', 'studying', 'homework', 'assignment', 'test'];
      const productivityKeywords = ['productivity', 'routine', 'routines', 'schedule', 'plan', 'planning', 'focus'];
      const mentionsStudy = studyKeywords.some((w) => lower.includes(w));
      const mentionsProductivity = productivityKeywords.some((w) => lower.includes(w));
      if (mentionsStudy || mentionsProductivity) {
        aiMessage =
          aiMessage +
          '\n\n' +
          "For more structured help with study, routines, and focus, Rashid is designed just for that. You can switch to him from the companions section whenever you like.";
      }
    }

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
      } catch (err) {
        console.error('Message persistence error', err && err.message ? err.message : err);
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
            console.error('[EmoEngine][Background] MessageEmotion error', err && err.message ? err.message : err);
          }

          try {
            await recordMemoryEvent({
              userId: bgUserId,
              conversationId: bgConversationId,
              messageId: bgMessageId,
              characterId: bgCharacterId,
              emotion: bgEmotion,
              topics: Array.isArray(bgEmotion.topics) ? bgEmotion.topics : [],
              secondaryEmotion: bgEmotion.secondaryEmotion || null,
              emotionVector: bgEmotion.emotionVector || null,
              detectorVersion: bgEmotion.detectorVersion || null,
              isKernelRelevant: true,
            });
          } catch (err) {
            console.error('[EmoEngine][Background] MemoryKernel error', err && err.message ? err.message : err);
          }

          try {
            await updateConversationEmotionState(bgConversationId, bgEmotion);
          } catch (err) {
            console.error('[EmoEngine][Background] ConversationEmotionState error', err && err.message ? err.message : err);
          }

          try {
            await logEmotionalTimelineEvent({ userId: bgUserId, conversationId: bgConversationId, emotion: bgEmotion });
          } catch (err) {
            console.error('[EmoEngine][Background] Timeline error', err && err.message ? err.message : err);
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
            console.error('[EmoEngine][Background] TriggerEvents error', err && err.message ? err.message : err);
          }

          try {
            await updateUserEmotionProfile({ userId: bgUserId });
          } catch (err) {
            console.error('[EmoEngine][Background] UserEmotionProfile error', err && err.message ? err.message : err);
          }

          try {
            await updateEmotionalPatterns({ userId: bgUserId });
          } catch (err) {
            console.error('[EmoEngine][Background] Patterns error', err && err.message ? err.message : err);
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
          console.error('[EmoEngine][Background] Unhandled error', err && err.message ? err.message : err);
        }
      });
    }

    console.log('[EmoEngine][Response]', {
      userId: userId == null ? 'null' : String(userId),
      conversationId: cid == null ? 'null' : String(cid),
      engineMode,
      isPremiumUser: !!isPremiumUser,
      classifyMs,
      orchestrateMs,
      openAiMs,
      backgroundJobQueued,
    });

    res.json({ reply: aiMessage, usage: buildUsageSummary(dbUser, usage) });
  } catch (err) {
    console.error('Chat completion error', err && err.message ? err.message : err);
    res.status(500).json({
      message: 'Failed to generate reply.',
    });
  }
});

module.exports = router;
