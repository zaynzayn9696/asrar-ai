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
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// every chat route needs login
router.use(requireAuth);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  const today = startOfToday();
  const month0 = startOfMonth();
  const needsDailyReset = !usage.dailyResetAt || usage.dailyResetAt < today;
  const needsMonthlyReset = !usage.monthlyResetAt || usage.monthlyResetAt < month0;
  if (needsDailyReset || needsMonthlyReset) {
    usage = await prisma.usage.update({
      where: { userId },
      data: {
        dailyCount: needsDailyReset ? 0 : usage.dailyCount,
        monthlyCount: needsMonthlyReset ? 0 : usage.monthlyCount,
        dailyResetAt: needsDailyReset ? today : usage.dailyResetAt,
        monthlyResetAt: needsMonthlyReset ? month0 : usage.monthlyResetAt,
      },
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

Other companions in the Asrar app:
- Abu Zain – fatherly guidance, life direction, deep values.
- Rashid – study, focus, productivity and routines.
- Nour – brutally honest but kind, straight to the point.
- Farah – fun, jokes, playful relief.

If the user asks a lot about exams, productivity, or building routines, you can gently say:
"I can talk with you about it in a gentle way, but Rashid is more focused on this area. You can switch to him from the companions section." 
In those situations, do not give a full, detailed study plan. Keep your own reply short (1–2 sentences) and mainly recommend Rashid instead of trying to fully answer.
You always remain Hana and do not fully act as another companion.`,
    ar: `أنت "هَنا".
- لطيفة وتمنح شعوراً بالتفهّم والاحتواء.
- تساعد مع الحزن، وكثرة التفكير، والوحدة، والقلق، والضغط.
- أسلوبك ناعم وهادئ، لا تستهين بمشاعر المستخدم أبداً.
- تعكس مشاعر الشخص وتطَمْئِنه أنه ليس وحده.

رفقاء آخرون في تطبيق أسرار:
- "أبو زين" – أب حكيم يقدّم توجيهاً حياتياً عميقاً.
- "راشد" – للدراسة والتركيز والإنتاجية وتنظيم الروتين.
- "نور" – صراحة قوية ولطيفة، تقول الحقيقة كما هي.
- "فرح" – للضحك والمرح وتخفيف الجو.

إذا كان كلام المستخدم يدور كثيراً حول الدراسة والإنتاجية والتركيز، يمكنك أن تقولي بلطف:
"أقدر أتكلم معك عن هذا الموضوع وأهتم بشعورك، لكن راشد مركز أكثر على هذه الناحية. تقدر تنتقل له من قسم الرفقاء." في هذه الحالات لا تقدّمي خطة دراسة كاملة أو تفاصيل كثيرة؛ اكتفي برد قصير (جملة أو جملتين) وركّزي على التوصية براشد، مع البقاء دائماً في شخصية هَنا فقط.`,
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

function getDialectInstruction(dialect) {
  const key = dialect || 'msa';
  const map = {
    msa: 'استخدم عربية فصحى بسيطة وواضحة، ويمكنك تقريب التعبير من طريقة كلام المستخدم بدون مبالغة في اللهجة وبدون ذكر اسم اللهجة.',
    jo: 'استخدم عربية قريبة من اللهجة الأردنية الطبيعية، بدون مبالغة في كتابة اللهجة وبدون ذكر اسم اللهجة.',
    sy: 'استخدم عربية قريبة من اللهجة الشامية/السورية البسيطة، بدون مبالغة في كتابة اللهجة وبدون ذكر اسم اللهجة.',
    lb: 'استخدم عربية قريبة من اللهجة اللبنانية الطبيعية، بدون مبالغة في كتابة اللهجة وبدون ذكر اسم اللهجة.',
    ps: 'استخدم عربية قريبة من اللهجة الفلسطينية الطبيعية، بدون مبالغة في كتابة اللهجة وبدون ذكر اسم اللهجة.',
    iq: 'استخدم عربية قريبة من اللهجة العراقية الطبيعية، بدون مبالغة في كتابة اللهجة وبدون ذكر اسم اللهجة.',
    eg: 'استخدم عربية قريبة من اللهجة المصرية البسيطة، بدون مبالغة في كتابة اللهجة وبدون ذكر اسم اللهجة.',
    sa: 'استخدم عربية قريبة من اللهجة الخليجية/السعودية الطبيعية، بدون مبالغة في كتابة اللهجة وبدون ذكر اسم اللهجة.',
    ae: 'استخدم عربية قريبة من اللهجة الخليجية/الإماراتية الطبيعية، بدون مبالغة في كتابة اللهجة وبدون ذكر اسم اللهجة.',
    kw: 'استخدم عربية قريبة من اللهجة الخليجية/الكويتية الطبيعية، بدون مبالغة في كتابة اللهجة وبدون ذكر اسم اللهجة.',
    bh: 'استخدم عربية قريبة من اللهجة الخليجية/البحرينية الطبيعية، بدون مبالغة في كتابة اللهجة وبدون ذكر اسم اللهجة.',
    om: 'استخدم عربية قريبة من اللهجة الخليجية/العُمانية الطبيعية، بدون مبالغة في كتابة اللهجة وبدون ذكر اسم اللهجة.',
    ye: 'استخدم عربية قريبة من اللهجة اليمنية الطبيعية، بدون مبالغة في كتابة اللهجة وبدون ذكر اسم اللهجة.',
  };
  return map[key] || map.msa;
}

router.get('/test', (req, res) => {
  res.json({
    ok: true,
    message: 'chat route is protected and working',
    userId: req.user.id,
  });
});

router.delete('/delete-all', requireAuth, async (req, res) => {
  try {
    const deleted = await prisma.message.deleteMany({ where: { userId: req.user.id } });
    res.json({ success: true, count: deleted.count });
  } catch (err) {
    console.error('Delete all messages error:', err);
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
    if (!isPremiumUser && !isTester) {
      return res.status(403).json({
        code: 'VOICE_PRO_ONLY',
        message: 'Voice chat is available for Pro members.',
      });
    }

    let usage = await ensureUsage(dbUser.id);

    if (!isTester) {
      if (isPremiumUser) {
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
      } else {
        const used = usage.dailyCount || 0;
        const limit = dailyLimit || 5;
        if (limit > 0 && used >= limit) {
          return res.status(429).json({
            error: 'usage_limit_reached',
            code: 'LIMIT_EXCEEDED',
            message: 'Daily message limit reached.',
            scope: 'daily',
            limitType: 'daily',
            plan: 'free',
            used,
            limit,
            remaining: 0,
            usage: buildUsageSummary(dbUser, usage),
          });
        }
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
    const isArabicConversation = dialect && dialect !== 'en';
    const personaText = isArabicConversation ? persona.ar : persona.en;

    const voiceProfile = CHARACTER_VOICES[characterId] || CHARACTER_VOICES.default;
    const toneKey = rawToneKey || voiceProfile.defaultTone || 'calm';
    const toneConfig = TONES[toneKey] || TONES.calm;

    let systemIntro = isArabicConversation
      ? `أنت رفيق في تطبيق "أسرار" للدعم العاطفي للمستخدمين في العالم العربي.
اللغة: ${getDialectInstruction(dialect)}
تذكر دائماً:
- لا تقدّم تشخيصاً طبياً.
- لا تعِد بعلاج أكيد.
- انصح بطلب مساعدة مختصة أو طبية إذا كان هناك أفكار انتحارية أو إيذاء للنفس.

ثم طبّق التعليمات الخاصة بالشخصية التالية:

${personaText}

حافظ على الردود في 3–6 جمل واضحة ومباشرة، ما لم يطلب المستخدم تفصيلاً أطول.`
      : `You are an AI companion inside an app called Asrar, supporting users from the Arab world.
Language: reply in natural, clear English. If the user mixes Arabic/English, you can gently follow their style.
Always remember:
- Do NOT give medical or clinical diagnoses.
- Do NOT promise cure.
- Encourage seeking professional or medical help if there are suicidal or self‑harm thoughts.

Then strictly follow this character description and style:

${personaText}

Keep your replies around 3–6 sentences unless the user clearly asks for more detail.`;

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
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: openAIMessages,
      temperature: 0.8,
    });

    const aiMessage = completion.choices?.[0]?.message?.content?.trim();
    if (!aiMessage) {
      return res.status(500).json({ message: 'No response from language model.' });
    }

    if (dbUser.saveHistoryEnabled) {
      await prisma.message.create({
        data: { userId: dbUser.id, characterId, content: aiMessage },
      });
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
      return res.status(403).json({ code: 'VOICE_PRO_ONLY', message: 'Voice chat is available for Pro members.' });
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
    const { messages, characterId, lang, dialect, tone } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        message: 'OPENAI_API_KEY is not configured on the server',
      });
    }

    if (!characterId || !Array.isArray(messages)) {
      return res
        .status(400)
        .json({ message: 'characterId and messages are required' });
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

    // Character gating for free plan
    if (dbUser.plan === 'free' && characterId !== freeCharacterId) {
      return res.status(403).json({
        code: 'PRO_CHARACTER_LOCKED',
        message:
          'This companion is available on the Pro plan. Upgrade to unlock all characters.',
        plan: dbUser.plan,
        allowedCharacterId: freeCharacterId,
      });
    }

    // Server-side limits
    if (!isTester) {
      if (isPremiumUser) {
        const used = usage.monthlyCount || 0;
        const limit = monthlyLimit || 3000;
        if (limit > 0 && used >= limit) {
          return res.status(429).json({
            error: 'usage_limit_reached',
            code: 'LIMIT_EXCEEDED',
            message: 'Monthly message limit reached.',
            scope: 'monthly',
            limitType: 'monthly',
            plan: isPremiumUser ? 'premium' : 'free',
            used,
            limit,
            remaining: 0,
            usage: buildUsageSummary(dbUser, usage),
          });
        }
      } else {
        const used = usage.dailyCount || 0;
        const limit = dailyLimit || 5;
        if (limit > 0 && used >= limit) {
          return res.status(429).json({
            error: 'usage_limit_reached',
            code: 'LIMIT_EXCEEDED',
            message: 'Daily message limit reached.',
            scope: 'daily',
            plan: 'free',
            used,
            limit,
            remaining: 0,
            usage: buildUsageSummary(dbUser, usage),
          });
        }
      }
    }

    // Accept request: increment usage immediately
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

    const isArabicConversation = dialect && dialect !== 'en';
    const personaText = isArabicConversation ? persona.ar : persona.en;

    const voiceProfile = CHARACTER_VOICES[characterId] || CHARACTER_VOICES.default;
    const toneKey = tone || voiceProfile.defaultTone || 'calm';
    const toneConfig = TONES[toneKey] || TONES.calm;

    let systemIntro = isArabicConversation
      ? `أنت رفيق في تطبيق "أسرار" للدعم العاطفي للمستخدمين في العالم العربي.
اللغة: ${getDialectInstruction(dialect)}
تذكر دائماً:
- لا تقدّم تشخيصاً طبياً.
- لا تعِد بعلاج أكيد.
- انصح بطلب مساعدة مختصة أو طبية إذا كان هناك أفكار انتحارية أو إيذاء للنفس.

ثم طبّق التعليمات الخاصة بالشخصية التالية:

${personaText}

حافظ على الردود في 3–6 جمل واضحة ومباشرة، ما لم يطلب المستخدم تفصيلاً أطول.`
      : `You are an AI companion inside an app called Asrar, supporting users from the Arab world.
Language: reply in natural, clear English. If the user mixes Arabic/English, you can gently follow their style.
Always remember:
- Do NOT give medical or clinical diagnoses.
- Do NOT promise cure.
- Encourage seeking professional or medical help if there are suicidal or self‑harm thoughts.

Then strictly follow this character description and style:

${personaText}

Keep your replies around 3–6 sentences unless the user clearly asks for more detail.`;

    const openAIMessages = [];
    openAIMessages.push({ role: 'system', content: systemIntro });

    for (const m of messages) {
      if (!m || typeof m.text !== 'string') continue;
      const text = m.text.trim();
      if (!text) continue;

      if (m.from === 'user') {
        openAIMessages.push({ role: 'user', content: text });
      } else if (m.from === 'ai') {
        openAIMessages.push({ role: 'assistant', content: text });
      }
    }

    if (openAIMessages.length === 1) {
      return res
        .status(400)
        .json({ message: 'No user messages provided for the model.' });
    }

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: openAIMessages,
      temperature: 0.8,
    });

    const aiMessage = completion.choices?.[0]?.message?.content?.trim();
    if (!aiMessage) {
      return res
        .status(500)
        .json({ message: 'No response from language model.' });
    }

    if (dbUser.saveHistoryEnabled) {
      await prisma.message.create({
        data: {
          userId: dbUser.id,
          characterId,
          content: aiMessage,
        },
      });
    }

    res.json({ reply: aiMessage, usage: buildUsageSummary(dbUser, usage) });
  } catch (err) {
    console.error('Chat completion error', err && err.message ? err.message : err);
    res.status(500).json({
      message: 'Failed to generate reply.',
    });
  }
});

module.exports = router;
