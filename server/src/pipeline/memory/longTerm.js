// server/src/pipeline/memory/longTerm.js
// Long-term emotional memory (per-user profile)

const prisma = require('../../prisma');

/**
 * Safely parse a JSON-like field from Prisma (which is already JS) into an object.
 */
function ensureObject(val) {
  if (!val || typeof val !== 'object') return {};
  return { ...val };
}

/**
 * Update long-term emotional profile for a user.
 *
 * @param {number} userId
 * @param {Object} event
 * @param {{ primaryEmotion:string, intensity:number }} event.emotion
 * @param {string[]} [event.topics]
 * @param {string} [event.characterId]
 * @param {number|null} [event.intensityDelta]
 * @param {string|null} [event.trend]
 * @param {Object|null} [outcome]
 */
async function updateLongTerm(userId, event, outcome) {
  if (!userId || !event || !event.emotion) return;

  const emo = event.emotion;
  const topics = Array.isArray(event.topics) ? event.topics.filter(Boolean) : [];
  const personaId = event.characterId || null;
  const now = new Date();

  const intensity01 = Math.max(0, Math.min(1, (emo.intensity || 1) / 5));
  const delta = typeof event.intensityDelta === 'number' ? event.intensityDelta : null;

  let profile = await prisma.userEmotionProfile.findUnique({
    where: { userId },
  });

  let emotionStats = ensureObject(profile && profile.emotionStats);
  let topicProfile = ensureObject(profile && profile.topicProfile);
  let personaAffinity = ensureObject(profile && profile.personaAffinity);
  let volatilityIndex = profile && typeof profile.volatilityIndex === 'number'
    ? profile.volatilityIndex
    : 0;

  // Update per-emotion stats
  const label = emo.primaryEmotion || 'NEUTRAL';
  if (!emotionStats[label]) {
    emotionStats[label] = {
      count: 0,
      avgIntensity: 0,
      lastSeenAt: null,
    };
  }
  const eStat = emotionStats[label];
  const newCount = (eStat.count || 0) + 1;
  const prevAvg = typeof eStat.avgIntensity === 'number' ? eStat.avgIntensity : 0;
  const nextAvg = (prevAvg * (eStat.count || 0) + intensity01) / newCount;
  emotionStats[label] = {
    count: newCount,
    avgIntensity: nextAvg,
    lastSeenAt: now,
  };

  // Update topic profile
  for (const t of topics) {
    if (!t) continue;
    if (!topicProfile[t]) {
      topicProfile[t] = {
        count: 0,
        lastSeenAt: null,
        score: 0,
      };
    }
    const tp = topicProfile[t];
    const prevCount = tp.count || 0;
    tp.count = prevCount + 1;
    tp.lastSeenAt = now;
    // Simple decayed score: keep small, bounded values.
    const prevScore = typeof tp.score === 'number' ? tp.score : 0;
    tp.score = Math.min(prevScore * 0.9 + intensity01, 10);
    topicProfile[t] = tp;
  }

  // Persona affinity per character (optional but useful)
  if (personaId) {
    if (!personaAffinity[personaId]) {
      personaAffinity[personaId] = {
        uses: 0,
        avgOutcome: 0,
        lastUsedAt: null,
        lastTrend: null,
      };
    }
    const pa = personaAffinity[personaId];
    const prevUses = pa.uses || 0;

    // Outcome score: heuristic based on intensityDelta or external outcome.
    let outcomeScore = 0;
    if (outcome && typeof outcome.score === 'number') {
      outcomeScore = outcome.score;
    } else if (delta != null) {
      // If intensity is going down, treat it as positive (improvement).
      outcomeScore = delta < 0 ? 1 : delta > 0 ? -1 : 0;
    }

    const prevAvgOutcome = typeof pa.avgOutcome === 'number' ? pa.avgOutcome : 0;
    const newUses = prevUses + 1;
    const nextAvgOutcome = (prevAvgOutcome * prevUses + outcomeScore) / newUses;

    personaAffinity[personaId] = {
      uses: newUses,
      avgOutcome: nextAvgOutcome,
      lastUsedAt: now,
      lastTrend: event.trend || pa.lastTrend || null,
    };
  }

  // Volatility index: exponential moving average of absolute intensity deltas.
  if (delta != null) {
    const absDelta01 = Math.min(Math.abs(delta) / 5, 1);
    const alpha = 0.1;
    volatilityIndex = volatilityIndex > 0
      ? (1 - alpha) * volatilityIndex + alpha * absDelta01
      : absDelta01;
  }

  // Lightweight snapshot for quick access when building prompts.
  const recentKernelSnapshot = {
    lastEmotion: label,
    lastIntensity: emo.intensity || 0,
    lastUpdatedAt: now.toISOString(),
  };

  // Upsert profile with new Phase 4 fields.
  await prisma.userEmotionProfile.upsert({
    where: { userId },
    create: {
      userId,
      emotionStats,
      topicProfile,
      personaAffinity,
      volatilityIndex,
      recentKernelSnapshot,
      lastUpdatedAt: now,
    },
    update: {
      emotionStats,
      topicProfile,
      personaAffinity,
      volatilityIndex,
      recentKernelSnapshot,
      lastUpdatedAt: now,
    },
  });
}

module.exports = {
  updateLongTerm,
};

