// server/src/services/whispersTrustService.js
// Whispers Mode: trust scoring + whisper unlock evaluation per user/persona.

const prisma = require('../prisma');
const { getLongTermEmotionalSnapshot } = require('./emotionalLongTerm');
const { getPersonaSnapshot, getIdentityMemory } = require('../pipeline/memory/memoryKernel');

// Helper: clamp a numeric value between min and max.
function clamp(num, min, max) {
  if (!Number.isFinite(num)) return min;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

// Helper: compare two Date objects by calendar day (local time).
function isSameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

async function getOrCreateTrust(userId, personaId) {
  const key = { userId_personaId: { userId, personaId: String(personaId) } };
  let row = null;
  try {
    row = await prisma.userPersonaTrust.findUnique({ where: key });
  } catch (_) {
    // If the table does not exist yet (migration not applied), just bail out.
    return null;
  }

  if (row) return row;

  try {
    row = await prisma.userPersonaTrust.create({
      data: {
        userId,
        personaId: String(personaId),
        trustScore: 0,
        trustLevel: 0,
        messageCount: 0,
        distinctDaysCount: 0,
      },
    });
    return row;
  } catch (err) {
    console.error('[Whispers][Trust] failed to create UserPersonaTrust', err && err.message ? err.message : err);
    return null;
  }
}

/**
 * Update trust for a single user message.
 * The formula is intentionally simple and bounded:
 * - +0.3 per message.
 * - +1.0 for a new active day (first message of a calendar day with this persona).
 * - +0.3 bonus if primaryEmotion is one of [SAD, LONELY, ANXIOUS, STRESSED].
 * - +0.2 bonus if intensity >= 4.
 * - -0.2 penalty if triggers contain a clearly toxic/abusive topic.
 *
 * trustLevel mapping (based on clamped score 0–100):
 * - 0–20  => level 0
 * - 21–50 => level 1
 * - 51–80 => level 2
 * - 81–100=> level 3
 */
async function updateTrustOnMessage({ userId, personaId, emotionSnapshot, triggers, timestamp }) {
  if (!userId || !personaId) return null;

  const now = timestamp ? new Date(timestamp) : new Date();

  const trust = await getOrCreateTrust(userId, personaId);
  if (!trust) return null;

  const prevLevel = trust.trustLevel || 0;

  const primaryRaw = emotionSnapshot && emotionSnapshot.primaryEmotion
    ? String(emotionSnapshot.primaryEmotion).toUpperCase()
    : 'NEUTRAL';
  const intensityRaw = emotionSnapshot && Number.isFinite(Number(emotionSnapshot.intensity))
    ? Number(emotionSnapshot.intensity)
    : 2;

  const vulnerableSet = new Set(['SAD', 'LONELY', 'ANXIOUS', 'STRESSED']);
  const isVulnerable = vulnerableSet.has(primaryRaw);
  const intensity = clamp(intensityRaw, 1, 5);

  let delta = 0.3; // per message base

  // New active day with this persona => strong bonding bonus.
  if (!trust.lastInteractionAt || !isSameDay(trust.lastInteractionAt, now)) {
    delta += 1.0;
  }

  if (isVulnerable) {
    delta += 0.3;
  }

  if (intensity >= 4) {
    delta += 0.2;
  }

  // Basic toxicity penalty based on trigger topics/kinds.
  try {
    if (Array.isArray(triggers) && triggers.length) {
      const toxic = triggers.some((t) => {
        if (!t) return false;
        const type = String(t.type || t.topic || '').toLowerCase();
        return (
          type.includes('insult') ||
          type.includes('abuse') ||
          type.includes('harass') ||
          type.includes('toxic') ||
          type.includes('attack')
        );
      });
      if (toxic) {
        delta -= 0.2;
      }
    }
  } catch (_) {
    // best-effort only
  }

  // Ensure we still move forward a tiny bit for non-toxic messages.
  if (delta < 0.1) delta = 0.1;

  let nextScore = clamp((trust.trustScore || 0) + delta, 0, 100);

  let nextLevel = 0;
  if (nextScore > 80) {
    nextLevel = 3;
  } else if (nextScore > 50) {
    nextLevel = 2;
  } else if (nextScore > 20) {
    nextLevel = 1;
  } else {
    nextLevel = 0;
  }

  const isNewDay = !trust.lastInteractionAt || !isSameDay(trust.lastInteractionAt, now);

  try {
    const updated = await prisma.userPersonaTrust.update({
      where: { userId_personaId: { userId, personaId: String(personaId) } },
      data: {
        trustScore: nextScore,
        trustLevel: nextLevel,
        messageCount: { increment: 1 },
        distinctDaysCount: isNewDay ? trust.distinctDaysCount + 1 : trust.distinctDaysCount,
        lastInteractionAt: now,
        lastEvaluatedAt: now,
      },
    });
    return { trust: updated, previousLevel: prevLevel };
  } catch (err) {
    console.error('[Whispers][Trust] failed to update UserPersonaTrust', err && err.message ? err.message : err);
    return null;
  }
}

async function evaluateWhisperUnlocks({ userId, personaId }) {
  if (!userId || !personaId) return [];

  let trust;
  try {
    trust = await prisma.userPersonaTrust.findUnique({
      where: { userId_personaId: { userId, personaId: String(personaId) } },
    });
  } catch (err) {
    console.error('[Whispers][Evaluate] failed to load UserPersonaTrust', err && err.message ? err.message : err);
    return [];
  }

  if (!trust || (trust.trustLevel || 0) <= 0) {
    return [];
  }

  const now = new Date();

  // Rate limit: at most one new whisper per user/persona per calendar day.
  if (trust.lastWhisperUnlockedAt && isSameDay(trust.lastWhisperUnlockedAt, now)) {
    return [];
  }

  let whispers = [];
  let unlockedRows = [];

  try {
    [whispers, unlockedRows] = await Promise.all([
      prisma.personaWhisper.findMany({
        where: {
          personaId: String(personaId),
          levelRequired: { lte: trust.trustLevel },
          isActive: true,
        },
        orderBy: [{ levelRequired: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
      }),
      prisma.userUnlockedWhisper.findMany({
        where: { userId, personaId: String(personaId) },
        select: { whisperId: true },
      }),
    ]);
  } catch (err) {
    console.error('[Whispers][Evaluate] failed to query whispers', err && err.message ? err.message : err);
    return [];
  }

  if (!Array.isArray(whispers) || whispers.length === 0) {
    return [];
  }

  const unlockedSet = new Set((unlockedRows || []).map((r) => r.whisperId));
  const eligible = whispers.filter((w) => !unlockedSet.has(w.id));

  if (!eligible.length) {
    return [];
  }

  // Only unlock one at a time to keep the experience paced.
  const target = eligible[0];

  let userName = null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    userName = user && typeof user.name === 'string' ? user.name.trim() : null;
  } catch (_) {
    userName = null;
  }

  const unlockedAt = now;

  let created;
  try {
    created = await prisma.userUnlockedWhisper.create({
      data: {
        userId,
        personaId: String(personaId),
        whisperId: target.id,
        unlockedAt,
      },
    });

    await prisma.userPersonaTrust.update({
      where: { userId_personaId: { userId, personaId: String(personaId) } },
      data: {
        lastWhisperUnlockedAt: unlockedAt,
        lastEvaluatedAt: now,
      },
    });
  } catch (err) {
    console.error('[Whispers][Evaluate] failed to create UserUnlockedWhisper', err && err.message ? err.message : err);
    return [];
  }

  // --- Build a language-aware, memory-grounded whisper content ---
  const rawTemplate = target.contentTemplate || '';
  const language =
    /[\u0600-\u06FF]/.test(rawTemplate) || /[\u0600-\u06FF]/.test(userName || '')
      ? 'ar'
      : 'en';

  let personaSnapshot = null;
  let longTermSnapshot = null;
  let identityMemory = null;

  try {
    personaSnapshot = await getPersonaSnapshot({ userId });
  } catch (_) {
    personaSnapshot = null;
  }

  try {
    longTermSnapshot = await getLongTermEmotionalSnapshot({ userId });
  } catch (_) {
    longTermSnapshot = null;
  }

  try {
    identityMemory = await getIdentityMemory({ userId });
  } catch (_) {
    identityMemory = null;
  }

  const facts = personaSnapshot && typeof personaSnapshot.facts === 'object'
    ? personaSnapshot.facts
    : {};
  const profileFacts = facts.profile || {};
  const prefFacts = facts.preferences || {};

  const safeName = identityMemory && typeof identityMemory.name === 'string' ? identityMemory.name.trim() : null;
  const age = typeof profileFacts.age === 'string' ? profileFacts.age.trim() : null;
  const jobTitle =
    profileFacts.job && typeof profileFacts.job.title === 'string'
      ? profileFacts.job.title.trim()
      : null;
  const dream =
    profileFacts.goals && typeof profileFacts.goals.longTerm === 'string'
      ? profileFacts.goals.longTerm.trim()
      : null;
  const favWeather =
    Array.isArray(prefFacts.weatherLike) && prefFacts.weatherLike.length
      ? prefFacts.weatherLike[0]
      : Array.isArray(prefFacts.seasonsLike) && prefFacts.seasonsLike.length
      ? prefFacts.seasonsLike[0]
      : null;
  const favDrink =
    Array.isArray(prefFacts.drinkLike) && prefFacts.drinkLike.length
      ? prefFacts.drinkLike[0]
      : null;
  const favFood =
    Array.isArray(prefFacts.foodLike) && prefFacts.foodLike.length
      ? prefFacts.foodLike[0]
      : null;
  const hobbies =
    Array.isArray(prefFacts.hobbyLike) && prefFacts.hobbyLike.length
      ? prefFacts.hobbyLike.filter(Boolean).join(', ')
      : null;

  const dominantLongTerm = longTermSnapshot && longTermSnapshot.dominantLongTermEmotion
    ? String(longTermSnapshot.dominantLongTermEmotion).toUpperCase()
    : null;
  const avgIntensity = longTermSnapshot && typeof longTermSnapshot.avgIntensity === 'number'
    ? longTermSnapshot.avgIntensity
    : null;

  const pieces = [];

  if (language === 'ar') {
    if (safeName) pieces.push(`أسمع اسمك يتكرر: ${safeName}.`);
    if (age) pieces.push(`عمرك الذي ذكرتَه: ${age}.`);
    if (jobTitle) pieces.push(`تتصرف كمن يعيش دور "${jobTitle}".`);
    if (dream) pieces.push(`حلمك الطويل الذي تلمّح له كثيرًا: ${dream}.`);
    if (favWeather) pieces.push(`تبتسم عندما يذكَر ${favWeather}.`);
    if (favDrink) pieces.push(`مشروبك المألوف في أحاديثك: ${favDrink}.`);
    if (favFood) pieces.push(`طعام ترتاح له: ${favFood}.`);
    if (hobbies) pieces.push(`الهوايات التي كررتها: ${hobbies}.`);
    if (dominantLongTerm) {
      pieces.push(`مزاجك البعيد يميل إلى ${dominantLongTerm.toLowerCase()} أكثر من غيره.`);
    }
    if (avgIntensity != null) {
      pieces.push(`حدة شعورك في محادثات كثيرة كانت حول ${(avgIntensity * 5).toFixed(1)}/5.`);
    }
  } else {
    if (safeName) pieces.push(`I keep hearing your name as "${safeName}".`);
    if (age) pieces.push(`You once shared your age as ${age}.`);
    if (jobTitle) pieces.push(`You move like someone living the role of "${jobTitle}".`);
    if (dream) pieces.push(`A long-term dream you hinted at: ${dream}.`);
    if (favWeather) pieces.push(`You soften when talking about ${favWeather}.`);
    if (favDrink) pieces.push(`Your go-to drink you mentioned: ${favDrink}.`);
    if (favFood) pieces.push(`Food that comforts you: ${favFood}.`);
    if (hobbies) pieces.push(`Hobbies you actually named: ${hobbies}.`);
    if (dominantLongTerm) {
      pieces.push(`Across time, your mood drifts toward ${dominantLongTerm.toLowerCase()}.`);
    }
    if (avgIntensity != null) {
      pieces.push(`Your emotional intensity often sits near ${(avgIntensity * 5).toFixed(1)}/5.`);
    }
  }

  const noDataLine =
    language === 'ar'
      ? 'لا أملك بعد تفاصيل كافية لهمسة عميقة. استمر في مشاركتك الحقيقية معي.'
      : "I don’t have enough real details yet for a deep whisper. Keep sharing honestly with me.";

  const personalizedBody = pieces.length ? pieces.join(' ') : noDataLine;

  const finalContent = [rawTemplate, personalizedBody]
    .filter((s) => s && String(s).trim())
    .join('\n\n')
    .trim();

  try {
    console.log('[Whispers][Evaluate] personalization_meta', {
      userId,
      personaId: String(personaId),
      lang: language,
      hasName: !!safeName,
      hasPersonaSnapshot: !!personaSnapshot && !!(personaSnapshot.summaryLinesEn?.length || personaSnapshot.summaryLinesAr?.length),
      hasLongTermSnapshot: !!longTermSnapshot,
    });
  } catch (_) {}

  return [
    {
      id: target.id,
      title: target.title,
      content: finalContent,
      levelRequired: target.levelRequired,
      unlockedAt: created.unlockedAt,
    },
  ];
}

module.exports = {
  updateTrustOnMessage,
  evaluateWhisperUnlocks,
};
