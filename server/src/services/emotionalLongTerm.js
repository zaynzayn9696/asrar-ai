// server/src/services/emotionalLongTerm.js
// Emotional Engine v2 — Long-Term Emotional Intelligence (lightweight)
// Adds timeline logging, user-level emotional profile aggregation, long-term
// snapshot, and simple trigger detection for prompts.

const prisma = require('../prisma');

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

    const existing = await prisma.userEmotionProfile.findUnique({ where: { userId } });
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
        lastUpdatedAt: new Date(),
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
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // ~30 days
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
      take: 200,
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

/**
 * Phase 3 �?" Emotional Pattern table (lightweight).
 * Best-effort: if the EmotionalPattern model is not present in the Prisma
 * client (older schemas), this function becomes a no-op.
 *
 * @param {Object} params
 * @param {number} params.userId
 * @param {{ scores?: { sadness:number, anxiety:number, anger:number, loneliness:number, hope:number, gratitude:number } }|null} params.snapshot
 * @param {Array<{topic:string, emotion:string, score:number}>} params.triggers
 */
async function updateEmotionalPatterns({ userId, snapshot, triggers }) {
  try {
    if (!userId) return;
    // Older schemas may not have this model; guard safely.
    if (!prisma.emotionalPattern) return;

    const scores = (snapshot && snapshot.scores) || {};
    const sadness = scores.sadness || 0;
    const anxiety = scores.anxiety || 0;
    const anger = scores.anger || 0;
    const loneliness = scores.loneliness || 0;
    const hope = scores.hope || 0;
    const gratitude = scores.gratitude || 0;

    const negativeAggregate = sadness + anxiety + loneliness;
    const positiveAggregate = hope + gratitude;

    const patterns = [];

    if (negativeAggregate > 0.25) {
      patterns.push({
        kind: 'NEGATIVE_MOOD',
        score: Math.max(0, Math.min(1, negativeAggregate)),
        metadata: { scores },
      });
    }

    if (positiveAggregate > 0.25) {
      patterns.push({
        kind: 'POSITIVE_MOOD',
        score: Math.max(0, Math.min(1, positiveAggregate)),
        metadata: { scores },
      });
    }

    if (Array.isArray(triggers) && triggers.length) {
      for (const t of triggers.slice(0, 5)) {
        if (!t || !t.topic) continue;
        patterns.push({
          kind: `TRIGGER_TOPIC:${t.topic}`,
          score: Math.max(0, Math.min(1, t.score || 0)),
          metadata: { emotion: t.emotion || null },
        });
      }
    }

    // If there are no patterns, clear existing rows for this user and exit.
    if (!patterns.length) {
      await prisma.emotionalPattern.deleteMany({ where: { userId } });
      return;
    }

    const now = new Date();

    await prisma.$transaction([
      prisma.emotionalPattern.deleteMany({ where: { userId } }),
      ...patterns.map((p) =>
        prisma.emotionalPattern.create({
          data: {
            userId,
            kind: p.kind,
            score: p.score,
            status: 'ACTIVE',
            firstSeenAt: now,
            lastSeenAt: now,
            metadata: p.metadata || null,
          },
        })
      ),
    ]);
  } catch (e) {
    console.error('updateEmotionalPatterns error', e && e.message ? e.message : e);
  }
}

module.exports = {
  logEmotionalTimelineEvent,
  updateUserEmotionProfile,
  getLongTermEmotionalSnapshot,
  detectEmotionalTriggers,
  updateEmotionalPatterns,
};
