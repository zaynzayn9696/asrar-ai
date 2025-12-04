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
 * @param {Object} params
 * @param {string} params.userMessage
 * @param {Array<{role: 'user'|'assistant', content: string}>} params.recentMessages
 * @param {('ar'|'en'|'mixed')} params.language
 * @param {string} [params.dialect]
 * @returns {Promise<Emotion>}
 */
async function classifyEmotion({ userMessage, recentMessages = [], language = 'en' }) {
  const cultureGuess = language === 'ar' ? 'ARABIC' : language === 'mixed' ? 'MIXED' : 'ENGLISH';

  // Build a compact context summary to keep token usage reasonable
  const recentSummary = recentMessages
    .slice(-12)
    .map((m) => `${m.role === 'assistant' ? 'AI' : 'User'}: ${String(m.content || '').slice(0, 280)}`)
    .join('\n');

  const sys = [
    'You are an emotion classification engine for a mental-wellbeing chat app called Asrar.',
    'Output STRICT JSON only with these keys: primaryEmotion, intensity, confidence, cultureTag, notes, severityLevel.',
    'Do not include explanations outside JSON. No markdown.',
    'Use one of the following for primaryEmotion: NEUTRAL, SAD, ANXIOUS, ANGRY, LONELY, STRESSED, HOPEFUL, GRATEFUL.',
    'intensity must be an integer 1-5. confidence is a float 0-1.',
    'cultureTag must be one of: "ARABIC", "ENGLISH", "MIXED".',
    'severityLevel must be one of: "CASUAL", "VENTING", "SUPPORT", "HIGH_RISK".',
  ].join('\n');

  const user = [
    `Language: ${language}`,
    'Recent conversation (most recent last):',
    recentSummary || '(no prior messages)',
    '',
    'Current user message:',
    String(userMessage || '').slice(0, 2000),
  ].join('\n');

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
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

  if (!hasHistory) {
    const text = String(userMessage || '').toLowerCase();
    const cultureTag =
      language === 'ar' ? 'ARABIC' : language === 'mixed' ? 'MIXED' : 'ENGLISH';

    let primaryEmotion = 'NEUTRAL';
    if (/(sad|depress|cry|alone|lonely|hurt)/.test(text)) {
      primaryEmotion = 'SAD';
    } else if (/(anxious|anxiety|worried|worry|panic|nervous|afraid|scared)/.test(text)) {
      primaryEmotion = 'ANXIOUS';
    } else if (/(angry|mad|furious|rage|irritated|pissed)/.test(text)) {
      primaryEmotion = 'ANGRY';
    } else if (/(stress|stressed|overwhelmed|burnout|burned out|tired of)/.test(text)) {
      primaryEmotion = 'STRESSED';
    } else if (/(grateful|thankful|hopeful|optimistic)/.test(text)) {
      primaryEmotion = 'HOPEFUL';
    }

    const approxLength = text.length;
    const lengthFactor = Math.max(0, Math.min(approxLength / 80, 4));
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

  return classifyEmotion({ userMessage, recentMessages, language });
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
 * @returns {string}
 */
function buildSystemPrompt({ personaText, personaId, emotion, convoState, language, longTermSnapshot, triggers, engineMode, loopTag, anchors, conversationSummary, isPremiumUser, reasonLabel, dialect }) {
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

  const guidance = isArabic
    ? 'حافظ على ردود موجزة واضحة (٣–٦ جمل عادةً) ما لم يطلب المستخدم تفاصيل أكثر.'
    : 'Keep replies concise (about 3–6 sentences) unless the user clearly asks for more detail.';

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

  const personaStyleBlock = [
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
    triggersBlock ? '' : '',
    triggersBlock,
    triggersHint ? '' : '',
    triggersHint,
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

    const tClassStart = Date.now();
    const emo = await getEmotionForMessage({ userMessage, recentMessages, language });
    const classifyMs = Date.now() - tClassStart;

    // Only update conversation state if we have a conversationId
    let convoState = null;
    try {
      convoState = await updateConversationEmotionState(conversationId, emo);
    } catch (_) {}

    // Phase 2: Long-term intelligence (best-effort; failures are non-fatal)
    // Log timeline event if meaningful
    try { await logEmotionalTimelineEvent({ userId, conversationId, emotion: emo }); } catch (_) {}
    // Update aggregated user profile
    try { await updateUserEmotionProfile({ userId }); } catch (_) {}
    // Snapshot and triggers (best-effort)
    let longTermSnapshot = null;
    try { longTermSnapshot = await getLongTermEmotionalSnapshot({ userId }); } catch (_) {}
    let triggers = [];
    try { triggers = await detectEmotionalTriggers({ userId }); } catch (_) { triggers = []; }
    // Lightweight pattern extraction over long-term profile (best-effort)
    try { await updateEmotionalPatterns({ userId }); } catch (_) {}

    // Phase 3: Emotional Pattern table (best-effort, non-blocking)
    try {
      await updateEmotionalPatterns({
        userId,
        snapshot: longTermSnapshot,
        triggers,
      });
    } catch (_) {}

    // Phase 3: update and fetch conversation state machine
    let flowState = null;
    try { await updateConversationStateMachine({ conversationId, emotion: emo, longTermSnapshot, severityLevel: emo.severityLevel || 'CASUAL' }); } catch (_) {}
    try { flowState = await getConversationState({ conversationId }); } catch (_) { flowState = { currentState: 'NEUTRAL' }; }

    let systemPromptBase = buildSystemPrompt({
      personaText,
      personaId: personaId || 'hana',
      emotion: emo,
      convoState,
      language,
      longTermSnapshot,
      triggers,
      dialect,
    });

    // Phase 4: memory-aware additive block (short + long-term kernel)
    let phase4Block = '';
    try {
      phase4Block = await buildPhase4MemoryBlock({
        userId,
        conversationId,
        language,
        personaId: personaId || 'hana',
      });
    } catch (_) {
      phase4Block = '';
    }

    const systemPrompt = phase4Block
      ? `${systemPromptBase}\n\n${phase4Block}`
      : systemPromptBase;

    const totalMs = Date.now() - tStart;
    console.log(
      '[EmoEngine] convoId=%s userId=%s classifyMs=%d totalMs=%d phase4BlockLen=%d hasConvoState=%s hasProfileSnapshot=%s',
      conversationId == null ? 'null' : String(conversationId),
      userId == null ? 'null' : String(userId),
      classifyMs,
      totalMs,
      typeof phase4Block === 'string' ? phase4Block.length : 0,
      !!convoState,
      !!longTermSnapshot
    );

    return {
      emo,
      severityLevel: emo.severityLevel || 'CASUAL',
      convoState,
      systemPrompt,
      flowState,
      longTermSnapshot,
      triggers,
      personaCfg: personas[personaId] || defaultPersona,
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
