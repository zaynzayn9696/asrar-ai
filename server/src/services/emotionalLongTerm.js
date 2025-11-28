// server/src/services/emotionalLongTerm.js
// Emotional Engine v2 — Long-Term Emotional Intelligence (lightweight)
// Adds timeline logging, user-level emotional profile aggregation, long-term
// snapshot, and simple trigger detection for prompts.

const prisma = require('../prisma');
const { detectTriggers } = require('./emotionalReasoning');

/**
 * @typedef {Object} Emotion
 * @property {('NEUTRAL'|'SAD'|'ANXIOUS'|'ANGRY'|'LONELY'|'STRESSED'|'HOPEFUL'|'GRATEFUL')} primaryEmotion
 * @property {number} intensity  // 1-5
 * @property {number} confidence // 0-1
 * @property {('ARABIC'|'ENGLISH'|'MIXED')} cultureTag
 * @property {string=} notes
 */

const NEGATIVE_SET = new Set(['SAD', 'ANXIOUS', 'ANGRY', 'LONELY', 'STRESSED']);

/**
 * Logs a high-level emotional timeline event when there is a meaningful emotional moment.
 * Called only when intensity is above a threshold OR when emotion changes significantly.
 * This function is intentionally simple and should not block the chat flow.
 * @param {Object} params
 * @param {number} params.userId
 * @param {number|null|undefined} params.conversationId
 * @param {Emotion} params.emotion
 */
async function logEmotionalTimelineEvent({ userId, conversationId, emotion }) {
  try {
    if (!conversationId || !Number.isFinite(Number(conversationId))) return;
    const cid = Number(conversationId);

    const last = await prisma.emotionalTimelineEvent.findFirst({
      where: { userId, conversationId: cid },
      orderBy: { createdAt: 'desc' },
    });

    const shouldLogByIntensity = (emotion?.intensity || 0) >= 3;
    const shouldLogByChange = last ? String(last.emotion) !== String(emotion?.primaryEmotion) : true;

    if (shouldLogByIntensity || shouldLogByChange) {
      await prisma.emotionalTimelineEvent.create({
        data: {
          userId,
          conversationId: cid,
          emotion: emotion.primaryEmotion,
          intensity: Math.max(1, Math.min(5, emotion.intensity || 1)),
          tag: null,
        },
      });
    }
  } catch (e) {
    console.error('logEmotionalTimelineEvent error', e && e.message ? e.message : e);
  }
}

/** Map primaryEmotion to the corresponding long-term score field */
function mapEmotionField(label) {
  switch (label) {
    case 'SAD': return 'sadnessScore';
    case 'ANXIOUS': return 'anxietyScore';
    case 'ANGRY': return 'angerScore';
    case 'LONELY': return 'lonelinessScore';
    case 'HOPEFUL': return 'hopeScore';
    case 'GRATEFUL': return 'gratitudeScore';
    default: return null;
  }
}

/**
 * Updates or creates a UserEmotionProfile row by aggregating recent MessageEmotion rows.
 * v1 heuristic:
 *  - Look back at up to last 200 messages within ~30 days.
 *  - For each MessageEmotion, weight = intensity/5.
 *  - For each category, score = weighted count / total weighted count (0-1 range).
 *  - avgIntensity = average of (intensity/5).
 *  - Smoothing: 0.7 old + 0.3 new.
 * @param {Object} params
 * @param {number} params.userId
 */
async function updateUserEmotionProfile({ userId }) {
  try {
    const now = new Date();
    const THROTTLE_MS = 5 * 60 * 1000; // ~5 minutes

    const existing = await prisma.userEmotionProfile.findUnique({ where: { userId } });
    if (existing && existing.lastUpdatedAt) {
      const last = existing.lastUpdatedAt instanceof Date
        ? existing.lastUpdatedAt
        : new Date(existing.lastUpdatedAt);
      if (now - last < THROTTLE_MS) {
        return;
      }
    }

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // ~30 days

    const rows = await prisma.messageEmotion.findMany({
      where: {
        message: {
          userId,
          createdAt: { gte: cutoff },
        },
      },
      include: {
        message: { select: { createdAt: true } },
      },
      take: 200,
      orderBy: { id: 'desc' },
    });

    if (!rows || rows.length === 0) return; // nothing to update

    let totalW = 0;
    let avgI = 0;
    const buckets = {
      SAD: 0, ANXIOUS: 0, ANGRY: 0, LONELY: 0, HOPEFUL: 0, GRATEFUL: 0, STRESSED: 0, NEUTRAL: 0,
    };

    for (const r of rows) {
      const label = String(r.primaryEmotion || 'NEUTRAL').toUpperCase();
      const i = Math.max(1, Math.min(5, r.intensity || 1));
      const w = i / 5;
      buckets[label] = (buckets[label] || 0) + w;
      avgI += w;
      totalW += w;
    }

    if (totalW <= 0) return;

    const newScores = {
      sadnessScore: (buckets.SAD || 0) / totalW,
      anxietyScore: (buckets.ANXIOUS || 0) / totalW,
      angerScore: (buckets.ANGRY || 0) / totalW,
      lonelinessScore: (buckets.LONELY || 0) / totalW,
      hopeScore: (buckets.HOPEFUL || 0) / totalW,
      gratitudeScore: (buckets.GRATEFUL || 0) / totalW,
      avgIntensity: avgI / rows.length, // already in 0..1 scale due to w=i/5
    };

    const weightOld = 0.7;
    const weightNew = 0.3;

    if (!existing) {
      await prisma.userEmotionProfile.create({
        data: {
          userId,
          sadnessScore: newScores.sadnessScore,
          anxietyScore: newScores.anxietyScore,
          angerScore: newScores.angerScore,
          lonelinessScore: newScores.lonelinessScore,
          hopeScore: newScores.hopeScore,
          gratitudeScore: newScores.gratitudeScore,
          avgIntensity: newScores.avgIntensity,
          lastUpdatedAt: new Date(),
        },
      });
      return;
    }

    await prisma.userEmotionProfile.update({
      where: { userId },
      data: {
        sadnessScore: weightOld * existing.sadnessScore + weightNew * newScores.sadnessScore,
        anxietyScore: weightOld * existing.anxietyScore + weightNew * newScores.anxietyScore,
        angerScore: weightOld * existing.angerScore + weightNew * newScores.angerScore,
        lonelinessScore: weightOld * existing.lonelinessScore + weightNew * newScores.lonelinessScore,
        hopeScore: weightOld * existing.hopeScore + weightNew * newScores.hopeScore,
        gratitudeScore: weightOld * existing.gratitudeScore + weightNew * newScores.gratitudeScore,
        avgIntensity: weightOld * existing.avgIntensity + weightNew * newScores.avgIntensity,
        lastUpdatedAt: now,
      },
    });
  } catch (e) {
    console.error('updateUserEmotionProfile error', e && e.message ? e.message : e);
  }
}

/**
 * Computes a long-term emotional snapshot for prompts.
 * Returns dominant tendency, scores, avg intensity, and a short plain-text description.
 * @param {Object} params
 * @param {number} params.userId
 * @returns {Promise<{dominantLongTermEmotion: string, scores: {sadness:number, anxiety:number, anger:number, loneliness:number, hope:number, gratitude:number}, avgIntensity:number, summaryText:string} | null>}
 */
async function getLongTermEmotionalSnapshot({ userId }) {
  try {
    const prof = await prisma.userEmotionProfile.findUnique({ where: { userId } });
    if (!prof) return null;

    const scores = {
      sadness: prof.sadnessScore || 0,
      anxiety: prof.anxietyScore || 0,
      anger: prof.angerScore || 0,
      loneliness: prof.lonelinessScore || 0,
      hope: prof.hopeScore || 0,
      gratitude: prof.gratitudeScore || 0,
    };

    const pairs = [
      ['SAD', scores.sadness],
      ['ANXIOUS', scores.anxiety],
      ['ANGRY', scores.anger],
      ['LONELY', scores.loneliness],
      ['HOPEFUL', scores.hope],
      ['GRATEFUL', scores.gratitude],
    ];
    let dominantLongTermEmotion = 'NEUTRAL';
    let maxV = 0;
    for (const [k, v] of pairs) {
      if ((v || 0) > maxV) {
        maxV = v;
        dominantLongTermEmotion = k;
      }
    }

    const negTrend = scores.sadness + scores.anxiety + scores.loneliness;
    const summaryText = negTrend >= 0.9
      ? 'Over recent weeks, the user often shows sadness and anxiety, with moderate overall intensity.'
      : (scores.hope + scores.gratitude > 0.6
        ? 'Over recent weeks, the user frequently shows hope and gratitude, with generally positive tone.'
        : 'In recent weeks, the user has a mixed emotional pattern, with varied moods.');

    return {
      dominantLongTermEmotion,
      scores,
      avgIntensity: prof.avgIntensity || 0,
      summaryText,
    };
  } catch (e) {
    console.error('getLongTermEmotionalSnapshot error', e && e.message ? e.message : e);
    return null;
  }
}

/**
 * Very simple v1 trigger detection: inspects recent negative MessageEmotion + Message pairs
 * and returns a list of possible triggers (topics) associated with high intensity.
 * This is heuristic and lightweight.
 * @param {Object} params
 * @param {number} params.userId
 * @returns {Promise<Array<{topic:string, emotion:string, score:number}>>}
 */
async function detectEmotionalTriggers({ userId }) {
  try {
    const now = new Date();
    const THROTTLE_MS = 10 * 60 * 1000; // ~10 minutes

    const prof = await prisma.userEmotionProfile.findUnique({ where: { userId } }).catch(() => null);
    if (prof && prof.lastPatternRefreshAt) {
      const last = prof.lastPatternRefreshAt instanceof Date
        ? prof.lastPatternRefreshAt
        : new Date(prof.lastPatternRefreshAt);
      if (now - last < THROTTLE_MS) {
        return [];
      }
    }

    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // ~14 days
    const rows = await prisma.messageEmotion.findMany({
      where: {
        message: {
          userId,
          createdAt: { gte: cutoff },
        },
        intensity: { gte: 3 },
        primaryEmotion: { in: ['SAD', 'ANXIOUS', 'LONELY'] },
      },
      include: {
        message: { select: { content: true, createdAt: true } },
      },
      take: 80,
      orderBy: { id: 'desc' },
    });

    if (!rows || rows.length === 0) return [];

    // Simple tokenization with small stop-word lists for EN/AR
    const EN_STOP = new Set(['the','a','an','and','or','but','to','of','in','on','for','with','is','are','am','be','it','that','this','i','you','me','my','we','our','your','they','their','he','she','his','her']);
    const AR_STOP = new Set(['و','في','على','من','عن','إلى','الى','هو','هي','هم','هن','انا','أنا','انت','أنت','انتِ','مع','هذا','هذه','ذلك','تلك','كل','كان','كانت','يكون','هيكون','هوية','او']);

    const counts = new Map(); // key -> { freq, emotionWeights: { SAD:x, ANXIOUS:y, LONELY:z } }

    for (const r of rows) {
      const text = (r.message?.content || '').toLowerCase();
      if (!text) continue;
      // Basic normalization
      const tokens = text
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 60);

      // Collect simple keywords
      const localSet = new Set();
      for (const t of tokens) {
        if (t.length < 3) continue;
        if (EN_STOP.has(t) || AR_STOP.has(t)) continue;
        localSet.add(t);
      }

      for (const tok of localSet) {
        const entry = counts.get(tok) || { freq: 0, emotionWeights: { SAD: 0, ANXIOUS: 0, LONELY: 0 } };
        const w = Math.max(1, Math.min(5, r.intensity || 1)) / 5;
        entry.freq += w;
        if (r.primaryEmotion === 'SAD' || r.primaryEmotion === 'ANXIOUS' || r.primaryEmotion === 'LONELY') {
          entry.emotionWeights[r.primaryEmotion] += w;
        }
        counts.set(tok, entry);
      }
    }

    const ranked = Array.from(counts.entries())
      .map(([topic, data]) => {
        const { SAD = 0, ANXIOUS = 0, LONELY = 0 } = data.emotionWeights || {};
        let emotion = 'SAD';
        let ev = SAD;
        if (ANXIOUS > ev) { emotion = 'ANXIOUS'; ev = ANXIOUS; }
        if (LONELY > ev) { emotion = 'LONELY'; ev = LONELY; }
        return { topic, emotion, score: ev };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Normalize scores to 0..1 by top score
    const top = ranked[0]?.score || 1;
    return ranked.map(({ topic, emotion, score }) => ({ topic, emotion, score: Math.max(0, Math.min(1, score / top)) }));
  } catch (e) {
    console.error('detectEmotionalTriggers error', e && e.message ? e.message : e);
    return [];
  }
}

async function updateEmotionalPatterns({ userId }) {
  try {
    if (!userId || !prisma.emotionalPattern) return;

    const now = new Date();
    const THROTTLE_MS = 10 * 60 * 1000; // ~10 minutes

    const profile = await prisma.userEmotionProfile.findUnique({ where: { userId } });
    if (!profile) return;

    if (profile.lastPatternRefreshAt) {
      const last = profile.lastPatternRefreshAt instanceof Date
        ? profile.lastPatternRefreshAt
        : new Date(profile.lastPatternRefreshAt);
      if (now - last < THROTTLE_MS) {
        return;
      }
    }

    const sadness = profile.sadnessScore || 0;
    const anxiety = profile.anxietyScore || 0;
    const anger = profile.angerScore || 0;
    const loneliness = profile.lonelinessScore || 0;
    const hope = profile.hopeScore || 0;
    const gratitude = profile.gratitudeScore || 0;
    const volatility = profile.volatilityIndex || 0;

    const patterns = [];

    const negCore = sadness + anxiety + loneliness;
    const posCore = hope + gratitude;

    if (negCore >= 1.2) {
      patterns.push({ kind: 'CHRONIC_SADNESS', score: Math.min(1, negCore / 2) });
    } else if (sadness >= 0.5) {
      patterns.push({ kind: 'SADNESS_TENDENCY', score: Math.min(1, sadness) });
    }

    if (anxiety >= 0.5) {
      patterns.push({ kind: 'ANXIETY_SPIKES', score: Math.min(1, anxiety) });
    }

    if (loneliness >= 0.5) {
      patterns.push({ kind: 'LONELINESS_PATTERN', score: Math.min(1, loneliness) });
    }

    if (posCore >= 0.7) {
      patterns.push({ kind: 'POSITIVE_TILT', score: Math.min(1, posCore / 2) });
    }

    if (volatility >= 0.4) {
      patterns.push({ kind: 'VOLATILE_EMOTIONS', score: Math.min(1, volatility) });
    }

    // Light inspection of recent high-intensity timeline events for refinement.
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const events = await prisma.emotionalTimelineEvent.findMany({
      where: {
        userId,
        createdAt: { gte: cutoff },
        intensity: { gte: 4 },
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });

    if (events && events.length) {
      const counts = { SAD: 0, ANXIOUS: 0, LONELY: 0 };
      for (const ev of events) {
        const label = String(ev.emotion || '').toUpperCase();
        if (label === 'SAD' || label === 'ANXIOUS' || label === 'LONELY') {
          counts[label] += 1;
        }
      }

      const anxietyBursts = counts.ANXIOUS || 0;
      const lonelinessBursts = counts.LONELY || 0;
      if (anxietyBursts >= 3) {
        patterns.push({ kind: 'ACUTE_ANXIETY_EPISODES', score: Math.min(1, anxietyBursts / 6) });
      }
      if (lonelinessBursts >= 3) {
        patterns.push({ kind: 'RECURRING_LONELINESS_EPISODES', score: Math.min(1, lonelinessBursts / 6) });
      }
    }

    if (!patterns.length) {
      await prisma.userEmotionProfile.update({
        where: { userId },
        data: { lastPatternRefreshAt: now },
      });
      return;
    }

    // Normalise scores into 0..1 and keep a small, stable set.
    const kinds = new Set();
    const finalPatterns = [];
    for (const p of patterns) {
      if (kinds.has(p.kind)) continue;
      kinds.add(p.kind);
      finalPatterns.push({ kind: p.kind, score: Math.max(0, Math.min(1, p.score || 0)) });
      if (finalPatterns.length >= 6) break;
    }

    await prisma.$transaction(async (tx) => {
      for (const p of finalPatterns) {
        const existingPattern = await tx.emotionalPattern.findFirst({
          where: { userId, kind: p.kind },
          orderBy: { id: 'asc' },
        });

        if (existingPattern) {
          await tx.emotionalPattern.update({
            where: { id: existingPattern.id },
            data: {
              score: p.score,
              status: 'ACTIVE',
              lastSeenAt: now,
            },
          });
        } else {
          await tx.emotionalPattern.create({
            data: {
              userId,
              kind: p.kind,
              score: p.score,
              status: 'ACTIVE',
              firstSeenAt: now,
              lastSeenAt: now,
            },
          });
        }
      }

      // Mark patterns not present in this refresh as inactive, but retain them.
      await tx.emotionalPattern.updateMany({
        where: {
          userId,
          kind: { notIn: Array.from(kinds) },
        },
        data: { status: 'INACTIVE' },
      });

      await tx.userEmotionProfile.update({
        where: { userId },
        data: { lastPatternRefreshAt: now },
      });
    });
  } catch (e) {
    console.error('updateEmotionalPatterns error', e && e.message ? e.message : e);
  }
}

/**
 * Logs per-message emotional trigger events based on simple keyword tags.
 * This is best-effort and should not block the main chat flow.
 * @param {Object} params
 * @param {number} params.userId
 * @param {number|null|undefined} params.conversationId
 * @param {number} params.messageId
 * @param {string} params.messageText
 * @param {Emotion} params.emotion
 */
async function logTriggerEventsForMessage({ userId, conversationId, messageId, messageText, emotion }) {
  try {
    if (!userId || !messageId || !emotion) return;

    const tags = detectTriggers(messageText, emotion.primaryEmotion, emotion.intensity);
    if (!Array.isArray(tags) || tags.length === 0) return;

    const cid = conversationId && Number.isFinite(Number(conversationId))
      ? Number(conversationId)
      : null;
    const intensity = Math.max(1, Math.min(5, emotion.intensity || 1));

    const data = tags.map((type) => ({
      userId,
      conversationId: cid,
      type,
      intensity,
    }));

    await prisma.emotionalTriggerEvent.createMany({ data });
  } catch (e) {
    console.error('logTriggerEventsForMessage error', e && e.message ? e.message : e);
  }
}

module.exports = {
  logEmotionalTimelineEvent,
  updateUserEmotionProfile,
  getLongTermEmotionalSnapshot,
  detectEmotionalTriggers,
  updateEmotionalPatterns,
  logTriggerEventsForMessage,
};
