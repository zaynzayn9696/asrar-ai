// server/src/services/mirrorService.js
// AI Mirror Mode: compute emotional patterns and ask the LLM to reflect them
// back in a gentle, non-clinical narrative.

const OpenAI = require('openai');
const prisma = require('../prisma');
const { logEmotionalEvent } = require('./timelineService');
const { getPersonaSnapshot } = require('../pipeline/memory/memoryKernel');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Thresholds for deciding when there is enough persona-level history.
// We allow early, honest micro-mirrors once there is a modest signal,
// and only block when data is truly minimal.
const MIRROR_MIN_MESSAGES = 12;
const MIRROR_MIN_DISTINCT_DAYS = 2;
const MIRROR_MIN_MESSAGES_ABSOLUTE = 3;

const NEGATIVE_LABELS = new Set(['SAD', 'ANXIOUS', 'ANGRY', 'LONELY', 'STRESSED']);

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseRangeToDays(rangeDays) {
  if (!rangeDays) return 30;
  if (Number.isFinite(Number(rangeDays))) return Number(rangeDays) || 30;
  return 30;
}

async function getIdentityAndPreferencesForUser(userId) {
  if (!userId) return null;

  try {
    const facts = await prisma.userMemoryFact.findMany({
      where: {
        userId,
        kind: {
          in: [
            'identity.name',
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
      take: 64,
    });

    if (!facts || !facts.length) {
      return null;
    }

    const grouped = {};
    for (const f of facts) {
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

    const identityName = (grouped['identity.name'] && grouped['identity.name'][0]) || null;

    const seasonsLike = grouped['preference.season.like'] || [];
    const seasonsDislike = grouped['preference.season.dislike'] || [];
    const weatherLike = grouped['preference.weather.like'] || [];
    const weatherDislike = grouped['preference.weather.dislike'] || [];
    const petsLike = grouped['preference.pets.like'] || [];
    const petsDislike = grouped['preference.pets.dislike'] || [];
    const crowdPrefs = grouped['preference.crowds'] || [];
    const socialStyles = grouped['trait.social.style'] || [];

    const crowdValue = crowdPrefs[0] || null;
    const socialStyle = socialStyles[0] || null;

    try {
      console.log('[Mirror] identity_prefs_snapshot', {
        userId,
        hasName: !!identityName,
        seasonsLikeCount: seasonsLike.length,
        weatherLikeCount: weatherLike.length,
        petsLikeCount: petsLike.length,
        hasCrowdPref: !!crowdValue,
        hasSocialStyle: !!socialStyle,
      });
    } catch (_) {}

    return {
      identity: identityName ? { name: identityName } : null,
      preferences: {
        seasonsLike,
        seasonsDislike,
        weatherLike,
        weatherDislike,
        petsLike,
        petsDislike,
        crowds: crowdValue,
        socialStyle,
      },
    };
  } catch (err) {
    console.error('[Mirror] identity/prefs load error', err && err.message ? err.message : err);
    return null;
  }
}

async function generateMirrorInsights({ userId, personaId, rangeDays }) {
  const days = parseRangeToDays(rangeDays);
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Allow a global, cross-persona view when personaId is "all" or "global".
  const personaFilter =
    personaId && personaId !== 'all' && personaId !== 'global'
      ? String(personaId)
      : null;

  let summaries = [];
  let events = [];

  try {
    summaries = await prisma.emotionalDailySummary.findMany({
      where: {
        userId,
        ...(personaFilter ? { personaId: personaFilter } : {}),
        date: { gte: start },
      },
      orderBy: { date: 'asc' },
    });
  } catch (err) {
    console.error('[Mirror] Failed to load EmotionalDailySummary', err && err.message ? err.message : err);
    summaries = [];
  }

  try {
    events = await prisma.emotionalEvent.findMany({
      where: {
        userId,
        ...(personaFilter ? { personaId: personaFilter } : {}),
        timestamp: { gte: start },
      },
      orderBy: { timestamp: 'asc' },
    });
  } catch (err) {
    console.error('[Mirror] Failed to load EmotionalEvent', err && err.message ? err.message : err);
    events = [];
  }

  if (!summaries.length && !events.length) {
    return {
      hasData: false,
      rangeDays: days,
    };
  }

  const emotionTotals = {};
  let totalMessages = 0;
  let weightedIntensitySum = 0;
  let negativeMessages = 0;

  for (const s of summaries) {
    const counts = (s.emotionCounts && typeof s.emotionCounts === 'object') ? s.emotionCounts : {};
    for (const [emotionRaw, count] of Object.entries(counts)) {
      const emotion = String(emotionRaw || '').toUpperCase();
      const c = typeof count === 'number' ? count : 0;
      if (!emotionTotals[emotion]) emotionTotals[emotion] = 0;
      emotionTotals[emotion] += c;
      totalMessages += c;
      weightedIntensitySum += c * (Number(s.avgIntensity) || 0);
      if (NEGATIVE_LABELS.has(emotion)) {
        negativeMessages += c;
      }
    }
  }

  const topEmotions = Object.entries(emotionTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([emotion, count]) => ({
      emotion,
      share: totalMessages ? count / totalMessages : 0,
    }));

  const avgIntensity = totalMessages
    ? weightedIntensitySum / totalMessages
    : 0;

  const negativeShare = totalMessages
    ? Math.max(0, Math.min(1, negativeMessages / totalMessages))
    : 0;

  // Time-of-day patterns from events.
  const buckets = {
    morning: { label: 'morning', from: 5, to: 12, count: 0 },
    afternoon: { label: 'afternoon', from: 12, to: 17, count: 0 },
    evening: { label: 'evening', from: 17, to: 23, count: 0 },
    night: { label: 'night', from: 23, to: 24, count: 0, extra: { from: 0, to: 5 } },
  };

  for (const ev of events) {
    const d = new Date(ev.timestamp);
    const hour = d.getHours();
    if (hour >= 5 && hour < 12) buckets.morning.count += 1;
    else if (hour >= 12 && hour < 17) buckets.afternoon.count += 1;
    else if (hour >= 17 && hour < 23) buckets.evening.count += 1;
    else buckets.night.count += 1;
  }

  let dominantPeriod = null;
  let maxCount = -1;
  for (const b of Object.values(buckets)) {
    if (b.count > maxCount) {
      maxCount = b.count;
      dominantPeriod = b.label;
    }
  }

  // Trend: compare first half vs second half of the window.
  let trend = 'stable';
  if (summaries.length >= 4) {
    const mid = Math.floor(summaries.length / 2);
    const first = summaries.slice(0, mid);
    const second = summaries.slice(mid);

    const avgFirst =
      first.reduce((acc, s) => acc + (Number(s.avgIntensity) || 0), 0) /
      first.length;
    const avgSecond =
      second.reduce((acc, s) => acc + (Number(s.avgIntensity) || 0), 0) /
      second.length;

    const delta = avgSecond - avgFirst;
    if (delta > 0.05) trend = 'more_intense';
    else if (delta < -0.05) trend = 'less_intense';
  }

  const firstDate = summaries.length ? startOfDay(summaries[0].date) : start;
  const lastDate = summaries.length
    ? startOfDay(summaries[summaries.length - 1].date)
    : startOfDay(now);

  // Compute an approximate span in days and a human-friendly period label
  const spanMs = lastDate.getTime() - firstDate.getTime();
  const spanDays = Math.max(1, Math.round(spanMs / (24 * 60 * 60 * 1000)));
  const totalDays = summaries.length;

  let periodKey = 'recent_period';
  let periodLabel = 'the recent period';

  if (spanDays <= 2 && totalMessages < 10) {
    periodKey = 'early';
    periodLabel = 'these early conversations';
  } else if (spanDays <= 7) {
    periodKey = 'few_days';
    periodLabel = 'the past few days';
  } else if (spanDays <= 21) {
    periodKey = 'couple_of_weeks';
    periodLabel = 'the past couple of weeks';
  } else {
    periodKey = 'month';
    periodLabel = 'the past month';
  }

  // Decide if we truly have enough persona-level history to justify
  // a detailed reflection. We only block when data is extremely thin;
  // otherwise we allow an early mirror (with lowData flag) so the user
  // sees honest progress quickly.
  let notEnoughHistory = false;
  let lowData = false;

  if (totalMessages < MIRROR_MIN_MESSAGES_ABSOLUTE) {
    notEnoughHistory = true;
  } else if (
    totalMessages < MIRROR_MIN_MESSAGES ||
    totalDays < MIRROR_MIN_DISTINCT_DAYS
  ) {
    lowData = true;
  }

  return {
    hasData: true,
    rangeDays: days,
    topEmotions,
    avgIntensity,
    timePatterns: {
      dominantPeriod,
      buckets: Object.values(buckets).map((b) => ({ label: b.label, count: b.count })),
    },
    recentChanges: {
      intensityTrend: trend,
    },
    meta: {
      firstDate,
      lastDate,
      totalMessages,
      totalDays,
      spanDays,
      periodKey,
      periodLabel,
      negativeShare,
      notEnoughHistory,
      lowData,
      personaScope: personaFilter ? 'persona' : 'global',
    },
  };
}

async function callLLMForMirror({ insights, personaMeta, lang, personaSnapshot, identityProfile, personaScope }) {
  // Mirror language should follow the UI language from the client.
  // If lang is missing or unknown, fall back to English.
  const rawLang = typeof lang === 'string' ? lang.toLowerCase() : '';
  const language = rawLang === 'ar' ? 'ar' : 'en';

  const isAr = language === 'ar';

  const basePromptAr =
    'أنت رفيق عاطفي داخل تطبيق "أسرار". وظيفتك أن تعكس للمستخدم نمط مشاعره بلطف، بدون أي لغة طبية أو تشخيصية، وبدون ذكر أمراض نفسية، وبدون إعطاء وعود بالعلاج. تحدّث كصديق مهتم من المنطقة، يستخدم لغة بسيطة ودافئة.';
  const basePromptEn =
    'You are an emotional companion inside an app called Asrar. Your job is to gently reflect emotional patterns back to the user, without using clinical or diagnostic language, without naming disorders, and without promising treatment. Speak like a caring friend from their region in simple, warm language.';

  // Explicitly pin the LLM to the requested language so Mirror Mode always
  // matches the UI language.
  const languageInstruction = isAr
    ? 'استجب دائماً بالكامل باللغة المحددة في الحقل lang. إذا كانت lang = "ar" فليكن الرد بالعربية فقط، وإذا كانت lang = "en" فليكن الرد بالإنجليزية فقط، ولا تخلط بين اللغتين في نفس الرد.'
    : 'Respond fully in the language given by the `lang` parameter. If lang = "en", output English only and do not include Arabic text. If lang = "ar", output Arabic only. Do not mix languages in a single reply.';

  const systemPrompt = `${isAr ? basePromptAr : basePromptEn}\n\n${languageInstruction}`;

  let personaProfile = null;
  try {
    if (personaSnapshot && typeof personaSnapshot === 'object') {
      const lines = isAr
        ? Array.isArray(personaSnapshot.summaryLinesAr)
          ? personaSnapshot.summaryLinesAr
          : []
        : Array.isArray(personaSnapshot.summaryLinesEn)
        ? personaSnapshot.summaryLinesEn
        : [];
      if (lines.length) {
        personaProfile = {
          summaryLines: lines.slice(0, 6),
        };
      }
    }
  } catch (err) {
    console.error(
      '[Mirror] persona snapshot build error',
      err && err.message ? err.message : err
    );
    personaProfile = null;
  }

  const userContent = JSON.stringify({
    persona: personaMeta || null,
    personaProfile,
    insights,
    identity: identityProfile && identityProfile.identity ? identityProfile.identity : null,
    preferences: identityProfile && identityProfile.preferences ? identityProfile.preferences : null,
  });

  const userInstruction = isAr
    ? 'حول هذا الملخص العددي إلى فقرتين أو ثلاث فقرات قصيرة تشرح للمستخدم بلطف كيف كانت أجواؤه ومشاعره في الفترة الماضية، مع ملاحظات بسيطة عن الأوقات التي يكثر فيها الحديث، وأي تحسن أو ضغط واضح، ثم اختم بجملة تشجيعية لطيفة. لا تستخدم أي مصطلحات تشخيصية.'
    : 'Turn this numeric summary into two or three short paragraphs that gently explain to the user how their overall mood and feelings have been in the recent period, including simple notes about the times of day they tend to talk more and any clear improvements or pressure. Finish with one warm, encouraging sentence. Do not use clinical or diagnostic language, and do not name mental disorders.';

  const timeInstruction = isAr
    ? 'عند وصف الفترة الزمنية، اعتمد على الحقل insights.meta.periodLabel فقط (مثل: "هذه البدايات المبكرة"، "الأيام القليلة الماضية"، "الأسابيع القليلة الماضية"، "الشهر الماضي")، ولا تدّعِ فترة أطول من هذه التسمية.'
    : 'When you talk about the time period, always base it on `insights.meta.periodLabel` (for example: "in these early conversations", "over the past few days", "over the past couple of weeks", "over the past month") and do not claim a longer time span than this label implies.';

  const emotionInstruction = isAr
    ? 'انتبه جيدًا لتوزيع المشاعر في insights.topEmotions وشدة avgIntensity. إذا كانت المشاعر السلبية (مثل الحزن أو القلق أو الغضب أو الوحدة أو الضغط) هي الغالبة، فاذكر ذلك بوضوح ولا تصف النمط بأنه هادئ أو محايد.'
    : 'Pay close attention to the distribution of emotions in `insights.topEmotions` and the overall `avgIntensity`. If negative emotions (sad, anxious, angry, lonely, stressed) are dominant, clearly acknowledge this distress or tension instead of calling the pattern calm or neutral.';

  const identityPrefInstruction = isAr
    ? 'لو تم توفير اسم في الحقل identity.name، استخدمه مرة واحدة في بداية الرد لتنادي المستخدم باسمه بشكل لطيف. لو تم توفير تفضيلات في الحقل preferences (مثل الفصول أو الجو أو الحيوانات الأليفة أو الزحام)، فاذكر واحدة أو اثنتين من هذه التفضيلات في الوصف بطريقة طبيعية (مثلاً: أنه يحب الشتاء والأجواء الماطرة، أو أنه لا يرتاح في الأماكن المزدحمة)، ولا تخترع تفضيلات غير موجودة في البيانات.'
    : 'If a name is provided in `identity.name`, address the user by this name once near the start of your reflection in a warm, natural way. If preferences are present in `preferences` (for example seasons, weather, pets, or crowds), mention one or two of these real preferences explicitly in your summary (e.g. that they love winter and rainy weather, or that crowded places can feel draining), but do not invent preferences that are not present in the data.';

  const personaInstruction = isAr
    ? 'ستصلك ملامح داخلية تقريبية عن حياة المستخدم في الحقل personaProfile.summaryLines (مثل عمر تقريبي، بلد، دور دراسي/عملي، أهداف طويلة المدى، وبعض السمات). استخدم هذه الملاحظات فقط لاختيار طريقة الكلام والأمثلة الأقرب لواقع حياته، بدون أن تذكر هذه الجمل حرفيًا للمستخدم أو تقول إن عندك "ملف شخصي" عنه أو أرقام عن شخصيته. لو كانت personaProfile = null أو لا تحوي جملًا، تجاهلها ببساطة.'
    : 'You may receive a small internal persona profile in `personaProfile.summaryLines` (approximate age, country/city, role, long-term goals, themes, traits). Use these hints only to choose tone and examples that fit the user’s life. Do NOT list them back as analytics, do NOT say you have a "profile" about them, and do NOT quote the lines word-for-word. If `personaProfile` is null or empty, just ignore it.';

  const hallucinationGuard = isAr
    ? 'اعتمد فقط على الحقول الموجودة في JSON أدناه. إذا كان أي حقل مفقود أو فارغ، صرّح بوضوح أنك لا تعرفه ولا تحاول التخمين. لا تضف حقائق أو أحداث غير موجودة في البيانات.'
    : 'Use only the fields present in the JSON below. If any field is missing or empty, clearly state you do not know it and do not guess. Do not add facts or events that are not in the data.';

  const scopeInstruction = personaScope === 'global'
    ? (isAr
        ? 'هذا الانعكاس يجب أن يكون بنظرة شاملة عبر جميع الشخصيات والمحادثات، ركّز على الأنماط المتكررة عالميًا وليس على هذه الشخصية فقط.'
        : 'This reflection should take a bird’s-eye view across all companions and conversations, focusing on recurring global patterns rather than this single character.')
    : (isAr
        ? 'هذا الانعكاس يخص هذه الشخصية الحالية فقط؛ لا تتحدث وكأنك ترى كل الشخصيات، بل تحدث بنبرة هذه الشخصية معتمداً على بياناتها والحقائق العامة.'
        : 'This reflection is for the current character only; do not speak as if you see all companions, but keep the tone of this character while using the provided facts.');

  const safetyInstruction = isAr
    ? 'تجنب اللغة الطبية أو التشخيصية. لا تذكر اضطرابات، ولا تقدّم وعود علاجية. كن داعماً ودافئاً فقط.'
    : 'Avoid clinical or diagnostic language. Do not name disorders or promise treatment. Stay supportive and warm only.';

  const userPrompt = [
    userInstruction,
    timeInstruction,
    emotionInstruction,
    identityPrefInstruction,
    personaInstruction,
    scopeInstruction,
    hallucinationGuard,
    safetyInstruction,
    '',
    'JSON:',
    userContent,
  ].join('\n\n');

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_CORE_MODEL || 'gpt-4o-mini',
      temperature: 0.75,
      max_tokens: 450,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const text = completion.choices?.[0]?.message?.content?.trim() || '';
    return { summaryText: text };
  } catch (err) {
    console.error('[Mirror] LLM call failed', err && err.message ? err.message : err);
    return { summaryText: null };
  }
}

async function generateMirrorForUser({ userId, personaId, rangeDays, personaMeta, lang }) {
  const insights = await generateMirrorInsights({ userId, personaId, rangeDays });

  if (!insights.hasData) {
    return { summaryText: null, insights, notEnoughHistory: true };
  }

  if (insights.meta && insights.meta.notEnoughHistory) {
    // Truly minimal data — keep honest "not enough" state.
    return { summaryText: null, insights, notEnoughHistory: true };
  }

  // Early-data micro-mirror: provide a grounded, short reflection without LLM when data is thin but non-zero.
  if (insights.meta && insights.meta.lowData) {
    const langKey = typeof lang === 'string' && lang.toLowerCase() === 'ar' ? 'ar' : 'en';
    const top = Array.isArray(insights.topEmotions) && insights.topEmotions.length
      ? insights.topEmotions[0]
      : null;
    const second = Array.isArray(insights.topEmotions) && insights.topEmotions.length > 1
      ? insights.topEmotions[1]
      : null;
    const dominantLabel = top && top.emotion ? String(top.emotion).toLowerCase() : null;
    const secondLabel = second && second.emotion ? String(second.emotion).toLowerCase() : null;
    const period = insights.meta.periodLabel || (langKey === 'ar' ? 'هذه المحادثات المبكرة' : 'these early conversations');
    const intensity = typeof insights.avgIntensity === 'number'
      ? Math.max(0, Math.min(1, insights.avgIntensity))
      : 0;

    const piecesEn = [
      period ? `In ${period},` : 'In these chats,',
      dominantLabel
        ? `you most often sound ${dominantLabel}.`
        : 'your tone is just starting to show.',
      secondLabel ? `You also dip into ${secondLabel} at times.` : null,
      intensity > 0.55
        ? 'Your feelings come through with some heat.'
        : intensity > 0.35
        ? 'Your feelings show up with medium strength.'
        : 'Your tone stays relatively soft so far.',
      'This is an early mirror—keep sharing and it will get sharper.',
    ].filter(Boolean).join(' ');

    const piecesAr = [
      period ? `في ${period},` : 'في هذه المحادثات المبكرة،',
      dominantLabel
        ? `يبدو صوتك غالبًا ${dominantLabel}.`
        : 'ملامح نبرة صوتك بدأت للتو في الظهور.',
      secondLabel ? `وأحيانًا تميل إلى ${secondLabel}.` : null,
      intensity > 0.55
        ? 'مشاعرك تظهر بوضوح وبشيء من الحدة.'
        : intensity > 0.35
        ? 'مشاعرك تظهر بقوة متوسطة.'
        : 'نبرة صوتك هادئة نسبيًا حتى الآن.',
      'هذا انعكاس مبكر—واصل المشاركة ليصبح أدق.',
    ].filter(Boolean).join(' ');

    return {
      summaryText: langKey === 'ar' ? piecesAr : piecesEn,
      insights,
      notEnoughHistory: false,
    };
  }

  // Persona snapshot (age/location/goals/etc)
  let personaSnapshot = null;
  try {
    personaSnapshot = await getPersonaSnapshot({ userId });
  } catch (err) {
    console.error(
      '[Mirror] getPersonaSnapshot error',
      err && err.message ? err.message : err
    );
    personaSnapshot = null;
  }

  const summaryEnCount =
    personaSnapshot && Array.isArray(personaSnapshot.summaryLinesEn)
      ? personaSnapshot.summaryLinesEn.length
      : 0;
  const summaryArCount =
    personaSnapshot && Array.isArray(personaSnapshot.summaryLinesAr)
      ? personaSnapshot.summaryLinesAr.length
      : 0;

  console.log('[Mirror] persona snapshot', {
    userId,
    hasPersona: !!personaSnapshot && (summaryEnCount > 0 || summaryArCount > 0),
    summaryEnCount,
    summaryArCount,
  });

  // Identity + preferences (name, seasons, weather, pets, crowds)
  const identityProfile = await getIdentityAndPreferencesForUser(userId);

  const { summaryText } = await callLLMForMirror({
    insights,
    personaMeta,
    lang,
    personaSnapshot,
    identityProfile,
    personaScope: insights?.meta?.personaScope || 'persona',
  });

  const now = new Date();

  let session = null;
  try {
    session = await prisma.mirrorSession.create({
      data: {
        userId,
        personaId: String(personaId),
        generatedAt: now,
        rangeDays: insights.rangeDays,
        summaryText: summaryText || '',
        dominantTrend: insights.recentChanges?.intensityTrend || null,
      },
    });
  } catch (err) {
    console.error(
      '[Mirror] Failed to persist MirrorSession',
      err && err.message ? err.message : err
    );
  }

  try {
    await logEmotionalEvent({
      userId,
      personaId: String(personaId),
      conversationId: null,
      timestamp: now,
      dominantEmotion: (insights.topEmotions && insights.topEmotions[0]?.emotion) || 'NEUTRAL',
      intensity: insights.avgIntensity || 0,
      valence: null,
      source: 'system_event',
      eventType: 'mirror_generated',
      tags: { rangeDays: insights.rangeDays },
    });
  } catch (err) {
    console.error('[Mirror] Failed to log mirror event', err && err.message ? err.message : err);
  }

  return { summaryText, insights, session, notEnoughHistory: false };
}

module.exports = {
  generateMirrorInsights,
  callLLMForMirror,
  generateMirrorForUser,
};
