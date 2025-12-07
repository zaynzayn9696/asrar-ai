// server/src/services/mirrorService.js
// AI Mirror Mode: compute emotional patterns and ask the LLM to reflect them
// back in a gentle, non-clinical narrative.

const OpenAI = require('openai');
const prisma = require('../prisma');
const { logEmotionalEvent } = require('./timelineService');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

async function generateMirrorInsights({ userId, personaId, rangeDays }) {
  const days = parseRangeToDays(rangeDays);
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  let summaries = [];
  let events = [];

  try {
    summaries = await prisma.emotionalDailySummary.findMany({
      where: {
        userId,
        personaId: String(personaId),
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
        personaId: String(personaId),
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

  for (const s of summaries) {
    const counts = (s.emotionCounts && typeof s.emotionCounts === 'object') ? s.emotionCounts : {};
    for (const [emotion, count] of Object.entries(counts)) {
      const c = typeof count === 'number' ? count : 0;
      if (!emotionTotals[emotion]) emotionTotals[emotion] = 0;
      emotionTotals[emotion] += c;
      totalMessages += c;
      weightedIntensitySum += c * (Number(s.avgIntensity) || 0);
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
      totalDays: summaries.length,
    },
  };
}

async function callLLMForMirror({ insights, personaMeta, lang }) {
  const language = (lang || 'ar').toLowerCase();

  const isAr = language === 'ar';

  const systemPrompt = isAr
    ? 'أنت رفيق عاطفي داخل تطبيق "أسرار". وظيفتك أن تعكس للمستخدم نمط مشاعره بلطف، بدون أي لغة طبية أو تشخيصية، وبدون ذكر أمراض نفسية، وبدون إعطاء وعود بالعلاج. تحدّث كصديق مهتم من المنطقة، يستخدم لغة بسيطة ودافئة.'
    : 'You are an emotional companion inside an app called Asrar. Your job is to gently reflect emotional patterns back to the user, without using clinical or diagnostic language, without naming disorders, and without promising treatment. Speak like a caring friend from their region in simple, warm language.';

  const userContent = JSON.stringify({
    persona: personaMeta || null,
    insights,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_CORE_MODEL || 'gpt-4o-mini',
      temperature: 0.75,
      max_tokens: 450,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content:
            'حول هذا الملخص العددي إلى فقرتين أو ثلاث فقرات قصيرة تشرح للمستخدم بلطف كيف كانت أجواءه ومشاعره في الفترة الماضية، مع ملاحظات بسيطة عن الأوقات التي يكثر فيها الحديث، وأي تحسن أو ضغط واضح، ثم اختم بجملة تشجيعية لطيفة. لا تستخدم أي مصطلحات تشخيصية.' +
            '\n\nJSON:\n' +
            userContent,
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
    return { summaryText: null, insights };
  }

  const { summaryText } = await callLLMForMirror({ insights, personaMeta, lang });
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
    console.error('[Mirror] Failed to persist MirrorSession', err && err.message ? err.message : err);
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

  return { summaryText, insights, session };
}

module.exports = {
  generateMirrorInsights,
  callLLMForMirror,
  generateMirrorForUser,
};
