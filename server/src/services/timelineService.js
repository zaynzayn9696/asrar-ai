// server/src/services/timelineService.js
// Emotional Timeline utilities: logging per-message events and daily summaries.

const prisma = require('../prisma');

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function clamp(num, min, max) {
  if (!Number.isFinite(num)) return min;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

const HYSTERESIS_RATIO = 1.4;
const HYSTERESIS_SHARE = 0.65;

async function logEmotionalEvent({
  userId,
  personaId,
  conversationId,
  timestamp,
  dominantEmotion,
  intensity,
  valence,
  source,
  eventType,
  tags,
}) {
  if (!userId || !personaId) return null;

  const ts = timestamp ? new Date(timestamp) : new Date();

  const data = {
    userId,
    personaId: String(personaId),
    conversationId: conversationId || null,
    timestamp: ts,
    dominantEmotion: dominantEmotion || 'NEUTRAL',
    intensity: Number.isFinite(Number(intensity)) ? Number(intensity) : 0,
    valence: Number.isFinite(Number(valence)) ? Number(valence) : null,
    source: source || 'system_event',
    eventType: eventType || 'message',
    tags: tags || null,
  };

  let event = null;
  try {
    event = await prisma.emotionalEvent.create({ data });
  } catch (err) {
    console.error('[Timeline] Failed to insert EmotionalEvent', err && err.message ? err.message : err);
    return null;
  }

  try {
    await upsertDailySummaryFromEvent(event);
  } catch (err) {
    console.error('[Timeline] Failed to upsert EmotionalDailySummary', err && err.message ? err.message : err);
  }

  return event;
}

async function upsertDailySummaryFromEvent(event) {
  const { userId, personaId, timestamp, dominantEmotion, intensity, eventType, source } = event;
  const day = startOfDay(timestamp || new Date());

  let summary = null;
  try {
    summary = await prisma.emotionalDailySummary.findUnique({
      where: {
        userId_personaId_date: {
          userId,
          personaId,
          date: day,
        },
      },
    });
  } catch (err) {
    // If the table does not exist yet (migration not applied), just skip.
    console.error('[Timeline] Failed to load EmotionalDailySummary', err && err.message ? err.message : err);
    return;
  }

  const normIntensity = clamp(Number(intensity) / 5, 0, 1);

  const isMessage = eventType === 'message';
  const isVoice = eventType === 'voice_message' || eventType === 'voice_first';
  const isWhisper = eventType === 'whisper_unlocked';
  const isMirror = eventType === 'mirror_generated';

  if (!summary) {
    const baseCounts = {};
    if (dominantEmotion) {
      baseCounts[dominantEmotion] = 1;
    }

    try {
      await prisma.emotionalDailySummary.create({
        data: {
          userId,
          personaId,
          date: day,
          topEmotion: dominantEmotion || null,
          avgIntensity: Number.isFinite(normIntensity) ? normIntensity : 0,
          emotionCounts: baseCounts,
          firstMessageAt: isMessage ? timestamp : null,
          lastMessageAt: isMessage ? timestamp : null,
          messageCount: isMessage ? 1 : 0,
          voiceMessageCount: isVoice ? 1 : 0,
          whisperUnlockCount: isWhisper ? 1 : 0,
          mirrorSessionCount: isMirror ? 1 : 0,
        },
      });
    } catch (err) {
      console.error('[Timeline] Failed to create EmotionalDailySummary', err && err.message ? err.message : err);
    }
    return;
  }

  const counts = (summary.emotionCounts && typeof summary.emotionCounts === 'object')
    ? { ...summary.emotionCounts }
    : {};

  if (dominantEmotion) {
    counts[dominantEmotion] = (counts[dominantEmotion] || 0) + 1;
  }

  // Smoothed topEmotion with hysteresis to avoid flapping on single messages.
  const weights = {};
  for (const [emotion, count] of Object.entries(counts)) {
    const key = String(emotion || '').toUpperCase();
    weights[key] = (weights[key] || 0) + (typeof count === 'number' ? count : 0);
  }
  const eventKey = String(dominantEmotion || '').toUpperCase();
  if (eventKey) {
    weights[eventKey] = (weights[eventKey] || 0) + 3; // boost latest message
  }

  const entries = Object.entries(weights).filter(([, v]) => typeof v === 'number');
  entries.sort((a, b) => b[1] - a[1]);
  const [candidate, candidateScore] = entries[0] || [summary.topEmotion, 0];
  const current = String(summary.topEmotion || '').toUpperCase() || null;
  const currentScore = current ? (weights[current] || 0) : 0;
  const total = entries.reduce((acc, [, v]) => acc + v, 0) || 1;
  const candidateShare = candidateScore / total;

  const shouldSwitch =
    !current ||
    candidate === current ||
    candidateScore >= currentScore * HYSTERESIS_RATIO ||
    candidateShare >= HYSTERESIS_SHARE;

  const topEmotion = shouldSwitch ? candidate : current || candidate;

  // Approximate total event count used for avgIntensity.
  const prevSamples = (summary.messageCount || 0) + (summary.voiceMessageCount || 0) + (summary.whisperUnlockCount || 0) + (summary.mirrorSessionCount || 0);
  const newSamples = prevSamples + 1;
  const prevAvg = Number.isFinite(Number(summary.avgIntensity)) ? Number(summary.avgIntensity) : 0;
  const nextAvg = clamp(((prevAvg * prevSamples) + (Number.isFinite(normIntensity) ? normIntensity : 0)) / newSamples, 0, 1);

  const incMessage = isMessage ? 1 : 0;
  const incVoice = isVoice ? 1 : 0;
  const incWhisper = isWhisper ? 1 : 0;
  const incMirror = isMirror ? 1 : 0;

  const data = {
    topEmotion,
    avgIntensity: nextAvg,
    emotionCounts: counts,
    messageCount: summary.messageCount + incMessage,
    voiceMessageCount: summary.voiceMessageCount + incVoice,
    whisperUnlockCount: summary.whisperUnlockCount + incWhisper,
    mirrorSessionCount: summary.mirrorSessionCount + incMirror,
  };

  if (isMessage) {
    data.lastMessageAt = timestamp;
    if (!summary.firstMessageAt && source === 'user_message') {
      data.firstMessageAt = timestamp;
    }
  }

  try {
    await prisma.emotionalDailySummary.update({
      where: {
        userId_personaId_date: {
          userId,
          personaId,
          date: day,
        },
      },
      data,
    });
  } catch (err) {
    console.error('[Timeline] Failed to update EmotionalDailySummary', err && err.message ? err.message : err);
  }
}

function parseRangeToDays(range) {
  const raw = String(range || '').trim().toLowerCase();
  if (!raw) return 30;
  if (raw === '7d') return 7;
  if (raw === '14d') return 14;
  if (raw === '30d') return 30;
  if (raw === '90d') return 90;
  const m = raw.match(/^(\d+)d$/);
  if (m) return parseInt(m[1], 10) || 30;
  return 30;
}

function dayKeyUTC(date) {
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}

function computeWeightedTopEmotion({ summary, dayEvents }) {
  const baseCounts = (summary.emotionCounts && typeof summary.emotionCounts === 'object')
    ? { ...summary.emotionCounts }
    : {};

  const weights = {};
  // Add base counts as weight 1
  for (const [emotion, count] of Object.entries(baseCounts)) {
    const key = String(emotion || '').toUpperCase();
    weights[key] = (weights[key] || 0) + (typeof count === 'number' ? count : 0);
  }

  // Recency boost: most recent events get higher weights (3x for first 10, 2x for next 10, then 1x)
  (dayEvents || []).forEach((ev, idx) => {
    const key = String(ev.dominantEmotion || ev.emotion || '').toUpperCase();
    if (!key) return;
    const w = idx < 10 ? 3 : idx < 20 ? 2 : 1;
    weights[key] = (weights[key] || 0) + w;
  });

  const entries = Object.entries(weights).filter(([, v]) => typeof v === 'number');
  if (!entries.length) return summary.topEmotion || null;

  entries.sort((a, b) => b[1] - a[1]);
  const [candidate, candidateScore] = entries[0];
  const current = String(summary.topEmotion || '').toUpperCase() || null;
  const currentScore = current ? (weights[current] || 0) : 0;
  const total = entries.reduce((acc, [, v]) => acc + v, 0) || 1;
  const candidateShare = candidateScore / total;

  // Hysteresis: switch only if candidate clearly dominates.
  const shouldSwitch =
    !current ||
    candidate === current ||
    candidateScore >= currentScore * 1.4 ||
    candidateShare >= 0.65;

  return shouldSwitch ? candidate : current || candidate;
}

async function getTimeline({ userId, personaId, range, granularity }) {
  if (!userId || !personaId) {
    return { personaId, range, points: [], keyEvents: [] };
  }

  const days = parseRangeToDays(range);
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
    console.error('[Timeline] Failed to fetch EmotionalDailySummary', err && err.message ? err.message : err);
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
    console.error('[Timeline] Failed to fetch EmotionalEvent', err && err.message ? err.message : err);
    events = [];
  }

  const eventsByDay = new Map();
  for (const ev of events) {
    const key = dayKeyUTC(ev.timestamp);
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key).push(ev);
  }

  const points = summaries.map((s) => {
    const dayKey = dayKeyUTC(s.date);
    const dayEvents = (eventsByDay.get(dayKey) || []).sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
    const messageEvents = dayEvents.filter((ev) => ev.eventType === 'message');
    const topEmotion = computeWeightedTopEmotion({ summary: s, dayEvents: messageEvents });

    return {
      date: s.date,
      topEmotion,
      avgIntensity: s.avgIntensity,
      emotionDistribution: s.emotionCounts || {},
      messageCount: s.messageCount,
      keyEvents: (eventsByDay.get(dayKey) || []).map((ev) => ({
        type: ev.eventType,
        label: ev.eventType,
        timestamp: ev.timestamp,
      })),
    };
  });

  const keyEvents = events.map((ev) => ({
    type: ev.eventType,
    timestamp: ev.timestamp,
  }));

  return {
    personaId: String(personaId),
    range: `${days}d`,
    granularity: granularity || 'daily',
    points,
    keyEvents,
  };
}

module.exports = {
  logEmotionalEvent,
  getTimeline,
};
