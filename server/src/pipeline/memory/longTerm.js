// server/src/pipeline/memory/longTerm.js
// Long-term emotional memory (per-user profile)

const prisma = require('../../prisma');
const { detectAnchorsFromMessage, deriveEmotionalReason } = require('../../services/emotionalReasoning');
const OpenAI = require('openai');

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * Safely parse a JSON-like field from Prisma (which is already JS) into an object.
 */
function ensureObject(val) {
  if (!val || typeof val !== 'object') return {};
  return { ...val };
}

// LLM-powered name extraction from a single message text (English + Arabic).
// Returns a clean name string or null if no explicit new name is present.
async function detectNameUsingLLM(messageText) {
  const text = String(messageText || '').trim();
  if (!text || !openaiClient) {
    return null;
  }

  // Lightweight cue-based gating so we only call the LLM when the message
  // plausibly contains an explicit name change / "call me" instruction.
  // Includes both English and Arabic phrasing variants.
  const cueRegex = /(my name is|my new name is|from now on[, ]*call me|you can call me|i want you to call me|you should call me|people call me|name me|your new name is|call me|i am called|انا اسمي|أنا اسمي|اسمي الجديد|اسمي صار|اسمي يكون|اسمي|ناديني)/i;

  if (!cueRegex.test(text)) {
    return null;
  }

  // Very small heuristic language hint for the prompt only.
  const hasArabic = /[\u0600-\u06FF]/u.test(text);
  const languageHint = hasArabic ? 'ar' : 'en';

  console.log('[LongTermMemory] detectNameUsingLLM cue', {
    hasArabic,
    messageLength: text.length,
  });

  const systemPrompt = [
    'You are a precise name extractor for a mental wellbeing chat app.',
    'The user message is in Arabic or English.',
    'If the user explicitly says they changed their name or want to be called a specific name,',
    'return ONLY the new name. No punctuation. No extra words. No explanations.',
    'If you are not sure that a new name was provided, return an empty string.',
  ].join(' ');

  const userPrompt = [
    `Language hint: ${languageHint}.`,
    'User message:',
    text,
  ].join('\n');

  try {
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 16,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    let out = completion.choices?.[0]?.message?.content || '';
    out = String(out).trim();

    // Normalise trivial wrappers like quotes.
    out = out.replace(/^["'«»“”\s]+|["'«»“”\s]+$/gu, '').trim();
    if (!out) {
      console.log('[LongTermMemory] detectNameUsingLLM candidate_empty', {
        hasArabic,
      });
      return null;
    }

    // Heuristic extraction: keep only the last contiguous run of
    // Arabic/Latin letters (e.g. "your new name is Alex" -> "Alex").
    const nameMatches = out.match(/[A-Za-z\u0600-\u06FF]{2,40}/gu);
    let candidate = out;
    if (Array.isArray(nameMatches) && nameMatches.length) {
      candidate = nameMatches[nameMatches.length - 1];
    }
    candidate = String(candidate || '').trim();

    // Strip trailing punctuation around the candidate.
    candidate = candidate.replace(/[.,!?؟،]+$/gu, '').trim();

    if (!candidate) {
      console.log('[LongTermMemory] detectNameUsingLLM candidate_empty_after_extract', {
        hasArabic,
      });
      return null;
    }

    // Basic validation: length and presence of letters.
    if (candidate.length < 2 || candidate.length > 40) {
      console.log('[LongTermMemory] detectNameUsingLLM candidate_rejected_length', {
        hasArabic,
        candidateLength: candidate.length,
      });
      return null;
    }
    if (!/[A-Za-z\u0600-\u06FF]/u.test(candidate)) {
      console.log('[LongTermMemory] detectNameUsingLLM candidate_rejected_chars', {
        hasArabic,
      });
      return null;
    }

    // Guard against common non-name tokens that might slip through.
    const lower = candidate.toLowerCase();
    const banned = new Set([
      'رح',
      'من',
      'اليوم',
      'اسمي',
      'انا',
      'أنا',
      'name',
    ]);
    if (banned.has(lower)) {
      console.log('[LongTermMemory] detectNameUsingLLM candidate_rejected_banned', {
        hasArabic,
      });
      return null;
    }

    console.log('[LongTermMemory] detectNameUsingLLM candidate_accepted', {
      hasArabic,
      candidateLength: candidate.length,
    });

    return candidate;
  } catch (err) {
    console.error(
      '[LongTermMemory] detectNameUsingLLM error',
      err && err.message ? err.message : err
    );
    return null;
  }
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
      const detectedName = await detectNameUsingLLM(messageText);
      if (detectedName) {
        const kind = 'identity.name';
        const existing = await prisma.userMemoryFact.findFirst({
          where: { userId, kind },
          select: { id: true },
        });

        const isArabicName = /[\u0600-\u06FF]/u.test(detectedName);
        const isLatinName = /[A-Za-z]/.test(detectedName);

        if (existing && existing.id) {
          await prisma.userMemoryFact.update({
            where: { id: existing.id },
            data: {
              value: detectedName,
              confidence: 1.0,
              sourceMessageId: event.messageId || null,
            },
          });

          console.log('[LongTermMemory] identity.name updated', {
            userId,
            hasName: true,
            sourceMessageId: event.messageId || null,
            isArabic: isArabicName,
            isLatin: isLatinName,
            nameLength: detectedName.length,
            mode: 'update',
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

          console.log('[LongTermMemory] identity.name updated', {
            userId,
            hasName: true,
            sourceMessageId: event.messageId || null,
            isArabic: isArabicName,
            isLatin: isLatinName,
            nameLength: detectedName.length,
            mode: 'create',
          });
        }
      } else {
        console.log('[LongTermMemory] identity.name detection_skipped_or_rejected', {
          userId,
          hasMessage: true,
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

