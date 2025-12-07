// server/src/services/whispersTrustService.js
// Whispers Mode: trust scoring + whisper unlock evaluation per user/persona.

const prisma = require('../prisma');

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

  const raw = target.contentTemplate || '';
  const finalContent = userName
    ? raw.replace(/\{userName\}/g, userName)
    : raw.replace(/\{userName\}/g, '').trim();

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
