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

  // Recency-first: the latest event wins for today's topEmotion.
  const topEmotion = dominantEmotion || summary.topEmotion || null;

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
        eventType: {
          in: ['whisper_unlocked', 'voice_first', 'mirror_generated'],
        },
      },
      orderBy: { timestamp: 'asc' },
    });
  } catch (err) {
    console.error('[Timeline] Failed to fetch EmotionalEvent', err && err.message ? err.message : err);
    events = [];
  }

  const eventsByDay = new Map();
  for (const ev of events) {
    const d = startOfDay(ev.timestamp);
    const key = d.toISOString();
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key).push({
      type: ev.eventType,
      label: ev.eventType,
      timestamp: ev.timestamp,
    });
  }

  const points = summaries.map((s) => {
    const dayKey = startOfDay(s.date).toISOString();
    return {
      date: s.date,
      topEmotion: s.topEmotion,
      avgIntensity: s.avgIntensity,
      emotionDistribution: s.emotionCounts || {},
      messageCount: s.messageCount,
      keyEvents: eventsByDay.get(dayKey) || [],
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
