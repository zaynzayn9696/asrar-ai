// server/src/pipeline/memory/Phase4PromptBuilder.js
// Phase 4 memory-aware prompt builder.
// Reads short-term + long-term kernel data and produces an additive
// instruction block that is appended to the existing system prompt.

const prisma = require('../../prisma');

function ensureObject(val) {
  if (!val || typeof val !== 'object') return {};
  return { ...val };
}

/**
 * Build a compact memory-aware block for the system prompt.
 * This must be lightweight and non-creepy: only coarse summaries, no quotes.
 *
 * @param {Object} params
 * @param {number} params.userId
 * @param {number|undefined|null} params.conversationId
 * @param {string} params.language  // 'ar' | 'en' | 'mixed'
 * @param {string} params.personaId
 * @returns {Promise<string>}
 */
async function buildPhase4MemoryBlock({ userId, conversationId, language, personaId }) {
  if (!userId) return '';

  const [convoState, profile] = await Promise.all([
    conversationId
      ? prisma.conversationEmotionState.findUnique({ where: { conversationId } })
      : Promise.resolve(null),
    prisma.userEmotionProfile.findUnique({ where: { userId } }),
  ]);

  if (!convoState && !profile) return '';

  const isArabic = language === 'ar';
  const lines = [];

  // ---- Short-term context (per-conversation) ----
  if (convoState) {
    const rolling = ensureObject(convoState.rollingEmotionStats);
    const totalCount = rolling.totalCount || 0;
    const emotions = ensureObject(rolling.emotions);
    let recentDominant = null;
    let recentDominantIntensity = 0;

    Object.keys(emotions).forEach((label) => {
      const e = emotions[label] || {};
      const avg = typeof e.avgIntensity === 'number' ? e.avgIntensity : 0;
      if (avg > recentDominantIntensity) {
        recentDominantIntensity = avg;
        recentDominant = label;
      }
    });

    const threads = Array.isArray(convoState.activeThreads)
      ? convoState.activeThreads.slice(0, 3)
      : [];

    const threadTopics = threads.map((t) => t.topic).filter(Boolean);

    const stability =
      typeof convoState.stabilityScore === 'number'
        ? Math.max(0, Math.min(1, convoState.stabilityScore))
        : null;

    const shortLines = [];

    const recentAvg =
      typeof rolling.recentAvgIntensity === 'number'
        ? rolling.recentAvgIntensity
        : null;
    const trendDelta =
      typeof rolling.trendDelta === 'number' ? rolling.trendDelta : null;
    if (totalCount > 0 && recentDominant) {
      shortLines.push(
        `Recent window (${totalCount} turns): mostly ${recentDominant} with average intensity ${(recentDominantIntensity * 5).toFixed(
          1
        )}/5.`
      );
    }

    // If intensity is high and unstable for anxiety/stress, steer into grounding.
    const highIntensity =
      recentDominantIntensity && recentDominantIntensity >= 0.7;
    const unstable =
      typeof stability === 'number' ? stability < 0.4 : false;
    if (
      recentDominant &&
      (recentDominant === 'ANXIOUS' || recentDominant === 'STRESSED') &&
      highIntensity &&
      unstable
    ) {
      shortLines.push(
        'Right now, keep the pace slow and grounding. Use small, structured steps and avoid pushing big tasks or sharp emotional jumps.'
      );
    }

    // Trend-aware hint: if intensity is easing down, lean into gentle reinforcement.
    if (trendDelta != null && Math.abs(trendDelta) >= 0.2) {
      if (trendDelta < 0) {
        shortLines.push(
          'Recent signals suggest the user is starting to feel a bit calmer; gently acknowledge this progress and reinforce small positive shifts.'
        );
      } else {
        shortLines.push(
          'Recent signals suggest emotional intensity is climbing; prioritise containment, grounding and reassurance over ambitious plans.'
        );
      }
    }
    if (stability != null) {
      const stabilityDesc =
        stability > 0.75 ? 'stable' : stability < 0.35 ? 'very up-and-down' : 'somewhat variable';
      shortLines.push(`Emotion pattern in this conversation is ${stabilityDesc}.`);
    }
    if (threadTopics.length) {
      shortLines.push(`Current active themes: ${threadTopics.join(', ')}.`);
    }

    // Fallback: if the rolling window is not yet populated, use scalar
    // ConversationEmotionState fields so Phase 4 still contributes signal.
    if (!shortLines.length) {
      const dom = convoState.dominantEmotion || null;
      const avgScalar =
        typeof convoState.avgIntensity === 'number'
          ? convoState.avgIntensity
          : null;

      const summaryBits = [];
      if (dom) {
        summaryBits.push(
          `So far in this conversation, the overall emotional centre has tended toward ${dom}.`
        );
      }
      if (avgScalar != null && avgScalar > 0) {
        summaryBits.push(
          `Typical intensity across turns so far is around ${(avgScalar * 5).toFixed(
            1
          )}/5.`
        );
      }

      if (summaryBits.length) {
        shortLines.push(summaryBits.join(' '));
      }
    }

    if (shortLines.length) {
      lines.push(
        'Context from recent messages (use as soft guidance, not hard rules):',
        ...shortLines
      );
    }
  }

  // ---- Long-term profile (per-user) ----
  if (profile) {
    const emotionStats = ensureObject(profile.emotionStats);
    let longDominant = null;
    let longDominantScore = 0;

    const emotionStatKeys = Object.keys(emotionStats);
    if (emotionStatKeys.length) {
      emotionStatKeys.forEach((label) => {
        const e = emotionStats[label] || {};
        const count = e.count || 0;
        const avg = typeof e.avgIntensity === 'number' ? e.avgIntensity : 0;
        const score = count * avg;
        if (score > longDominantScore) {
          longDominantScore = score;
          longDominant = label;
        }
      });
    } else {
      // Fallback: derive a dominant long-term tendency from scalar scores
      // when Phase 4 JSON stats have not yet been populated.
      const scalarPairs = [
        ['SAD', profile.sadnessScore || 0],
        ['ANXIOUS', profile.anxietyScore || 0],
        ['ANGRY', profile.angerScore || 0],
        ['LONELY', profile.lonelinessScore || 0],
        ['HOPEFUL', profile.hopeScore || 0],
        ['GRATEFUL', profile.gratitudeScore || 0],
      ];
      for (const [label, score] of scalarPairs) {
        const s = typeof score === 'number' ? score : 0;
        if (s > longDominantScore) {
          longDominantScore = s;
          longDominant = label;
        }
      }
    }

    const topicProfile = ensureObject(profile.topicProfile);
    const topicEntries = Object.keys(topicProfile).map((key) => ({
      topic: key,
      score:
        typeof topicProfile[key]?.score === 'number' ? topicProfile[key].score : 0,
    }));
    topicEntries.sort((a, b) => b.score - a.score);
    const topTopics = topicEntries.slice(0, 3).map((t) => t.topic);

    const personaAffinity = ensureObject(profile.personaAffinity);
    const personaStats = personaId ? personaAffinity[personaId] || null : null;
    const volatility =
      typeof profile.volatilityIndex === 'number'
        ? Math.max(0, Math.min(1, profile.volatilityIndex))
        : null;

    const longLines = [];
    if (longDominant) {
      longLines.push(
        `Across many conversations, this user often presents as ${longDominant.toLowerCase()} in an emotional sense.`
      );
    }
    if (topTopics.length) {
      longLines.push(
        `Common recurring topics over time: ${topTopics.join(', ')}.`
      );
      // Nudge model to stay aware of strong themes without over-focusing.
      longLines.push(
        'When it fits naturally, you may lightly connect your guidance to these recurring areas, without forcing the conversation back to them.'
      );
    }
    if (volatility != null) {
      const volDesc =
        volatility > 0.7 ? 'frequently changing' : volatility < 0.3 ? 'relatively steady' : 'moderately variable';
      longLines.push(
        `Long-term emotional trajectory tends to be ${volDesc}; avoid sudden shifts in tone.`
      );
    }
    if (personaStats && typeof personaStats.avgOutcome === 'number') {
      const outcome = personaStats.avgOutcome;
      if (outcome > 0.1) {
        longLines.push(
          'This companion style generally works well for this user; keep the tone consistent with it rather than experimenting wildly.'
        );
      } else if (outcome < -0.1) {
        longLines.push(
          'Be extra gentle: past interactions with this companion style sometimes aligned with higher emotional intensity.'
        );
      }
    }

    // If the kernel JSON fields are still mostly empty but scalar
    // UserEmotionProfile scores exist, add a compact fallback summary
    // so Phase 4 never returns an empty block once a profile is present.
    if (!longLines.length) {
      const sadness = profile.sadnessScore || 0;
      const anxiety = profile.anxietyScore || 0;
      const loneliness = profile.lonelinessScore || 0;
      const hope = profile.hopeScore || 0;
      const gratitude = profile.gratitudeScore || 0;
      const avgIntensity = profile.avgIntensity || 0;

      const negSum = sadness + anxiety + loneliness;
      const posSum = hope + gratitude;

      if (negSum >= 0.9) {
        longLines.push(
          'Across many past conversations, the user frequently leans into heavier feelings such as sadness, anxiety or loneliness. Be especially steady and gentle.'
        );
      } else if (posSum >= 0.6) {
        longLines.push(
          'Over time the user often shows hopeful or grateful tones alongside difficulties; you can carefully reinforce these moments without forcing positivity.'
        );
      }

      if (avgIntensity > 0) {
        longLines.push(
          `Typical emotional intensity across conversations is around ${(avgIntensity * 5).toFixed(
            1
          )}/5; match your pacing to that level unless the current message clearly calls for a different depth.`
        );
      }
    }

    if (longLines.length) {
      lines.push(
        'Longer-term patterns (use gently; do not mention them explicitly as analytics):',
        ...longLines
      );
    }
  }

  if (!lines.length) return '';

  const safetyHints = [
    'Use this context only to maintain emotional continuity, not to sound invasive.',
    'Do not quote specific past messages or dates; refer to themes in a general, human way.',
    'If you reference past struggles, keep it brief and focused on support, not analysis.',
  ];

  const header = isArabic
    ? 'Additional internal context from the memory kernel (do not expose as analytics to the user):'
    : 'Additional internal context from the memory kernel (do not expose as analytics to the user):';

  return [
    header,
    '',
    ...lines,
    '',
    'Guidelines for using this context:',
    ...safetyHints,
  ].join('\n');
}

module.exports = {
  buildPhase4MemoryBlock,
};
