// server/src/pipeline/memory/Phase4PromptBuilder.js
// Phase 4 memory-aware prompt builder.
// Reads short-term + long-term kernel data and produces an additive
// instruction block that is appended to the existing system prompt.

const prisma = require('../../prisma');
const { getPersonaSnapshot } = require('./memoryKernel');

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
 * @param {{ name?: string }} [params.identityMemory]
 * @returns {Promise<string>}
 */
async function buildPhase4MemoryBlock({ userId, conversationId, language, personaId, identityMemory }) {
  if (!userId) return '';

  const [convoState, profile, personaSnapshot] = await Promise.all([
    conversationId
      ? prisma.conversationEmotionState.findUnique({ where: { conversationId } })
      : Promise.resolve(null),
    prisma.userEmotionProfile.findUnique({ where: { userId } }),
    (async () => {
      try {
        return await getPersonaSnapshot({ userId });
      } catch (err) {
        console.error(
          '[Phase4] getPersonaSnapshot error',
          err && err.message ? err.message : err
        );
        return { facts: {}, summaryLinesEn: [], summaryLinesAr: [] };
      }
    })(),
  ]);

  if (!convoState && !profile && !personaSnapshot) return '';

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
    const topTopics = topicEntries.slice(0, 2).map((t) => t.topic);

    const personaAffinity = ensureObject(profile.personaAffinity);
    const personaStats = personaId ? personaAffinity[personaId] || null : null;
    const volatility =
      typeof profile.volatilityIndex === 'number'
        ? Math.max(0, Math.min(1, profile.volatilityIndex))
        : null;

    const longLines = [];
    if (longDominant) {
      longLines.push(
        `- Across conversations, the user often feels ${longDominant.toLowerCase()}.`
      );
    }
    if (topTopics.length) {
      longLines.push(
        `- Recurring themes: ${topTopics.join(', ')}.`
      );
    }
    if (volatility != null) {
      const volDesc =
        volatility > 0.7 ? 'frequently changing' : volatility < 0.3 ? 'relatively steady' : 'moderately variable';
      longLines.push(
        `- Emotional changes are ${volDesc}; avoid sudden tone shifts.`
      );
    }
    if (personaStats && typeof personaStats.avgOutcome === 'number') {
      const outcome = personaStats.avgOutcome;
      if (outcome > 0.1) {
        longLines.push(
          '- This companion style generally suits the user; keep your tone consistent with it.'
        );
      } else if (outcome < -0.1) {
        longLines.push(
          '- Be extra gentle; this companion style sometimes appeared around higher emotional intensity.'
        );
      }
    }
    // Keep only the first few bullet hints so Phase 4 stays compact.
    if (longLines.length > 3) {
      longLines.length = 3;
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
        'Longer-term patterns (bullet hints; do not mention explicitly as analytics):',
        ...longLines
      );
    }
  }

  // Optional identity hints (semantic memory, per user).
  if (identityMemory && typeof identityMemory.name === 'string') {
    const safeName = identityMemory.name.trim();
    if (safeName) {
      if (isArabic) {
        lines.push(
          'هوية المستخدم (تلميح داخلي):',
          `- المستخدم قال لك إن اسمه "${safeName}"؛ يمكنك استخدام اسمه أحياناً لزيادة الألفة بدون مبالغة.`
        );
      } else {
        lines.push(
          'Identity hints (internal, not analytics):',
          `- The user has shared their name "${safeName}"; you can occasionally use it to build warmth without overusing it.`
        );
      }
    }
  }

  // Persona snapshot (profile, goals, themes, traits).
  try {
    if (personaSnapshot) {
      const personaLines = isArabic
        ? Array.isArray(personaSnapshot.summaryLinesAr)
          ? personaSnapshot.summaryLinesAr
          : []
        : Array.isArray(personaSnapshot.summaryLinesEn)
        ? personaSnapshot.summaryLinesEn
        : [];

      if (personaLines.length) {
        if (isArabic) {
          lines.push(
            'ملف شخصي تقريبي للمستخدم (معلومات داخلية لا تُذكر للمستخدم حرفيًا):',
            'استخدم هذه الملامح فقط لاختيار الأسلوب والأمثلة الأقرب لحياة المستخدم، بدون أن تقول له أنك تحفظ تفاصيله أو تحلّل شخصيته بالأرقام.',
            ...personaLines
          );
        } else {
          lines.push(
            'Approximate user persona profile (internal hints – do NOT expose directly):',
            'Use these hints only to choose tone and examples that fit the user. Do not say things like "I have a profile about you" or list these facts as analytics.',
            ...personaLines
          );
        }
      }
    }
  } catch (err) {
    console.error(
      '[Phase4] persona snapshot render error',
      err && err.message ? err.message : err
    );
  }

  // Semantic preference profile (UserMemoryFact-based, internal-only).
  try {
    const model = prisma && prisma.userMemoryFact;
    if (model && typeof model.findMany === 'function') {
      const semanticFacts = await model.findMany({
        where: {
          userId,
          kind: {
            in: [
              'preference.season.like',
              'preference.season.dislike',
              'preference.weather.like',
              'preference.weather.dislike',
              'preference.pets.like',
              'preference.pets.dislike',
              'preference.crowds',
              'trait.social.style',
            ],
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 40,
      });

      const grouped = {};
      for (const f of semanticFacts || []) {
        if (!f || !f.kind || typeof f.value !== 'string') continue;
        const k = String(f.kind).trim();
        const v = String(f.value).trim();
        if (!k || !v) continue;
        if (!grouped[k]) {
          grouped[k] = [];
        }
        if (!grouped[k].includes(v)) {
          grouped[k].push(v);
        }
      }

      const prefLines = [];

      const seasonsLike = grouped['preference.season.like'] || [];
      const seasonsDislike = grouped['preference.season.dislike'] || [];
      const weatherLike = grouped['preference.weather.like'] || [];
      const petsLike = grouped['preference.pets.like'] || [];
      const petsDislike = grouped['preference.pets.dislike'] || [];
      const crowdPrefs = grouped['preference.crowds'] || [];
      const socialStyles = grouped['trait.social.style'] || [];

      const crowdValue = crowdPrefs[0] || null;
      const socialStyle = socialStyles[0] || null;

      if (!isArabic) {
        const seasonLabel = (code) => {
          if (code === 'winter') return 'winter';
          if (code === 'summer') return 'summer';
          if (code === 'spring') return 'spring';
          if (code === 'autumn') return 'autumn';
          return code;
        };
        const weatherLabel = (code) => {
          if (code === 'rain') return 'rainy weather';
          if (code === 'snow') return 'snowy days';
          if (code === 'sun') return 'sunny weather';
          return code;
        };
        const petLabel = (code) => {
          if (code === 'cats') return 'cats';
          if (code === 'dogs') return 'dogs';
          return code;
        };

        if (seasonsLike.length) {
          const items = seasonsLike.map(seasonLabel).join(', ');
          prefLines.push(`- They tend to prefer seasons like ${items}.`);
        }
        if (weatherLike.length) {
          const items = weatherLike.map(weatherLabel).join(', ');
          prefLines.push(`- They enjoy ${items}.`);
        }
        if (petsLike.length || petsDislike.length) {
          const liked = petsLike.map(petLabel).join(', ');
          const disliked = petsDislike.map(petLabel).join(', ');
          if (liked && disliked) {
            prefLines.push(`- They love ${liked} and tend not to enjoy ${disliked}.`);
          } else if (liked) {
            prefLines.push(`- They love ${liked}.`);
          } else if (disliked) {
            prefLines.push(`- They tend not to enjoy ${disliked}.`);
          }
        }
        if (socialStyle === 'introvert') {
          prefLines.push('- They describe themselves as more on the introverted side.');
        } else if (socialStyle === 'extrovert') {
          prefLines.push('- They seem more naturally extroverted and social.');
        } else if (socialStyle === 'ambivert') {
          prefLines.push('- They feel somewhere between introvert and extrovert.');
        }
        if (crowdValue === 'dislike') {
          prefLines.push('- Crowded places can feel uncomfortable; be gentle when talking about big gatherings or busy environments.');
        }
      } else {
        const seasonLabelAr = {
          winter: 'الشتاء',
          summer: 'الصيف',
          spring: 'الربيع',
          autumn: 'الخريف',
        };
        const weatherLabelAr = {
          rain: 'الأجواء الماطرة',
          snow: 'الأيام الثلجية',
          sun: 'الأيام المشمسة',
        };
        const petLabelAr = {
          cats: 'القطط',
          dogs: 'الكلاب',
        };

        if (seasonsLike.length) {
          const items = seasonsLike
            .map((code) => seasonLabelAr[code] || code)
            .join('، ');
          prefLines.push(`- يميل أكثر لفصول مثل ${items}.`);
        }
        if (weatherLike.length) {
          const items = weatherLike
            .map((code) => weatherLabelAr[code] || code)
            .join('، ');
          prefLines.push(`- يحب أجواء مثل: ${items}.`);
        }
        if (petsLike.length || petsDislike.length) {
          const liked = petsLike
            .map((code) => petLabelAr[code] || code)
            .join('، ');
          const disliked = petsDislike
            .map((code) => petLabelAr[code] || code)
            .join('، ');
          if (liked && disliked) {
            prefLines.push(`- يحب ${liked} وغالباً لا يرتاح مع ${disliked}.`);
          } else if (liked) {
            prefLines.push(`- يحب ${liked}.`);
          } else if (disliked) {
            prefLines.push(`- غالباً لا يرتاح مع ${disliked}.`);
          }
        }
        if (socialStyle === 'introvert') {
          prefLines.push('- يصف نفسه بأنه أقرب للانطوائي أو الهادئ اجتماعياً.');
        } else if (socialStyle === 'extrovert') {
          prefLines.push('- يصف نفسه بأنه اجتماعي أكثر ويميل للتواجد مع الناس.');
        } else if (socialStyle === 'ambivert') {
          prefLines.push('- يشعر أنه بين الانطوائي والانبساطي من ناحية الاجتماعية.');
        }
        if (crowdValue === 'dislike') {
          prefLines.push('- الأماكن المزدحمة قد تكون متعبة له؛ كن ألطف عند الحديث عن الزحام أو التجمعات الكبيرة.');
        }
      }

      if (prefLines.length) {
        if (isArabic) {
          lines.push(
            'ملامح تفضيلات المستخدم (داخلية):',
            ...prefLines
          );
        } else {
          lines.push(
            'User preference hints (semantic, internal only):',
            ...prefLines
          );
        }
      }
    }
  } catch (err) {
    console.error(
      '[Phase4] semantic profile error',
      err && err.message ? err.message : err
    );
  }

  if (!lines.length) return '';

  const safetyHints = [
    'Use this context only to maintain emotional continuity, not to sound invasive.',
    'Do not quote specific past messages or dates; refer to themes in a general, human way.',
    'If you reference past struggles, keep it brief and focused on support, not analysis.',
  ];

  const header = isArabic
    ? 'Internal emotional memory hints (do NOT show to the user):'
    : 'Internal emotional memory hints (do NOT show to the user):';

  let block = [
    header,
    '',
    ...lines,
    '',
    'Guidelines for using this context:',
    ...safetyHints,
  ].join('\n');

  const MAX_PHASE4_LENGTH = 900;
  if (block.length > MAX_PHASE4_LENGTH) {
    block = block.slice(0, MAX_PHASE4_LENGTH);
  }

  return block;
}

module.exports = {
  buildPhase4MemoryBlock,
};
