// server/src/pipeline/memory/longTerm.js
// Long-term emotional memory (per-user profile)

const prisma = require('../../prisma');
const { detectAnchorsFromMessage, deriveEmotionalReason } = require('../../services/emotionalReasoning');

/**
 * Safely parse a JSON-like field from Prisma (which is already JS) into an object.
 */
function ensureObject(val) {
  if (!val || typeof val !== 'object') return {};
  return { ...val };
}

// NEW: best-effort name detection from a single message text (English + Arabic cues).
function detectNameFromMessageText(messageText) {
  const text = String(messageText || '').trim();
  if (!text) return null;

  // Patterns are designed to capture the name in common English and Arabic phrases.
  // We prefer the *last* valid match in the message, so that
  // "كان اسمي علي بس من اليوم ناديني جعفر" yields "جعفر".
  const patterns = [
    // English forms
    /\bmy name is\s+([A-Za-z\u0600-\u06FF]{2,40})/giu,
    /\bcall me\s+([A-Za-z\u0600-\u06FF]{2,40})/giu,

    // Arabic forms like:
    //   "اسمي جعفر"
    //   "اسمي هو جعفر"
    //   "من الآن اسمي جعفر"
    //   "انا اسمي جعفر" / "أنا اسمي جعفر"
    /(?:^|[\s,،:.!?؟])(انا اسمي|أنا اسمي|اسمي)\s+(?:هو|يكون)?\s*([A-Za-z\u0600-\u06FF]{2,40})/giu,

    // Arabic forms like:
    //   "ناديني جعفر"
    //   "من اليوم ناديني جعفر"
    /(?:^|[\s,،:.!?؟])ناديني\s+([A-Za-z\u0600-\u06FF]{2,40})/giu,
  ];

  let lastName = null;

  for (const re of patterns) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
      // For patterns with an extra prefix group (e.g. "انا اسمي"), the name
      // is always the *last* capturing group.
      const raw = match[match.length - 1];
      if (!raw) continue;

      let name = String(raw).trim();
      // Trim common trailing punctuation attached to names.
      name = name.replace(/[.,!?؟،]+$/gu, '').trim();
      if (!name || name.length < 2 || name.length > 40) {
        continue;
      }
      // For Latin-based names, capitalise the first letter without touching the rest.
      if (/^[A-Za-z]/.test(name)) {
        name = name.charAt(0).toUpperCase() + name.slice(1);
      }
      lastName = name;
    }
  }

  return lastName;
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
  let emotionalAnchors = Array.isArray(profile && profile.emotionalAnchors)
    ? profile.emotionalAnchors.slice()
    : [];
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

  // Fetch message text for anchors / reasoning.
  let messageText = '';
  if (event.messageId) {
    try {
      const msg = await prisma.message.findUnique({
        where: { id: event.messageId },
        select: { content: true },
      });
      if (msg && typeof msg.content === 'string') {
        messageText = msg.content;
      }
    } catch (err) {
      // best-effort only
    }
  }

  // NEW: best-effort identity (name) detection and persistence to UserMemoryFact.
  if (messageText) {
    try {
      const detectedName = detectNameFromMessageText(messageText);
      if (detectedName) {
        const kind = 'identity.name';
        const existing = await prisma.userMemoryFact.findFirst({
          where: { userId, kind },
          select: { id: true },
        });

        if (existing && existing.id) {
          await prisma.userMemoryFact.update({
            where: { id: existing.id },
            data: {
              value: detectedName,
              confidence: 1.0,
              sourceMessageId: event.messageId || null,
            },
          });
        } else {
          await prisma.userMemoryFact.create({
            data: {
              userId,
              kind,
              value: detectedName,
              confidence: 1.0,
              sourceMessageId: event.messageId || null,
            },
          });
        }

        console.log('[LongTermMemory] identity.name updated', {
          userId,
          hasName: true,
          sourceMessageId: event.messageId || null,
        });
      }
    } catch (err) {
      console.error(
        '[LongTermMemory] identity.name update error',
        err && err.message ? err.message : err
      );
    }
  }

  // Emotional anchors V2
  try {
    const detectedAnchors = detectAnchorsFromMessage(messageText, emo.primaryEmotion, emo.intensity);
    if (Array.isArray(detectedAnchors) && detectedAnchors.length) {
      for (const a of detectedAnchors) {
        if (a && !emotionalAnchors.includes(a)) {
          emotionalAnchors.push(a);
        }
      }
    }
  } catch (_) {}

  // Deep emotional reason label (why, not just what)
  let reasonLabel = null;
  try {
    reasonLabel = deriveEmotionalReason(messageText, emotionalAnchors, [], profile || null) || null;
  } catch (_) {
    reasonLabel = null;
  }

  // Lightweight snapshot for quick access when building prompts.
  const recentKernelSnapshot = {
    lastEmotion: label,
    lastIntensity: emo.intensity || 0,
    lastUpdatedAt: now.toISOString(),
    reasonLabel,
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
      emotionalAnchors,
    },
    update: {
      emotionStats,
      topicProfile,
      personaAffinity,
      volatilityIndex,
      recentKernelSnapshot,
      lastUpdatedAt: now,
      emotionalAnchors,
    },
  });
}

module.exports = {
  updateLongTerm,
};

