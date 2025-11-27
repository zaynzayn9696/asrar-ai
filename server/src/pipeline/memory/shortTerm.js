// server/src/pipeline/memory/shortTerm.js
// Short-term emotional memory (per-conversation rolling window)

const prisma = require('../../prisma');

const DEFAULT_WINDOW_SIZE = 20;

/**
 * Compute a simple trend label based on intensity delta.
 * @param {number|null} delta
 * @returns {('UP'|'DOWN'|'STABLE'|'VOLATILE'|null)}
 */
function classifyTrend(delta) {
  if (delta == null || Number.isNaN(delta)) return null;
  const d = delta;
  const abs = Math.abs(d);
  if (abs < 0.5) return 'STABLE';
  if (abs >= 3) return 'VOLATILE';
  return d > 0 ? 'UP' : 'DOWN';
}

/**
 * Update the rolling emotional state for a conversation.
 * This is additive on top of the existing ConversationEmotionState logic.
 *
 * @param {number} conversationId
 * @param {Object} event
 * @param {number} event.userId
 * @param {{ primaryEmotion:string, intensity:number }} event.emotion
 * @param {number} event.messageId
 * @param {string[]} [event.topics]
 * @returns {Promise<{ intensityDelta:number|null, trend:string|null }|null>}
 */
async function updateShortTerm(conversationId, event) {
  if (!conversationId || !event || !event.emotion) return null;

  const emo = event.emotion;
  const topics = Array.isArray(event.topics) ? event.topics.filter(Boolean) : [];
  const now = new Date();

  // Fetch existing state if present (created by Emotional Engine v1/v2).
  let state = await prisma.conversationEmotionState.findUnique({
    where: { conversationId },
  });

  if (!state) {
    // If for some reason the state does not exist yet, create a minimal one.
    const intensity01 = Math.max(0, Math.min(1, (emo.intensity || 1) / 5));
    state = await prisma.conversationEmotionState.create({
      data: {
        conversationId,
        dominantEmotion: emo.primaryEmotion || 'NEUTRAL',
        avgIntensity: intensity01,
        sadnessScore: emo.primaryEmotion === 'SAD' ? intensity01 : 0,
        anxietyScore: emo.primaryEmotion === 'ANXIOUS' ? intensity01 : 0,
        angerScore: emo.primaryEmotion === 'ANGRY' ? intensity01 : 0,
        lonelinessScore: emo.primaryEmotion === 'LONELY' ? intensity01 : 0,
      },
    });
  }

  // Find previous emotion in this conversation (user messages only).
  const prevEmotion = await prisma.messageEmotion.findFirst({
    where: {
      messageId: { not: event.messageId },
      message: {
        conversationId,
        userId: event.userId,
        role: 'user',
      },
    },
    orderBy: { id: 'desc' },
  });

  let intensityDelta = null;
  if (prevEmotion && typeof prevEmotion.intensity === 'number') {
    intensityDelta = (emo.intensity || 0) - (prevEmotion.intensity || 0);
  }
  const trend = classifyTrend(intensityDelta);

  // Update the MessageEmotion row with the computed delta + trend if possible.
  try {
    await prisma.messageEmotion.update({
      where: { messageId: event.messageId },
      data: {
        intensityDelta: intensityDelta != null ? intensityDelta : undefined,
        trend: trend || undefined,
      },
    });
  } catch (err) {
    console.error('[ShortTerm] Failed to update MessageEmotion with trend', err && err.message ? err.message : err);
  }

  // Build rolling window over recent messages in this conversation.
  const windowSize = state.windowSize || DEFAULT_WINDOW_SIZE;
  const recent = await prisma.messageEmotion.findMany({
    where: {
      message: {
        conversationId,
        userId: event.userId,
      },
    },
    include: {
      message: true,
    },
    orderBy: { id: 'desc' },
    take: windowSize,
  });

  const emotionBuckets = {};
  const intensities = [];
  const topicMap = {};

  for (const row of recent) {
    const label = row.primaryEmotion || 'NEUTRAL';
    const intensity = typeof row.intensity === 'number' ? row.intensity : 0;
    const intensity01 = Math.max(0, Math.min(1, intensity / 5));
    intensities.push(intensity01);

    if (!emotionBuckets[label]) {
      emotionBuckets[label] = { count: 0, sumIntensity: 0, lastSeenAt: null };
    }
    const bucket = emotionBuckets[label];
    bucket.count += 1;
    bucket.sumIntensity += intensity01;
    const ts = row.message?.createdAt || row.createdAt || now;
    if (!bucket.lastSeenAt || ts > bucket.lastSeenAt) bucket.lastSeenAt = ts;

    const tags = Array.isArray(row.topicTags) ? row.topicTags : [];
    for (const t of tags) {
      if (!t) continue;
      if (!topicMap[t]) {
        topicMap[t] = {
          topic: t,
          count: 0,
          firstSeenAt: ts,
          lastSeenAt: ts,
          peakIntensity: intensity01,
        };
      }
      const topic = topicMap[t];
      topic.count += 1;
      if (ts < topic.firstSeenAt) topic.firstSeenAt = ts;
      if (ts > topic.lastSeenAt) topic.lastSeenAt = ts;
      if (intensity01 > topic.peakIntensity) topic.peakIntensity = intensity01;
    }
  }

  const rollingEmotionStats = {
    totalCount: intensities.length,
    recentAvgIntensity: intensities.length
      ? intensities.reduce((s, v) => s + v, 0) / intensities.length
      : 0,
    trendDelta: intensities.length >= 2
      ? intensities[0] - intensities[intensities.length - 1]
      : 0,
    emotions: Object.entries(emotionBuckets).reduce((acc, [label, bucket]) => {
      acc[label] = {
        count: bucket.count,
        avgIntensity: bucket.count ? bucket.sumIntensity / bucket.count : 0,
        lastSeenAt: bucket.lastSeenAt,
      };
      return acc;
    }, {}),
  };

  const topicsList = Object.values(topicMap);
  const rollingTopicStats = {
    topics: topicsList,
  };

  // Active threads: pick the most recent high-salience topics.
  const activeThreads = topicsList
    .slice()
    .sort((a, b) => {
      const ta = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
      const tb = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 5);

  // Baselines and stability
  let sessionBaselineEmotion = state.sessionBaselineEmotion || null;
  if (!sessionBaselineEmotion && emo.primaryEmotion) {
    sessionBaselineEmotion = emo.primaryEmotion;
  }

  // Current baseline: most frequent emotion in the window.
  let currentBaselineEmotion = state.currentBaselineEmotion || null;
  let bestLabel = null;
  let bestCount = -1;
  for (const [label, bucket] of Object.entries(emotionBuckets)) {
    if (bucket.count > bestCount) {
      bestCount = bucket.count;
      bestLabel = label;
    }
  }
  if (bestLabel) currentBaselineEmotion = bestLabel;

  // Stability score: 1 - normalized variance of intensities.
  let stabilityScore = state.stabilityScore || 0;
  if (intensities.length > 0) {
    const mean = intensities.reduce((s, v) => s + v, 0) / intensities.length;
    const variance =
      intensities.reduce((s, v) => s + (v - mean) * (v - mean), 0) /
      intensities.length;
    const maxVar = 0.25; // for values in [0,1]
    const norm = Math.min(variance / maxVar, 1);
    stabilityScore = 1 - norm;
  }

  try {
    await prisma.conversationEmotionState.update({
      where: { conversationId },
      data: {
        windowSize,
        rollingEmotionStats,
        rollingTopicStats,
        activeThreads,
        sessionBaselineEmotion,
        currentBaselineEmotion,
        stabilityScore,
        flags: state.flags || null,
        lastKernelUpdateAt: now,
      },
    });
  } catch (err) {
    console.error('[ShortTerm] Failed to update ConversationEmotionState', err && err.message ? err.message : err);
  }

  return {
    intensityDelta,
    trend: trend || null,
  };
}

module.exports = {
  updateShortTerm,
};
