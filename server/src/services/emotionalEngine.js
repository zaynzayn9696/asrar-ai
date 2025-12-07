// server/src/services/emotionalEngine.js
// Emotional Engine v1 — Phase 1 (Option C)
// Provides message-level emotion classification, maintains conversation-level
// emotional state, and builds an emotionally-aware system prompt.

const OpenAI = require('openai');
const prisma = require('../prisma');
const { personas, defaultPersona } = require('../config/personas');
const {
  logEmotionalTimelineEvent,
  updateUserEmotionProfile,
  getLongTermEmotionalSnapshot,
  detectEmotionalTriggers,
  updateEmotionalPatterns,
} = require('./emotionalLongTerm');
const {
  updateConversationStateMachine,
  getConversationState,
} = require('./emotionalStateMachine');
const { buildPhase4MemoryBlock } = require('../pipeline/memory/Phase4PromptBuilder');
const { getIdentityMemory } = require('../pipeline/memory/memoryKernel');

const ENGINE_MODES = {
  CORE_FAST: 'CORE_FAST',
  CORE_DEEP: 'CORE_DEEP',
  PREMIUM_DEEP: 'PREMIUM_DEEP',
};

function decideEngineMode({ isPremiumUser, primaryEmotion, intensity, conversationLength }) {
  const safeIntensity = Number.isFinite(Number(intensity)) ? Number(intensity) : 2;
  const len = Number.isFinite(Number(conversationLength)) ? Number(conversationLength) : 0;

  const NEGATIVE = new Set(['SAD', 'ANXIOUS', 'ANGRY', 'LONELY', 'STRESSED']);
  const primary = String(primaryEmotion || '').toUpperCase();

  if (isPremiumUser && safeIntensity >= 4 && NEGATIVE.has(primary)) {
    return ENGINE_MODES.PREMIUM_DEEP;
  }

  if (safeIntensity >= 3 || len > 16) {
    return ENGINE_MODES.CORE_DEEP;
  }

  return ENGINE_MODES.CORE_FAST;
}

/**
 * @typedef {Object} Emotion
 * @property {('NEUTRAL'|'SAD'|'ANXIOUS'|'ANGRY'|'LONELY'|'STRESSED'|'HOPEFUL'|'GRATEFUL')} primaryEmotion
 * @property {number} intensity  // 1-5
 * @property {number} confidence // 0-1
 * @property {('ARABIC'|'ENGLISH'|'MIXED')} cultureTag
 * @property {string=} notes
 */

/**
 * @typedef {Object} ConversationEmotionState
 * @property {number} id
 * @property {number} conversationId
 * @property {('NEUTRAL'|'SAD'|'ANXIOUS'|'ANGRY'|'LONELY'|'STRESSED'|'HOPEFUL'|'GRATEFUL')} dominantEmotion
 * @property {number} avgIntensity
 * @property {number} sadnessScore
 * @property {number} anxietyScore
 * @property {number} angerScore
 * @property {number} lonelinessScore
 * @property {Date} lastUpdatedAt
 */

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const personaStyleBlockCache = new Map();

function getDialectGuidance(language, dialect) {
  const lang = String(language || '').toLowerCase();

  // For English UI / English conversations, ignore dialect for content.
  if (lang === 'en') {
    return 'Language: reply in natural, clear English. If the user occasionally mixes Arabic, you may briefly mirror that, but keep your full reply in English.';
  }

  const key = String(dialect || 'msa').toLowerCase();

  const map = {
    msa: 'اللغة: استخدم عربية فصحى حديثة لكن بسيطة ولطيفة، وتجنّب الأسلوب الأكاديمي أو الرسمي الجاف. لا تستخدم لهجة محلية محددة هنا، لكن لا تعُد إلى فصحى ثقيلة أو معقّدة.',
    jo: 'اللغة: استخدم لهجة أردنية يومية وواضحة (كلمات مثل: "كتير، شوي، هيك، ليش، كيفك")، وتجنّب الرد بالعربية الفصحى المحايدة. حوّل الجمل إلى لهجة أردنية حتى لو كان سؤال المستخدم أقرب للفصحى، ما لم يكتب نصاً رسمياً حرفياً.',
    sy: 'اللغة: استخدم لهجة شامية/سورية طبيعية ("كتير، شوي، هيك، ليش، مو، تمام")، وتجنّب الرد بالعربية الفصحى القياسية. حوّل ردودك دائماً للهجة الشامية في الجمل العربية، إلا إذا كنت تنقل كلاماً رسمياً من المستخدم حرفياً.',
    lb: 'اللغة: استخدم لهجة لبنانية مألوفة ("كتير، شوي، هيك، عنجد، طيب، ماشي")، وتجنّب الفصحى المحايدة. يجب أن يبدو كلامك مثل شخص لبناني حقيقي في محادثة يومية، وليس نصاً فصيحاً.',
    ps: 'اللغة: استخدم لهجة فلسطينية طبيعية وواضحة، مع مفردات وصياغة من الحياة اليومية، وتجنّب العودة إلى الفصحى العامة. حوّل الجمل إلى لهجة فلسطينية حتى لو كان سؤال المستخدم مكتوباً بصياغة أقرب للفصحى.',
    iq: 'اللغة: استخدم لهجة عراقية طبيعية ("شكو ماكو، كلش، هواية، خوش") قدر الإمكان، وتجنّب استخدام العربية الفصحى القياسية في الجمل العادية. اجعل جوابك يبدو كحديث عراقي حقيقي وليس فصحى.',
    eg: 'اللغة: استخدم لهجة مصرية واضحة ومباشرة ("إنت، إنتي، إنتوا، حاسس، مفيش، كده، ليه، خلينا")، ولا ترجع للغة العربية الفصحى المحايدة في الرد. حوّل الجمل دائماً للعامية المصرية في المقاطع العربية، إلا عند نقل آية أو نص رسمي حرفي.',
    sa: 'اللغة: استخدم لهجة خليجية/سعودية طبيعية في الكلام اليومي ("مرّة، مره، شوي، وش، ليه")، وتجنّب الفصحى العامة في الجمل الحوارية. ليكن ردّك أقرب لطريقة كلام شخص سعودي مهتم ومتعاطف.',
    ae: 'اللغة: استخدم لهجة خليجية/إماراتية بسيطة قريبة من كلام الناس اليومي، وتجنّب العربية الفصحى القياسية في الجمل العادية. اجعل الردود تبدو مثل محادثة بين أصدقاء إماراتيين.',
    kw: 'اللغة: استخدم لهجة خليجية/كويتية طبيعية في الجمل العربية، مع تجنّب الرجوع للفصحى المحايدة. اختر مفردات وصياغات دارجة في الكويت قدر الإمكان.',
    bh: 'اللغة: استخدم لهجة خليجية/بحرينية بسيطة في حديثك، وابتعد عن الفصحى القياسية في الردود العاطفية اليومية. ليكن الأسلوب قريباً من كلام الناس في البحرين.',
    om: 'اللغة: استخدم لهجة خليجية/عُمانية مفهومة وبسيطة في الجمل العربية، وتجنّب العربية الفصحى الرسمية قدر الإمكان. ركّز على دفء الأسلوب وليس الرسمية.',
    ye: 'اللغة: استخدم لهجة يمنية طبيعية في الجمل العربية، مع مفردات وأساليب قريبة من كلام الناس هناك، وتجنّب الفصحى المحايدة في الردود ما أمكن.',
    ma: 'اللغة: استخدم الدارجة المغربية بوضوح في الجمل العربية ("بزاف، شوية، علاش، كيفاش، ماشي")، وتجنّب الرد بالعربية الفصحى القياسية. حوّل أغلب الجمل إلى الدارجة المغربية حتى لو كان سؤال المستخدم مكتوباً بشكل أقرب للفصحى.',
    tn: 'اللغة: استخدم لهجة تونسية طبيعية في الجمل العربية، مع مفردات تونسية واضحة، وتجنّب العربية الفصحى المحايدة. اجعل ردّك يشبه محادثة عادية بينك وبين مستخدم تونسي.',
  };

  const base = map[key] || map.msa;
  const strictLine = 'IMPORTANT: You must speak strictly in this chosen Arabic dialect in all Arabic parts of your reply. Do NOT switch back to Modern Standard Arabic (MSA) except when quoting exact formal text (e.g. Quran verses, official statements, or names).';

  if (lang === 'mixed') {
    return (
      base +
      '\nإذا استخدمتَ الإنجليزية في جزء من الرد، فلتكن إنجليزية طبيعية، لكن في المقاطع العربية التزم تماماً بهذه اللهجة المحددة، ولا ترجع للعربية الفصحى المحايدة.' +
      `\n${strictLine}`
    );
  }

  // lang === 'ar'
  return (
    base +
    '\nتذكّر: لا تستخدم العربية الفصحى القياسية في الجمل العادية ما أمكن، بل اجعل إجابتك بالعربية دائماً بهذه اللهجة.' +
    `\n${strictLine}`
  );
}

/**
 * Classifies the user's message emotion using OpenAI and returns a structured object.
 * Falls back to a neutral default on any error or parse failure.
 * Prompt is deliberately compact for latency reasons.
 * @param {Object} params
 * @param {string} params.userMessage
 * @param {Array<{role: 'user'|'assistant', content: string}>} params.recentMessages
 * @param {('ar'|'en'|'mixed')} params.language
 * @param {string} [params.dialect]
 * @returns {Promise<Emotion>}
 */
async function classifyEmotion({ userMessage, recentMessages = [], language = 'en' }) {
  const cultureGuess = language === 'ar' ? 'ARABIC' : language === 'mixed' ? 'MIXED' : 'ENGLISH';

  // Build a very small context summary to keep token usage low
  const recentSummary = recentMessages
    .slice(-3)
    .map((m) => `${m.role === 'assistant' ? 'AI' : 'User'}: ${String(m.content || '').slice(0, 120)}`)
    .join('\n');

  const sys = [
    'You are an emotion classifier for Asrar (mental wellbeing chat).',
    'Return STRICT JSON only: {"primaryEmotion","intensity","confidence","cultureTag","notes","severityLevel"}.',
    'primaryEmotion ∈ [NEUTRAL,SAD,ANXIOUS,ANGRY,LONELY,STRESSED,HOPEFUL,GRATEFUL]; intensity 1-5; confidence 0-1.',
    'cultureTag ∈ ["ARABIC","ENGLISH","MIXED"]; severityLevel ∈ ["CASUAL","VENTING","SUPPORT","HIGH_RISK"].',
    'Keep "notes" to at most one short sentence if you include it.',
  ].join('\n');

  const user = [
    `Language: ${language}`,
    'Recent conversation (most recent last):',
    recentSummary || '(no prior messages)',
    '',
    'Current user message:',
    String(userMessage || '').slice(0, 400),
  ].join('\n');

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 64,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
    });
    const raw = completion.choices?.[0]?.message?.content?.trim() || '';
    try {
      const parsed = JSON.parse(raw);
      const out = {
        primaryEmotion: String(parsed.primaryEmotion || 'NEUTRAL').toUpperCase(),
        intensity: Math.max(1, Math.min(5, parseInt(parsed.intensity, 10) || 1)),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
        cultureTag: ['ARABIC', 'ENGLISH', 'MIXED'].includes(String(parsed.cultureTag || '').toUpperCase())
          ? String(parsed.cultureTag).toUpperCase()
          : cultureGuess,
        notes: typeof parsed.notes === 'string' ? parsed.notes.slice(0, 400) : undefined,
        severityLevel: (['CASUAL','VENTING','SUPPORT','HIGH_RISK'].includes(String(parsed.severityLevel || '').toUpperCase())
          ? String(parsed.severityLevel).toUpperCase()
          : 'CASUAL'),
      };
      return out;
    } catch (_) {
      // fall through to neutral
    }
  } catch (e) {
    // swallow error and fallback
  }

  return {
    primaryEmotion: 'NEUTRAL',
    intensity: 2,
    confidence: 0.4,
    cultureTag: cultureGuess,
    notes: 'Fallback neutral classification',
    severityLevel: 'CASUAL',
  };
}

/**
 * Shared helper for message-level emotion: uses a lightweight heuristic on the
 * very first turn (no history) and falls back to full LLM-based
 * classifyEmotion once there is context.
 * @param {Object} params
 * @param {string} params.userMessage
 * @param {Array<{role:'user'|'assistant',content:string}>} params.recentMessages
 * @param {('ar'|'en'|'mixed')} params.language
 * @returns {Promise<Emotion>}
 */
async function getEmotionForMessage({ userMessage, recentMessages, language }) {
  const hasHistory = Array.isArray(recentMessages) && recentMessages.length > 0;
  const raw = String(userMessage || '');
  const text = raw.trim();
  const lower = text.toLowerCase();
  const approxLength = text.length;

  const cultureTag =
    language === 'ar' ? 'ARABIC' : language === 'mixed' ? 'MIXED' : 'ENGLISH';

  // Very short acknowledgements / fillers: skip LLM and keep things neutral.
  if (approxLength > 0 && approxLength <= 18) {
    const trivialRe = /^(ok(ay)?|k|kk|thx|thanks|thank you|lol|haha|hehe|hmm|yep|yeah|yes|no|nah|sure|fine|great|cool|nice)$/i;
    if (trivialRe.test(text)) {
      return {
        primaryEmotion: 'NEUTRAL',
        intensity: 1,
        confidence: 0.65,
        cultureTag,
        notes: 'Heuristic trivial/acknowledgement message (skipped LLM).',
        severityLevel: 'CASUAL',
      };
    }
  }

  // High-risk / clearly negative keywords: always use the LLM-based classifier,
  // regardless of length, so we keep severity-level nuance.
  const negativeOrRiskRe =
    /(suicid|kill myself|kill my self|end my life|self[-\s]?harm|cutting myself|cut myself|i want to die|i wanna die|don't want to live|dont want to live|life is pointless|worthless|sad|depress|cry|alone|lonely|hurt|anxious|anxiety|worried|worry|panic|nervous|afraid|scared|angry|mad|furious|rage|irritated|pissed|stress|stressed|overwhelmed|burnout|burned out|tired of)/i;

  // First turn: keep the existing lightweight heuristic instead of an LLM call.
  if (!hasHistory) {
    const approxFirst = lower.length;
    let primaryEmotion = 'NEUTRAL';
    if (/(sad|depress|cry|alone|lonely|hurt)/.test(lower)) {
      primaryEmotion = 'SAD';
    } else if (/(anxious|anxiety|worried|worry|panic|nervous|afraid|scared)/.test(lower)) {
      primaryEmotion = 'ANXIOUS';
    } else if (/(angry|mad|furious|rage|irritated|pissed)/.test(lower)) {
      primaryEmotion = 'ANGRY';
    } else if (/(stress|stressed|overwhelmed|burnout|burned out|tired of)/.test(lower)) {
      primaryEmotion = 'STRESSED';
    } else if (/(grateful|thankful|hopeful|optimistic)/.test(lower)) {
      primaryEmotion = 'HOPEFUL';
    }

    const lengthFactor = Math.max(0, Math.min(approxFirst / 80, 4));
    const intensity = Math.max(1, Math.min(5, Math.round(1 + lengthFactor)));

    return {
      primaryEmotion,
      intensity,
      confidence: 0.55,
      cultureTag,
      notes: 'Heuristic first-turn classification (no context)',
      severityLevel: 'CASUAL',
    };
  }

  // For later turns: if there are no obviously negative / risky keywords and the
  // message is quite short, keep a cheap heuristic instead of an LLM call.
  if (!negativeOrRiskRe.test(lower) && approxLength > 0 && approxLength < 80) {
    const hasPositive = /(grateful|thankful|hopeful|optimistic|love|appreciate|relieved)/.test(
      lower
    );

    const lengthFactor = Math.max(0, Math.min(approxLength / 80, 4));
    const intensity = Math.max(1, Math.min(5, Math.round(1 + lengthFactor)));

    return {
      primaryEmotion: hasPositive ? 'HOPEFUL' : 'NEUTRAL',
      intensity,
      confidence: 0.55,
      cultureTag,
      notes: 'Heuristic short non-negative turn (skipped LLM).',
      severityLevel: 'CASUAL',
    };
  }

  // Fallback: full LLM-based classification with a compact history window.
  const trimmedHistory = Array.isArray(recentMessages)
    ? recentMessages.slice(-5)
    : [];
  return classifyEmotion({ userMessage: text, recentMessages: trimmedHistory, language });
}

/**
 * Updates conversation-level emotion state with a weighted average.
 * If no state exists, create one. If conversationId is missing, skip DB and return null.
 * @param {number|undefined|null} conversationId
 * @param {Emotion} emo
 * @returns {Promise<ConversationEmotionState|null>}
 */
async function updateConversationEmotionState(conversationId, emo) {
  if (!conversationId || !Number.isFinite(Number(conversationId))) return null;

  const cid = Number(conversationId);
  const now = new Date();
  const weightOld = 0.7;
  const weightNew = 0.3;

  const existing = await prisma.conversationEmotionState.findUnique({
    where: { conversationId: cid },
  }).catch(() => null);

  const intensity = Math.max(1, Math.min(5, emo.intensity || 1));
  const intensity01 = intensity / 5;

  /** Choose which score field to update based on primaryEmotion */
  const scoreMap = {
    SAD: 'sadnessScore',
    ANXIOUS: 'anxietyScore',
    ANGRY: 'angerScore',
    LONELY: 'lonelinessScore',
  };
  const scoreField = scoreMap[emo.primaryEmotion] || null;

  if (!existing) {
    const init = {
      conversationId: cid,
      dominantEmotion: ['NEUTRAL','SAD','ANXIOUS','ANGRY','LONELY','STRESSED','HOPEFUL','GRATEFUL'].includes(emo.primaryEmotion)
        ? emo.primaryEmotion
        : 'NEUTRAL',
      avgIntensity: intensity01,
      sadnessScore: emo.primaryEmotion === 'SAD' ? intensity01 : 0,
      anxietyScore: emo.primaryEmotion === 'ANXIOUS' ? intensity01 : 0,
      angerScore: emo.primaryEmotion === 'ANGRY' ? intensity01 : 0,
      lonelinessScore: emo.primaryEmotion === 'LONELY' ? intensity01 : 0,
      lastUpdatedAt: now,
    };
    return prisma.conversationEmotionState.create({ data: init });
  }

  const next = {
    avgIntensity: weightOld * (existing.avgIntensity || 0) + weightNew * intensity01,
    sadnessScore: existing.sadnessScore,
    anxietyScore: existing.anxietyScore,
    angerScore: existing.angerScore,
    lonelinessScore: existing.lonelinessScore,
    lastUpdatedAt: now,
  };

  if (scoreField) {
    next[scoreField] = weightOld * (existing[scoreField] || 0) + weightNew * intensity01;
  }

  // Compute dominant among tracked dimensions only
  const domPairs = [
    ['SAD', next.sadnessScore],
    ['ANXIOUS', next.anxietyScore],
    ['ANGRY', next.angerScore],
    ['LONELY', next.lonelinessScore],
  ];
  let dominantEmotion = existing.dominantEmotion || 'NEUTRAL';
  let best = -1;
  for (const [label, val] of domPairs) {
    const v = typeof val === 'number' ? val : 0;
    if (v > best) {
      best = v;
      dominantEmotion = label;
    }
  }

  return prisma.conversationEmotionState.update({
    where: { conversationId: cid },
    data: { ...next, dominantEmotion },
  });
}

/**
 * Builds a system prompt string blending persona, current emotion, conversation state, and safety rules.
 * @param {Object} params
 * @param {string} params.persona // already localized persona text
 * @param {Emotion} params.emotion
 * @param {ConversationEmotionState|null} params.convoState
 * @param {('ar'|'en'|'mixed')} params.language
 * @param {string} [params.dialect] // optional dialect code (e.g. msa, jo, sa, lb, sy, etc.)
 * @param {Object} params.longTermSnapshot
 * @param {Array} params.triggers
 * @param {string} params.engineMode
 * @param {string} params.loopTag
 * @param {Array} params.anchors
 * @param {string} params.conversationSummary
 * @param {boolean} params.isPremiumUser
 * @param {string} params.reasonLabel
 * @param {{ name?: string }} [params.identityMemory]
 * @returns {string}
 */
function buildSystemPrompt({ personaText, personaId, emotion, convoState, language, longTermSnapshot, triggers, engineMode, loopTag, anchors, conversationSummary, isPremiumUser, reasonLabel, dialect, identityMemory, recentAssistantReplies = [] }) {
  const isArabic = language === 'ar';
  const personaCfg = personas[personaId] || defaultPersona;
  const premiumUser = !!isPremiumUser;

  const emotionLine = isArabic
    ? `حالة المستخدم الآن: ${emotion.primaryEmotion}، الشدة ${emotion.intensity}/5، الثقة ${(emotion.confidence * 100).toFixed(0)}%`
    : `User current state: ${emotion.primaryEmotion}, intensity ${emotion.intensity}/5, confidence ${(emotion.confidence * 100).toFixed(0)}%`;

  const stateLine = convoState
    ? (isArabic
      ? `حالة المحادثة: المسيطر = ${convoState.dominantEmotion}، متوسط الشدة ${(convoState.avgIntensity * 5).toFixed(1)}/5`
      : `Conversation state: dominant = ${convoState.dominantEmotion}, avg intensity ${(convoState.avgIntensity * 5).toFixed(1)}/5`)
    : (isArabic
      ? 'حالة المحادثة: لا توجد بيانات كافية بعد'
      : 'Conversation state: not enough data yet');

  const cultural = getDialectGuidance(language, dialect);

  const safety = isArabic
    ? [
        '- لا تقدّم تشخيصاً طبياً ولا وعوداً بالعلاج.',
        '- إذا ظهرت أفكار انتحارية أو إيذاء للنفس: شجّع على طلب مساعدة مختصة/طبية فوراً والتواصل مع أشخاص موثوقين.',
        '- كن داعماً، متفهماً، وحافظ على الأمان العاطفي دائماً.',
      ].join('\n')
    : [
        '- Do NOT provide medical/clinical diagnoses or promise cure.',
        '- If there are suicidal or self-harm thoughts: encourage seeking professional/medical help immediately and reaching out to trusted people.',
        '- Be supportive, validating, and prioritize emotional safety at all times.',
      ].join('\n');

  const guidanceLines = isArabic
    ? [
        'حافظ على ردود موجزة واضحة (٣–٦ جمل عادةً) ما لم يطلب المستخدم تفاصيل أكثر.',
        'لا تبدأ كل رسالة بنفس الجملة أو نفس التحية؛ بدّل طريقة البداية من رد لآخر بشكل طبيعي.',
        'اربط ردّك دائماً بما قاله المستخدم تحديداً في رسالته الأخيرة، وتجنّب النصائح العامة المكرّرة.',
        'تجنّب نسخ أي جملة كاملة من ردودك السابقة حرفياً، خصوصاً الجملة الأولى في كل رد.'
      ]
    : [
        'Keep replies concise (about 3–6 sentences) unless the user clearly asks for more detail.',
        'Do NOT start every reply with the same sentence or greeting; vary your openings naturally from turn to turn.',
        "Always ground your answer in what the user just said instead of generic repeated advice.",
        'Avoid copying any full sentence exactly from your last couple of replies, especially the opening line.'
      ];
  const guidance = guidanceLines.join('\n');

  const header = isArabic
    ? 'أنت رفيق داخل تطبيق "أسرار" للدعم العاطفي.'
    : 'You are an AI companion inside an app called Asrar, focused on emotional support.';

  // Long-term summary block (optional)
  let longTermBlock = '';
  if (longTermSnapshot) {
    const s = longTermSnapshot;
    const scoresLine = isArabic
      ? `الأنماط طويلة الأمد — حزن: ${s.scores.sadness.toFixed(2)}, قلق: ${s.scores.anxiety.toFixed(2)}, غضب: ${s.scores.anger.toFixed(2)}, وحدة: ${s.scores.loneliness.toFixed(2)}, أمل: ${s.scores.hope.toFixed(2)}, امتنان: ${s.scores.gratitude.toFixed(2)} (شدة متوسطة ${(s.avgIntensity * 5).toFixed(1)}/5)`
      : `Long-term patterns — sadness: ${s.scores.sadness.toFixed(2)}, anxiety: ${s.scores.anxiety.toFixed(2)}, anger: ${s.scores.anger.toFixed(2)}, loneliness: ${s.scores.loneliness.toFixed(2)}, hope: ${s.scores.hope.toFixed(2)}, gratitude: ${s.scores.gratitude.toFixed(2)} (avg intensity ${(s.avgIntensity * 5).toFixed(1)}/5)`;
    const domLine = isArabic
      ? `العاطفة الطويلة الأمد السائدة: ${s.dominantLongTermEmotion}`
      : `Dominant long-term emotion: ${s.dominantLongTermEmotion}`;
    const sumLine = isArabic ? s.summaryText : s.summaryText;
    longTermBlock = [
      isArabic ? 'ملخص طويل الأمد:' : 'Long-term mood:',
      domLine,
      scoresLine,
      sumLine,
    ].join('\n');
  }

  // Triggers block (optional)
  let triggersBlock = '';
  if (Array.isArray(triggers) && triggers.length > 0) {
    const top = triggers.slice(0, 2).map(t => t.topic).join(', ');
    triggersBlock = isArabic
      ? `ملاحظة حساسة: كن ألطف عند المواضيع مثل: ${top}.`
      : `Sensitivity note: be especially gentle around topics like: ${top}.`;
  }

  const personaStyleKey = `${personaId || 'default'}|${isArabic ? 'ar' : 'en'}`;
  let personaStyleBlock = personaStyleBlockCache.get(personaStyleKey);
  if (!personaStyleBlock) {
    personaStyleBlock = [
      isArabic ? 'وصف الدور للشخصية:' : 'Persona role description:',
      personaCfg.roleDescription,
      isArabic ? 'الأسلوب (للمرجع الداخلي):' : 'Style (internal guidance):',
      `- warmth: ${personaCfg.style?.warmth || 'medium'}`,
      `- humor: ${personaCfg.style?.humor || 'low'}`,
      `- directness: ${personaCfg.style?.directness || 'medium'}`,
      `- energy: ${personaCfg.style?.energy || 'calm'}`,
      personaCfg.specialties && personaCfg.specialties.length
        ? (isArabic ? `مجالات تركيز: ${personaCfg.specialties.join(', ')}` : `Specialties: ${personaCfg.specialties.join(', ')}`)
        : '',
    ].filter(Boolean).join('\n');
    personaStyleBlockCache.set(personaStyleKey, personaStyleBlock);
  }

  // Short long-term hint line
  let longTermHint = '';
  if (longTermSnapshot && longTermSnapshot.summaryText) {
    longTermHint = isArabic
      ? `ملحوظة طويلة الأمد: ${longTermSnapshot.summaryText}`
      : `Long-term hint: ${longTermSnapshot.summaryText}`;
  }

  // Triggers internal guidance
  const triggersHint = (Array.isArray(triggers) && triggers.length)
    ? (isArabic
      ? `مناطق حساسة (للتعامل بلطف): ${triggers.slice(0, 3).map(t => t.topic).join(', ')}`
      : `Sensitive areas (handle gently): ${triggers.slice(0, 3).map(t => t.topic).join(', ')}`)
    : '';

  // Identity block: short, non-creepy guidance about using the user's name.
  let identityBlock = '';
  if (identityMemory && typeof identityMemory.name === 'string') {
    const safeName = identityMemory.name.trim();
    if (safeName) {
      identityBlock = isArabic
        ? [
            'معلومة هوية المستخدم (للاستخدام الداخلي):',
            `- المستخدم أخبرك أن اسمه "${safeName}".`,
            'يمكنك مناداته باسمه أحياناً لخلق دفء وطمأنينة، لكن لا تكرر الاسم في كل رد ولا تسأله عن اسمه مرة أخرى إلا إذا قال إنه تغيّر.',
          ].join('\n')
        : [
            'User identity (internal guidance):',
            `- The user told you their name is "${safeName}".`,
            'You may use their name warmly and naturally sometimes, but do not overuse it or repeat it every message. Do not ask for their name again unless they say it changed.',
          ].join('\n');
    }
  }

  console.log('[SystemPrompt] identity block', {
    hasIdentity: !!(identityMemory && identityMemory.name),
  });

  const isFreeFast = engineMode === ENGINE_MODES.CORE_FAST && !premiumUser;

  let anchorsList = Array.isArray(anchors) ? anchors.filter(Boolean) : [];
  let loopTagStr = typeof loopTag === 'string' && loopTag.trim() ? loopTag.trim() : null;

  if (isFreeFast) {
    anchorsList = [];
    loopTagStr = null;
  }

  const dominantTrend = (() => {
    const primary = String(emotion?.primaryEmotion || '').toUpperCase();
    const neg = ['SAD', 'ANXIOUS', 'ANGRY', 'LONELY', 'STRESSED'];
    if (neg.includes(primary) && (emotion?.intensity || 0) >= 3) return 'NEGATIVE';
    if (primary === 'HOPEFUL' || primary === 'GRATEFUL') return 'POSITIVE';
    return 'MIXED';
  })();

  const recentEvents = [];
  if (Array.isArray(triggers) && triggers.length) {
    for (const t of triggers.slice(0, 3)) {
      if (t && typeof t.topic === 'string' && t.topic.trim()) {
        recentEvents.push(t.topic.trim());
      }
    }
  }

  let emotionStateBlockLines;
  if (isFreeFast) {
    emotionStateBlockLines = [
      '[EMOTION_STATE]',
      `primaryEmotion: ${emotion.primaryEmotion}`,
      `intensity: ${emotion.intensity}`,
      `dominantTrend: ${dominantTrend}`,
      '[/EMOTION_STATE]',
    ];
  } else {
    const reason = typeof reasonLabel === 'string' && reasonLabel.trim()
      ? reasonLabel.trim()
      : null;

    emotionStateBlockLines = [
      '[EMOTION_STATE]',
      `primaryEmotion: ${emotion.primaryEmotion}`,
      `intensity: ${emotion.intensity}`,
      `dominantTrend: ${dominantTrend}`,
      `recentEvents: ${recentEvents.join(', ')}`,
      `loopTag: ${loopTagStr || 'NONE'}`,
      `anchors: ${anchorsList.join(', ')}`,
      ...(reason ? [`reasonLabel: ${reason}`] : []),
      '[/EMOTION_STATE]',
    ];
  }

  const summaryBlock = conversationSummary && typeof conversationSummary === 'string'
    ? ['[CONVERSATION_SUMMARY]', conversationSummary.trim(), '[/CONVERSATION_SUMMARY]']
    : [];

  const premiumToolkitBlock = engineMode === ENGINE_MODES.PREMIUM_DEEP
    ? [
        '[PREMIUM_TOOLKIT]',
        'For this reply, pick exactly ONE micro-intervention (breathing, grounding, reframing, gratitude, or gentle homework).',
        'Weave it naturally into your response in the user\'s language without naming the technique explicitly or sounding clinical.',
        'Keep it practical, safe, and emotionally validating; avoid diagnoses or medical claims.',
        '[/PREMIUM_TOOLKIT]',
      ]
    : [];

  // Optional repetition-awareness hint using the last couple of assistant replies.
  let repetitionHintBlock = '';
  if (Array.isArray(recentAssistantReplies) && recentAssistantReplies.length) {
    const snippetLines = recentAssistantReplies
      .slice(-2)
      .map((m, idx) => {
        const raw = typeof m?.content === 'string' ? m.content : '';
        const snippet = raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
        return `${idx + 1}) ${snippet}`;
      })
      .filter(Boolean);

    if (snippetLines.length) {
      repetitionHintBlock = isArabic
        ? [
            'للتذكير: هذه أمثلة على جملك الأخيرة كمساعد (لا تعِد استخدامها حرفياً في الرد الجديد):',
            ...snippetLines,
          ].join('\n')
        : [
            'Reminder: these are examples of your last couple of assistant replies (do NOT reuse these sentences verbatim in the new reply):',
            ...snippetLines,
          ].join('\n');
    }
  }

  const systemPrompt = [
    header,
    cultural,
    '',
    'Follow this character description and style strictly:',
    personaText,
    '',
    personaStyleBlock,
    '',
    emotionLine,
    stateLine,
    '',
    ...emotionStateBlockLines,
    ...(summaryBlock.length ? [''] : []),
    ...summaryBlock,
    longTermBlock ? '' : '',
    longTermBlock,
    longTermHint ? '' : '',
    longTermHint,
    identityBlock ? '' : '',
    identityBlock,
    triggersBlock ? '' : '',
    triggersBlock,
    triggersHint ? '' : '',
    triggersHint,
    repetitionHintBlock ? '' : '',
    repetitionHintBlock,
    '',
    'Safety & Empathy Rules:',
    safety,
    '',
    guidance,
    ...(premiumToolkitBlock.length ? [''] : []),
    ...premiumToolkitBlock,
  ].join('\n');

  console.log(
    '[Diagnostic] Dialect Guidance: "%s"',
    dialect == null ? 'null' : String(dialect)
  );
  try {
    const snippet =
      typeof systemPrompt === 'string' ? systemPrompt.substring(0, 200) : '';
    console.log('[Diagnostic] Final System Prompt Snippet:', `${snippet}...`);
  } catch (_) {}

  return systemPrompt;
}

/**
 * Phase 3 — Multi-model router: choose model based on intensity and state.
 * @param {Object} params
 * @param {{ intensity:number }} params.emotion
 * @param {{ currentState?:string }|null} params.convoState
 * @param {boolean} params.isPremiumUser
 */
function selectModelForResponse({ emotion, convoState, engineMode, isPremiumUser }) {
  const coreModel = process.env.OPENAI_CORE_MODEL || 'gpt-4o-mini';
  const premiumModel = process.env.OPENAI_PREMIUM_MODEL || 'gpt-4o';

  // For user-facing chat replies:
  // - Premium users always use the premium model.
  // - Non-premium users and internal/system flows use the core model.
  if (isPremiumUser) {
    return premiumModel;
  }

  return coreModel;
}

/**
 * Orchestrates the Emotional Engine pipeline for a single user message.
 * @param {Object} params
 * @param {string} params.userMessage
 * @param {Array<{role: 'user'|'assistant', content: string}>} params.recentMessages
 * @param {string} params.persona
 * @param {('ar'|'en'|'mixed')} params.language
 * @param {number|undefined|null} params.conversationId
 * @param {number} params.userId
 * @param {string} params.dialect
 * @returns {Promise<{ emo: Emotion, convoState: ConversationEmotionState|null, systemPrompt: string }>}
 */
async function runEmotionalEngine({ userMessage, recentMessages, personaId, personaText, language, conversationId, userId, dialect }) {
  try {
    const tStart = Date.now();

    let classifyMs = 0;
    let snapshotMs = 0;
    let triggersMs = 0;
    let phase4Ms = 0;
    let stateUpdateMs = 0;
    let stateReadMs = 0;

    const tClassStart = Date.now();
    const emo = await getEmotionForMessage({ userMessage, recentMessages, language });
    classifyMs = Date.now() - tClassStart;

    let convoState = null;
    try {
      const tStateUpdateStart = Date.now();
      convoState = await updateConversationEmotionState(conversationId, emo);
      stateUpdateMs = Date.now() - tStateUpdateStart;
    } catch (_) {}

    let longTermSnapshot = null;
    let triggers = [];
    let phase4Block = '';
    let identityMemory = null;

    // Fetch long-term snapshot and triggers in parallel.
    await Promise.all([
      (async () => {
        const tSnapStart = Date.now();
        try {
          longTermSnapshot = await getLongTermEmotionalSnapshot({ userId });
        } catch (_) {
          longTermSnapshot = null;
        } finally {
          snapshotMs = Date.now() - tSnapStart;
        }
      })(),
      (async () => {
        const tTrigStart = Date.now();
        try {
          triggers = await detectEmotionalTriggers({ userId });
        } catch (_) {
          triggers = [];
        } finally {
          triggersMs = Date.now() - tTrigStart;
        }
      })(),
    ]);

    // Fetch identity semantic memory (best-effort, non-blocking for rest of pipeline).
    try {
      identityMemory = await getIdentityMemory({ userId });
    } catch (_) {
      identityMemory = null;
    }

    // Build Phase 4 block after identityMemory is available so hints can include name.
    const tPhase4Start = Date.now();
    try {
      phase4Block = await buildPhase4MemoryBlock({
        userId,
        conversationId,
        language,
        personaId: personaId || 'hana',
        identityMemory,
      });
    } catch (_) {
      phase4Block = '';
    } finally {
      phase4Ms = Date.now() - tPhase4Start;
    }

    let flowState = null;
    try {
      const tStateMachineStart = Date.now();
      await updateConversationStateMachine({
        conversationId,
        emotion: emo,
        longTermSnapshot,
        severityLevel: emo.severityLevel || 'CASUAL',
      });
      stateUpdateMs += Date.now() - tStateMachineStart;
    } catch (_) {}
    try {
      const tStateReadStart = Date.now();
      flowState = await getConversationState({ conversationId });
      stateReadMs = Date.now() - tStateReadStart;
    } catch (_) {
      flowState = { currentState: 'NEUTRAL' };
    }

    try {
      const bgUserId = userId;
      const bgConversationId = conversationId;
      const bgEmotion = emo;
      const bgSnapshot = longTermSnapshot;
      const bgTriggers = triggers;

      setImmediate(() => {
        (async () => {
          try {
            await logEmotionalTimelineEvent({
              userId: bgUserId,
              conversationId: bgConversationId,
              emotion: bgEmotion,
            });
          } catch (_) {}

          try {
            await updateUserEmotionProfile({ userId: bgUserId });
          } catch (_) {}

          try {
            await updateEmotionalPatterns({
              userId: bgUserId,
              snapshot: bgSnapshot,
              triggers: bgTriggers,
            });
          } catch (_) {}
        })().catch(() => {});
      });
    } catch (_) {}

    const recentAssistantReplies = Array.isArray(recentMessages)
      ? recentMessages.filter((m) => m && m.role === 'assistant').slice(-2)
      : [];

    let systemPromptBase = buildSystemPrompt({
      personaText,
      personaId: personaId || 'hana',
      emotion: emo,
      convoState,
      language,
      longTermSnapshot,
      triggers,
      dialect,
      identityMemory,
      recentAssistantReplies,
    });

    const systemPrompt = phase4Block
      ? `${systemPromptBase}\n\n${phase4Block}`
      : systemPromptBase;

    const totalMs = Date.now() - tStart;
    console.log('[EmoEngine][Timing]', {
      userId: userId == null ? 'null' : String(userId),
      conversationId: conversationId == null ? 'null' : String(conversationId),
      classifyMs,
      snapshotMs,
      triggersMs,
      phase4Ms,
      stateUpdateMs,
      stateReadMs,
      totalMs,
      phase4BlockLen: typeof phase4Block === 'string' ? phase4Block.length : 0,
      hasConvoState: !!convoState,
      hasProfileSnapshot: !!longTermSnapshot,
    });

    return {
      emo,
      severityLevel: emo.severityLevel || 'CASUAL',
      convoState,
      systemPrompt,
      flowState,
      longTermSnapshot,
      triggers,
      identityMemory,
      personaCfg: personas[personaId] || defaultPersona,
      timings: {
        classifyMs,
        snapshotMs,
        triggersMs,
        phase4Ms,
        stateUpdateMs,
        stateReadMs,
        totalMs,
      },
    };
  } catch (e) {
    // Fallback: neutral prompt using persona only
    const fallbackEmotion = {
      primaryEmotion: 'NEUTRAL',
      intensity: 2,
      confidence: 0.3,
      cultureTag: language === 'ar' ? 'ARABIC' : 'ENGLISH',
      notes: 'engine failure fallback',
    };
    return {
      emo: fallbackEmotion,
      severityLevel: 'CASUAL',
      convoState: null,
      systemPrompt: buildSystemPrompt({ personaText, personaId: personaId || 'default', emotion: fallbackEmotion, convoState: null, language, dialect }),
      flowState: { currentState: 'NEUTRAL' },
      longTermSnapshot: null,
      triggers: [],
      personaCfg: defaultPersona,
      identityMemory: null,
    };
  }
}

module.exports = {
  runEmotionalEngine,
  classifyEmotion,
  getEmotionForMessage,
  updateConversationEmotionState,
  buildSystemPrompt,
  selectModelForResponse,
  ENGINE_MODES,
  decideEngineMode,
  getDialectGuidance,
};
