// server/src/services/portalsService.js
// Hidden Portals readiness + scoring using existing data only.

const prisma = require('../prisma');
const { getPersonaSnapshot, getIdentityMemory } = require('../pipeline/memory/memoryKernel');
const { detectEmotionalTriggers } = require('./emotionalLongTerm');

const THRESHOLDS = {
  messages: 40,
  days: 5,
  events: 25,
  facts: 3,
};

const TRAIT_MAP = {
  door: {
    steel: { caution: 2, guarded: 2 },
    wooden: { openness: 2, warmth: 1 },
    neon: { escape: 2, risk: 1 },
    glass: { transparency: 2, vulnerability: 1 },
  },
  chat: {
    long_short: { expressive: 2, unmetSupport: 1 },
    spam_short: { anxiousAttachment: 2, urgency: 1 },
    short_long: { contained: 2, observer: 1 },
    balanced: { balanced: 2 },
  },
  storm: {
    run: { caution: 2, pragmatism: 1 },
    keep_walking: { endurance: 2, numbing: 1 },
    film: { curiosity: 2, detachment: 1 },
    stare: { freeze: 2, absorption: 1 },
  },
  elevator: {
    alarm: { seeksHelp: 2, reactive: 1 },
    open: { control: 2, quickExit: 1 },
    floor: { improvisation: 2, risk: 1 },
    freeze: { freeze: 2, overwhelm: 1 },
  },
  self_image: {
    strong_blurred: { resilience: 2, hiddenFatigue: 1 },
    blurred_sharp: { dissociation: 2, observer: 1 },
    shadow_light: { duality: 2, selfReflection: 1 },
    fragmented: { fragility: 2, selfCriticism: 1 },
  },
  chest: {
    stone: { heaviness: 2, suppressedSadness: 1 },
    balloon: { hope: 2, restless: 1 },
    cracks: { breakthrough: 2, sensitivity: 1 },
    rope: { tension: 2, restraint: 1 },
  },
  ghost: {
    time: { regret: 2, pressure: 1 },
    love: { loss: 2, attachment: 1 },
    work: { duty: 2, pressure: 2 },
    mirror: { selfReflection: 2, identity: 1 },
  },
  time_glitch: {
    sleep: { exhaustion: 2, selfNeglect: 1 },
    future: { ambition: 2, control: 1 },
    scroll: { escape: 2, numbing: 1 },
    someone: { connection: 2, supportSeeking: 1 },
  },
  hidden_room: {
    no_one: { guarded: 2, selfReliance: 1 },
    one_person: { selectiveTrust: 2 },
    few_close: { connection: 2, trust: 1 },
    anyone: { openness: 2, compassion: 1 },
  },
  glitch: {
    strong_tired: { hiddenFatigue: 2, duty: 1 },
    complicated: { complexity: 2, selfCriticism: 1 },
    easygoing_mind: { overthinking: 2, charm: 1 },
    quiet_notice: { observer: 2, sensitivity: 1 },
  },
  noise: {
    rain: { calm: 2, reflective: 1 },
    street: { overstimulated: 2, pressure: 1 },
    static: { anxiousMind: 2, restless: 1 },
    heartbeat: { minimalism: 2, control: 1 },
  },
};

const PORTAL_KEY_ORDER = [
  'door',
  'chat',
  'storm',
  'elevator',
  'self_image',
  'chest',
  'ghost',
  'time_glitch',
  'hidden_room',
  'glitch',
  'noise',
];

function addScores(aggregate, delta) {
  for (const [trait, val] of Object.entries(delta || {})) {
    aggregate[trait] = (aggregate[trait] || 0) + val;
  }
}

/**
 * computeReadiness
 * Inputs: total user messages (all personas), distinct active days, emotion profile variety,
 * and persona/identity fact density (userMemoryFact).
 * Combines four capped signals into a 0-100 score: messages (0-30), days (0-30),
 * emotional variety/balance (0-20), persona facts (0-20). Early caps prevent
 * high percentages with low data. Ready only when high-engagement thresholds are met.
 */
async function computeReadiness({ userId }) {
  const stats = {
    totalMessages: 0,
    distinctActiveDays: 0,
    knownFactsCount: 0,
  };

  // Total messages across all conversations/personas
  try {
    stats.totalMessages = await prisma.message.count({ where: { userId } });
  } catch (_) {}

  // Distinct active days (recent messages, capped fetch)
  try {
    const days = await prisma.message.findMany({
      where: { userId },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 800,
    });
    const distinct = new Set();
    for (const d of days) {
      if (d.createdAt instanceof Date) {
        const key = d.createdAt.toISOString().slice(0, 10);
        distinct.add(key);
      }
    }
    stats.distinctActiveDays = distinct.size;
  } catch (_) {}

  // Persona / identity facts
  try {
    stats.knownFactsCount = await prisma.userMemoryFact.count({
      where: { userId },
    });
  } catch (_) {}

  // Emotion profile variety (positive + negative coverage)
  let emotionVarietyScore = 0;
  let hasPositive = false;
  let hasNegative = false;
  try {
    const prof = await prisma.userEmotionProfile.findUnique({ where: { userId } });
    if (prof) {
      const categories = [
        prof.sadnessScore || 0,
        prof.anxietyScore || 0,
        prof.angerScore || 0,
        prof.lonelinessScore || 0,
        prof.hopeScore || 0,
        prof.gratitudeScore || 0,
      ];
      const threshold = 0.08;
      const varietyCount = categories.filter((v) => v >= threshold).length;
      const positiveSum = (prof.hopeScore || 0) + (prof.gratitudeScore || 0);
      const negativeSum = (prof.sadnessScore || 0) + (prof.anxietyScore || 0) + (prof.angerScore || 0) + (prof.lonelinessScore || 0);
      hasPositive = positiveSum >= 0.2;
      hasNegative = negativeSum >= 0.2;

      const baseVariety = Math.min(varietyCount / 6, 1) * 12; // up to 12
      const balanceBonus = hasPositive && hasNegative ? 6 : 0;
      const intensityBonus = Math.min((prof.avgIntensity || 0) * 5, 2); // up to 2
      emotionVarietyScore = Math.min(20, Math.max(0, baseVariety + balanceBonus + intensityBonus));
    }
  } catch (_) {}

  // Scoring components (capped)
  const messagesScore = Math.min(stats.totalMessages / 150, 1) * 30; // 0-30
  const daysScore = Math.min(stats.distinctActiveDays / 10, 1) * 30; // 0-30
  const personaFactsScore = Math.min(stats.knownFactsCount / 15, 1) * 20; // 0-20
  const rawScore = messagesScore + daysScore + emotionVarietyScore + personaFactsScore;
  const rawPercent = Math.max(0, Math.min(100, rawScore));

  // Early conservative caps
  let readinessPercent = rawPercent;
  if (stats.totalMessages < 50 || stats.distinctActiveDays < 3) {
    readinessPercent = Math.min(readinessPercent, 15);
  } else if (stats.totalMessages < 120 || stats.distinctActiveDays < 7) {
    readinessPercent = Math.min(readinessPercent, 40);
  }

  // High-bar gate for >70%
  if (!(stats.totalMessages >= 200 && stats.distinctActiveDays >= 10 && stats.knownFactsCount >= 8 && hasPositive && hasNegative)) {
    readinessPercent = Math.min(readinessPercent, 70);
  }

  const reasons = [];
  if (stats.totalMessages < 50) reasons.push('NOT_ENOUGH_MESSAGES');
  if (stats.distinctActiveDays < 3) reasons.push('NOT_ENOUGH_DAYS');
  if (!hasPositive || !hasNegative || emotionVarietyScore < 10) reasons.push('LOW_EMOTION_VARIETY');
  if (stats.knownFactsCount < 8) reasons.push('NOT_ENOUGH_FACTS');

  const ready =
    readinessPercent >= 70 &&
    stats.totalMessages >= 200 &&
    stats.distinctActiveDays >= 10 &&
    stats.knownFactsCount >= 8 &&
    hasPositive &&
    hasNegative;

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[PortalsReadiness] userId=${userId} messages=${stats.totalMessages} days=${stats.distinctActiveDays} varietyScore=${emotionVarietyScore.toFixed(
        2,
      )} personaFacts=${stats.knownFactsCount} rawScore=${rawPercent.toFixed(2)} readiness=${readinessPercent.toFixed(2)}`,
    );
  }

  return {
    ready,
    progress: Math.max(0, Math.min(1, readinessPercent / 100)),
    readinessPercent: Math.round(readinessPercent),
    reasons,
    breakdown: {
      totalMessages: stats.totalMessages,
      distinctDays: stats.distinctActiveDays,
      emotionVarietyScore: Number(emotionVarietyScore.toFixed(2)),
      personaFactCount: stats.knownFactsCount,
      rawScore: Number(rawPercent.toFixed(2)),
      hasPositiveEmotion: hasPositive,
      hasNegativeEmotion: hasNegative,
    },
    stats,
  };
}

function scoreTraits(answersMap) {
  const traits = {};
  PORTAL_KEY_ORDER.forEach((key, idx) => {
    const answer = answersMap[idx];
    if (!answer) return;
    const map = TRAIT_MAP[key] || {};
    const delta = map[answer];
    if (delta) addScores(traits, delta);
  });
  return traits;
}

async function buildPortalsResult({ userId, traits }) {
  const themes = [];
  let personaSnapshot = null;
  let identityMemory = null;
  let triggers = [];

  try {
    personaSnapshot = await getPersonaSnapshot({ userId });
  } catch (_) {}
  try {
    identityMemory = await getIdentityMemory({ userId });
  } catch (_) {}
  try {
    triggers = await detectEmotionalTriggers({ userId });
  } catch (_) {}

  const triggerTopics = (triggers || []).map((t) => t.topic).filter(Boolean);
  if (triggerTopics.length) themes.push(...triggerTopics);

  const factLinesEn = personaSnapshot?.summaryLinesEn || [];
  const factLinesAr = personaSnapshot?.summaryLinesAr || [];
  const name = identityMemory && typeof identityMemory.name === 'string' ? identityMemory.name.trim() : null;

  const dominantTraits = Object.entries(traits || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k.replace(/([A-Z])/g, ' $1').toLowerCase());

  const confidence = Math.max(0.3, Math.min(1, (dominantTraits.length ? 0.2 : 0) + (themes.length ? 0.2 : 0) + 0.4));

  const baseEn = [];
  if (name) baseEn.push(`You move like someone named ${name}.`);
  if (dominantTraits.length) baseEn.push(`Your choices hint at ${dominantTraits.join(', ')} shaping how you react.`);
  if (triggerTopics.length) baseEn.push(`Real conversations keep circling around ${triggerTopics.join(', ')}.`);
  baseEn.push('These patterns come from how you talk, how you feel, and how you answered the 11 portals.');
  if (confidence < 0.5) baseEn.push('This reflection is still forming; more days of talking will sharpen it.');
  const summaryEn = baseEn.filter(Boolean).join(' ');

  const baseAr = [];
  if (name) baseAr.push(`تتحرك كشخص اسمه ${name}.`);
  if (dominantTraits.length) baseAr.push(`اختياراتك تشير إلى أن ${dominantTraits.join('، ')} تشكل ردود فعلك.`);
  if (triggerTopics.length) baseAr.push(`المحادثات الحقيقية تدور كثيراً حول ${triggerTopics.join('، ')}.`);
  baseAr.push('هذه الأنماط مبنية على حديثك، مشاعرك، وإجاباتك على البوابات الـ11.');
  if (confidence < 0.5) baseAr.push('هذا الانعكاس ما زال يتكون؛ المزيد من الأيام ستجعله أدق.');
  const summaryAr = baseAr.filter(Boolean).join(' ');

  return {
    traits,
    themes,
    summaryEn,
    summaryAr,
    confidence,
  };
}

async function savePortalsResult({ userId, result }) {
  const payload = JSON.stringify(result || {});
  try {
    await prisma.userMemoryFact.upsert({
      where: {
        userId_kind: {
          userId,
          kind: 'profile.personality.portals_v1',
        },
      },
      update: { value: payload },
      create: {
        userId,
        kind: 'profile.personality.portals_v1',
        value: payload,
      },
    });
  } catch (_) {}
}

module.exports = {
  computeReadiness,
  scoreTraits,
  buildPortalsResult,
  savePortalsResult,
  PORTAL_KEY_ORDER,
};
