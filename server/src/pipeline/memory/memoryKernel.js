// server/src/pipeline/memory/memoryKernel.js
// Phase 4 Memory Kernel orchestrator
// - Normalizes events
// - Updates MessageEmotion with Phase 4 fields
// - Delegates to short-term (conversation) and long-term (user) memory modules

const prisma = require('../../prisma');
const { updateShortTerm } = require('./shortTerm');
const { updateLongTerm } = require('./longTerm');

/**
 * @typedef {Object} MemoryEvent
 * @property {number} userId
 * @property {number} conversationId
 * @property {number} messageId
 * @property {string} characterId
 * @property {{ primaryEmotion:string, intensity:number, confidence:number, cultureTag:string, notes?:string, severityLevel?:string }} emotion
 * @property {string[]} [topics]
 * @property {string} [secondaryEmotion]
 * @property {Object} [emotionVector]
 * @property {string} [detectorVersion]
 * @property {boolean} [isKernelRelevant]
 * @property {Object} [outcome]
 */

/**
 * Entry point for the Phase 4 Memory Kernel.
 * This should be called after MessageEmotion has been created,
 * and before the AI reply is generated.
 *
 * @param {MemoryEvent} event
 */
async function recordEvent(event) {
  if (!event || !event.userId || !event.conversationId || !event.messageId || !event.emotion) {
    return;
  }

  const topics = Array.isArray(event.topics) ? event.topics.filter(Boolean) : [];

  // First, enrich the MessageEmotion row with metadata that does not
  // depend on previous messages (topics, secondaryEmotion, etc.).
  try {
    await prisma.messageEmotion.update({
      where: { messageId: event.messageId },
      data: {
        secondaryEmotion: event.secondaryEmotion || undefined,
        emotionVector: event.emotionVector || undefined,
        topicTags: topics.length ? topics : undefined,
        detectorVersion: event.detectorVersion || undefined,
        isKernelRelevant: event.isKernelRelevant === false ? false : true,
      },
    });
  } catch (err) {
    console.error('[MemoryKernel] Failed to enrich MessageEmotion', err && err.message ? err.message : err);
  }

  // Short-term: rolling window per conversation
  let shortSummary = null;
  try {
    shortSummary = await updateShortTerm(event.conversationId, {
      ...event,
      topics,
    });
  } catch (err) {
    console.error('[MemoryKernel] updateShortTerm error', err && err.message ? err.message : err);
  }

  // Long-term: user profile & patterns (best effort)
  try {
    await updateLongTerm(event.userId, {
      ...event,
      topics,
      ...(shortSummary || {}),
    }, event.outcome || null);
  } catch (err) {
    console.error('[MemoryKernel] updateLongTerm error', err && err.message ? err.message : err);
  }
}

/**
 * Retrieve best-effort identity memory (user name) for a given userId.
 * Always prefers semantic memory (UserMemoryFact.identity.name) when present.
 * Only falls back to User.name when no semantic fact exists or value is empty.
 * Returns a small object or null.
 */
async function getIdentityMemory({ userId }) {
  if (!userId || !Number.isFinite(Number(userId))) {
    return null;
  }
  const uid = Number(userId);

  let result = null;

  try {
    // --- 1) Semantic memory: UserMemoryFact(identity.name) ---
    try {
      let fact = null;

      const model = prisma && prisma.userMemoryFact;
      if (!model || typeof model.findFirst !== 'function') {
        // In some environments the generated Prisma client may be stale and not
        // yet include the UserMemoryFact delegate. Fall back to a raw query
        // against the underlying table so semantic memory still works.
        console.error('[MemoryKernel] getIdentityMemory fact model missing on prisma client; using raw query fallback');

        try {
          const rows = await prisma.$queryRaw`
            SELECT "value", "confidence"
            FROM "UserMemoryFact"
            WHERE "userId" = ${uid} AND "kind" = 'identity.name'
            ORDER BY "updatedAt" DESC
            LIMIT 1
          `;
          if (Array.isArray(rows) && rows.length > 0) {
            fact = rows[0];
          }
        } catch (rawErr) {
          console.error(
            '[MemoryKernel] getIdentityMemory raw fact query error',
            rawErr && rawErr.message ? rawErr.message : rawErr
          );
        }
      } else {
        fact = await model.findFirst({
          where: { userId: uid, kind: 'identity.name' },
          orderBy: { updatedAt: 'desc' },
          select: { value: true, confidence: true },
        });
      }

      if (fact && typeof fact.value === 'string') {
        const trimmed = fact.value.trim();
        if (trimmed) {
          // Basic validation to avoid polluted semantic names.
          if (trimmed.length >= 2 && trimmed.length <= 40 && /[A-Za-z\u0600-\u06FF]/u.test(trimmed)) {
            const lower = trimmed.toLowerCase();
            const banned = new Set([
              'رح',
              'من',
              'اليوم',
              'اسمي',
              'انا',
              'أنا',
              'name',
              'my name',
              'call me',
            ]);

            if (!banned.has(lower)) {
              result = {
                name: trimmed,
                kind: 'identity.name',
                confidence:
                  typeof fact.confidence === 'number' && Number.isFinite(fact.confidence)
                    ? fact.confidence
                    : 1.0,
                source: 'UserMemoryFact',
              };
            }
          }
        }
      }
    } catch (err) {
      console.error(
        '[MemoryKernel] getIdentityMemory fact query error',
        err && err.message ? err.message : err
      );
    }

    // --- 2) Fallback: account-level name only if no semantic fact was usable ---
    if (!result) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: uid },
          select: { name: true },
        });
        if (user && typeof user.name === 'string') {
          const trimmed = user.name.trim();
          if (trimmed) {
            result = {
              name: trimmed,
              kind: 'identity.name',
              confidence: 0.7,
              source: 'User.name',
            };
          }
        }
      } catch (err) {
        console.error(
          '[MemoryKernel] getIdentityMemory user fallback error',
          err && err.message ? err.message : err
        );
      }
    }
  } catch (err) {
    console.error(
      '[MemoryKernel] getIdentityMemory error',
      err && err.message ? err.message : err
    );
  }

  console.log('[MemoryKernel] getIdentityMemory', {
    userId: uid,
    hasName: !!result,
    source: result && result.source ? result.source : null,
  });

  return result;
}

/**
 * Build a compact persona snapshot from semantic UserMemoryFact rows.
 *
 * This is intentionally coarse: it only uses high-level facts (age, country,
 * city, language, role, domain, long-term goals, themes, traits and a few
 * preferences) and turns them into short, non-creepy summary lines.
 *
 * The function is defensive against older Prisma clients that may not yet have
 * the UserMemoryFact delegate; in that case it simply returns empty output.
 *
 * @param {{ userId:number }} params
 * @returns {Promise<{ facts:Object, summaryLinesEn:string[], summaryLinesAr:string[] }>}
 */
async function getPersonaSnapshot({ userId }) {
  if (!userId || !Number.isFinite(Number(userId))) {
    return { facts: {}, summaryLinesEn: [], summaryLinesAr: [] };
  }
  const uid = Number(userId);

  const model = prisma && prisma.userMemoryFact;
  if (!model || typeof model.findMany !== 'function') {
    console.error(
      '[MemoryKernel] getPersonaSnapshot: userMemoryFact delegate missing on prisma client'
    );
    return { facts: {}, summaryLinesEn: [], summaryLinesAr: [] };
  }

  let rows = [];
  try {
    rows = await model.findMany({
      where: {
        userId: uid,
        kind: {
          in: [
            // Core profile facts
            'profile.age',
            'profile.location.country',
            'profile.location.city',
            'profile.language.primary',
            'profile.language.dialect',
            'profile.role',
            'profile.domain',
            'profile.goal.primary',
            'profile.goal.secondary',
            'profile.theme.health',
            'profile.theme.academic',
            'profile.theme.family',
            'profile.theme.work',
            'profile.job.title',
            'profile.job.field',
            'goal.long_term',
            // Traits & coping
            'trait.personality.keywords',
            'trait.coping.style',
            'trait.mental.main',
            'trait.mental.secondary',
            // Preferences (shared with Phase4)
            'preference.season.like',
            'preference.season.dislike',
            'preference.weather.like',
            'preference.weather.dislike',
            'preference.pets.like',
            'preference.pets.dislike',
            'preference.crowds',
            'trait.social.style',
            'preference.drink.like',
            'preference.food.like',
            'preference.hobby.like',
          ],
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 96,
    });
  } catch (err) {
    console.error(
      '[MemoryKernel] getPersonaSnapshot fact query error',
      err && err.message ? err.message : err
    );
    return { facts: {}, summaryLinesEn: [], summaryLinesAr: [] };
  }

  if (!Array.isArray(rows) || !rows.length) {
    return { facts: {}, summaryLinesEn: [], summaryLinesAr: [] };
  }

  const getLatest = (kind) => {
    const row = rows.find(
      (r) => r && r.kind === kind && typeof r.value === 'string'
    );
    if (!row) return null;
    const v = String(row.value || '').trim();
    return v || null;
  };

  const collectAll = (kind) => {
    const vals = [];
    for (const r of rows) {
      if (!r || r.kind !== kind || typeof r.value !== 'string') continue;
      const v = r.value.trim();
      if (!v) continue;
      if (!vals.includes(v)) vals.push(v);
    }
    return vals;
  };

  const age = getLatest('profile.age');
  const country = getLatest('profile.location.country');
  const city = getLatest('profile.location.city');
  const primaryLanguage = getLatest('profile.language.primary');
  const dialect = getLatest('profile.language.dialect');
  const role = getLatest('profile.role');
  const domain = getLatest('profile.domain');
  const jobTitle = getLatest('profile.job.title');
  const jobField = getLatest('profile.job.field');
  const goalPrimary = getLatest('profile.goal.primary');
  const goalSecondary = getLatest('profile.goal.secondary');
  const longTermGoal = getLatest('goal.long_term');

  const themeHealth = getLatest('profile.theme.health');
  const themeAcademic = getLatest('profile.theme.academic');
  const themeFamily = getLatest('profile.theme.family');
  const themeWork = getLatest('profile.theme.work');

  const personalityRaw = getLatest('trait.personality.keywords');
  const personalityKeywords = [];
  if (personalityRaw) {
    const parts = personalityRaw
      .split(/[,،]/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const p of parts) {
      if (!personalityKeywords.includes(p)) {
        personalityKeywords.push(p);
      }
    }
  }

  const copingStyle = getLatest('trait.coping.style');
  const mentalMain = getLatest('trait.mental.main');
  const mentalSecondary = getLatest('trait.mental.secondary');

  const seasonsLike = collectAll('preference.season.like');
  const seasonsDislike = collectAll('preference.season.dislike');
  const weatherLike = collectAll('preference.weather.like');
  const weatherDislike = collectAll('preference.weather.dislike');
  const petsLike = collectAll('preference.pets.like');
  const petsDislike = collectAll('preference.pets.dislike');
  const crowdPref = getLatest('preference.crowds');
  const socialStyle = getLatest('trait.social.style');
  const drinkLike = collectAll('preference.drink.like');
  const foodLike = collectAll('preference.food.like');
  const hobbyLike = collectAll('preference.hobby.like');

  const facts = {
    profile: {
      age: age || null,
      location: {
        country: country || null,
        city: city || null,
      },
      language: {
        primary: primaryLanguage || null,
        dialect: dialect || null,
      },
      role: role || null,
      domain: domain || null,
      job: {
        title: jobTitle || null,
        field: jobField || null,
      },
      goals: {
        primary: goalPrimary || null,
        secondary: goalSecondary || null,
        longTerm: longTermGoal || null,
      },
      themes: {
        health: themeHealth || null,
        academic: themeAcademic || null,
        family: themeFamily || null,
        work: themeWork || null,
      },
    },
    traits: {
      personalityKeywords,
      copingStyle: copingStyle || null,
      mental: {
        main: mentalMain || null,
        secondary: mentalSecondary || null,
      },
    },
    preferences: {
      seasonsLike,
      seasonsDislike,
      weatherLike,
      weatherDislike,
      petsLike,
      petsDislike,
      crowds: crowdPref || null,
      socialStyle: socialStyle || null,
      drinkLike,
      foodLike,
      hobbyLike,
    },
  };

  const summaryLinesEn = [];
  const summaryLinesAr = [];

  if (age) {
    summaryLinesEn.push(`They seem to be around ${age} years old (approximate).`);
    summaryLinesAr.push(`يبدو أنه في عمر يقارب ${age} سنة (تقديريًا).`);
  }

  if (country && city) {
    summaryLinesEn.push(`They are based in ${city}, ${country}.`);
    summaryLinesAr.push(`يعيش في ${city}، ${country}.`);
  } else if (country) {
    summaryLinesEn.push(`They are based in ${country}.`);
    summaryLinesAr.push(`يعيش في ${country}.`);
  }

  if (primaryLanguage || dialect) {
    if (primaryLanguage && dialect) {
      summaryLinesEn.push(
        `They mainly use ${primaryLanguage} and prefer a ${dialect} style when speaking.`
      );
      summaryLinesAr.push(
        `يميل لاستخدام ${primaryLanguage} ويفضّل لهجة ${dialect} في الكلام.`
      );
    } else if (primaryLanguage) {
      summaryLinesEn.push(`They mainly use ${primaryLanguage} in conversation.`);
      summaryLinesAr.push(`يميل لاستخدام ${primaryLanguage} في المحادثة.`);
    }
  }

  if (role || domain) {
    if (role && domain) {
      summaryLinesEn.push(`Their current role looks like ${role} in ${domain}.`);
      summaryLinesAr.push(`دوره الحالي يبدو كـ ${role} في مجال ${domain}.`);
    } else if (role) {
      summaryLinesEn.push(`They describe themselves mainly as ${role}.`);
      summaryLinesAr.push(`يصف نفسه غالبًا بأنه ${role}.`);
    }
  }

  if (jobTitle || jobField) {
    if (jobTitle && jobField) {
      summaryLinesEn.push(`Their job title appears to be ${jobTitle} in the field of ${jobField}.`);
      summaryLinesAr.push(`يبدو أن مسمّاه الوظيفي هو ${jobTitle} في مجال ${jobField}.`);
    } else if (jobTitle) {
      summaryLinesEn.push(`They mentioned a job title similar to ${jobTitle}.`);
      summaryLinesAr.push(`ذكر مسمّى وظيفي قريب من ${jobTitle}.`);
    }
  }

  if (goalPrimary || goalSecondary || longTermGoal) {
    if (longTermGoal) {
      summaryLinesEn.push(
        `They described a longer-term dream or direction: ${longTermGoal}.`
      );
      summaryLinesAr.push(
        `ذكر حلمًا أو توجهًا طويل الأمد: ${longTermGoal}.`
      );
    }
    if (goalPrimary) {
      summaryLinesEn.push(
        `One important life direction they mentioned is: ${goalPrimary}.`
      );
      summaryLinesAr.push(
        `ذكر هدفًا مهمًا في حياته: ${goalPrimary}.`
      );
    }
    if (goalSecondary && goalSecondary !== goalPrimary) {
      summaryLinesEn.push(
        `They also talked about another direction or dream: ${goalSecondary}.`
      );
      summaryLinesAr.push(
        `تحدّث أيضًا عن اتجاه أو حلم آخر: ${goalSecondary}.`
      );
    }
  }

  const themeBitsEn = [];
  const themeBitsAr = [];
  if (themeHealth) {
    themeBitsEn.push(themeHealth);
    themeBitsAr.push(themeHealth);
  }
  if (themeAcademic) {
    themeBitsEn.push(themeAcademic);
    themeBitsAr.push(themeAcademic);
  }
  if (themeFamily) {
    themeBitsEn.push(themeFamily);
    themeBitsAr.push(themeFamily);
  }
  if (themeWork) {
    themeBitsEn.push(themeWork);
    themeBitsAr.push(themeWork);
  }
  if (themeBitsEn.length) {
    summaryLinesEn.push(
      `Recurring life themes they talk about: ${themeBitsEn.join(', ')}.`
    );
    summaryLinesAr.push(
      `مواضيع حياة تتكرّر في كلامه: ${themeBitsAr.join('، ')}.`
    );
  }

  if (personalityKeywords.length) {
    const joinedEn = personalityKeywords.join(', ');
    summaryLinesEn.push(
      `They use words like ${joinedEn} when describing their own personality.`
    );
    summaryLinesAr.push(
      `يستخدم كلمات مثل ${joinedEn} لوصف شخصيته.`
    );
  }

  if (copingStyle) {
    summaryLinesEn.push(
      `For coping, they sometimes lean on: ${copingStyle}.`
    );
    summaryLinesAr.push(
      `عند التعامل مع الضغط يلجأ أحيانًا إلى: ${copingStyle}.`
    );
  }

  if (mentalMain || mentalSecondary) {
    const enParts = [];
    const arParts = [];
    if (mentalMain) {
      enParts.push(mentalMain);
      arParts.push(mentalMain);
    }
    if (mentalSecondary && mentalSecondary !== mentalMain) {
      enParts.push(mentalSecondary);
      arParts.push(mentalSecondary);
    }
    if (enParts.length) {
      summaryLinesEn.push(
        `They describe their longer-term mental state with phrases like: ${enParts.join(', ')}.`
      );
      summaryLinesAr.push(
        `يصف حالته النفسية على المدى الطويل بعبارات مثل: ${arParts.join('، ')}.`
      );
    }
  }

  // Keep persona block compact: trim to a few lines in each language.
  if (summaryLinesEn.length > 6) {
    summaryLinesEn.length = 6;
  }
  if (summaryLinesAr.length > 6) {
    summaryLinesAr.length = 6;
  }

  console.log('[MemoryKernel] getPersonaSnapshot', {
    userId: uid,
    factCount: rows.length,
    hasProfile: !!(
      age ||
      country ||
      city ||
      primaryLanguage ||
      role ||
      domain ||
      jobTitle ||
      jobField ||
      goalPrimary ||
      goalSecondary ||
      longTermGoal
    ),
    hasTraits: !!(personalityKeywords.length || copingStyle || mentalMain || mentalSecondary),
    hasJob: !!(jobTitle || jobField),
    hasLongTermGoal: !!longTermGoal,
    hasDrinkFoodHobby: !!(drinkLike.length || foodLike.length || hobbyLike.length),
    summaryEnCount: summaryLinesEn.length,
    summaryArCount: summaryLinesAr.length,
  });

  return { facts, summaryLinesEn, summaryLinesAr };
}

module.exports = {
  recordEvent,
  updateShortTerm,
  updateLongTerm,
  getIdentityMemory,
  getPersonaSnapshot,
};

