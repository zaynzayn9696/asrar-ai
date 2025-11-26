// server/src/services/emotionalStateMachine.js
// Phase 3 — Conversation Emotional State Machine (predictive conversation flow)
// Keeps a high-level state per conversation to stabilize tone and guide responses.

const prisma = require('../prisma');

/**
 * Maps a primary emotion to a state-machine state.
 * @param {string} label
 * @returns {string|null}
 */
function mapEmotionToState(label) {
  switch (String(label || '').toUpperCase()) {
    case 'SAD': return 'SAD_SUPPORT';
    case 'ANXIOUS': return 'ANXIETY_CALMING';
    case 'ANGRY': return 'ANGER_DEESCALATE';
    case 'LONELY': return 'LONELY_COMPANIONSHIP';
    default: return null;
  }
}

/**
 * Determines whether long-term profile suggests a hope-guidance flow.
 * @param {{scores?:{hope:number,gratitude:number,sadness:number,anxiety:number,anger:number,loneliness:number}}|null} snapshot
 */
function isHopeDominant(snapshot) {
  if (!snapshot || !snapshot.scores) return false;
  const s = snapshot.scores;
  const max = Math.max(s.hope || 0, s.gratitude || 0, s.sadness || 0, s.anxiety || 0, s.anger || 0, s.loneliness || 0);
  return (s.hope || 0) === max || (s.gratitude || 0) === max;
}

/**
 * Safely parse JSON from notes field.
 */
function parseNotes(notes) {
  if (!notes || typeof notes !== 'string') return { lowIntensityStreak: 0 };
  try { return JSON.parse(notes); } catch (_) { return { lowIntensityStreak: 0 }; }
}

/**
 * Determines the next emotional state of the conversation using Phase 1 + Phase 2 signals.
 * Prevents rapid flipping by keeping SAD_SUPPORT sticky until low intensity <2 for 3+ messages.
 * Stores a small counter in notes as JSON.
 * @param {Object} params
 * @param {number} params.conversationId
 * @param {{ primaryEmotion:string, intensity:number }} params.emotion
 * @param {{ scores?:{ hope:number, gratitude:number } }|null} params.longTermSnapshot
 */
async function updateConversationStateMachine({ conversationId, emotion, longTermSnapshot, severityLevel }) {
  try {
    if (!conversationId || !Number.isFinite(Number(conversationId))) return null;
    const cid = Number(conversationId);

    const existing = await prisma.conversationStateMachine.findUnique({ where: { conversationId: cid } });
    const notesObj = parseNotes(existing?.notes);

    // Maintain low-intensity streak counter
    const low = (emotion?.intensity || 0) < 2;
    notesObj.lowIntensityStreak = low ? (Number(notesObj.lowIntensityStreak) || 0) + 1 : 0;

    // Compute candidate state from current emotion with intensity/severity gating
    const primary = String(emotion?.primaryEmotion || '').toUpperCase();
    const intensity = Number(emotion?.intensity || 0);
    const NEGATIVE_EMOTIONS = ['SAD', 'ANXIOUS', 'ANGRY', 'LONELY'];
    const emotionState = mapEmotionToState(primary);
    const sev = String(severityLevel || 'CASUAL').toUpperCase();

    // Long-term optimism path
    const longTermHope = isHopeDominant(longTermSnapshot) ? 'HOPE_GUIDANCE' : null;

    // If low intensity sustained, go neutral regardless
    const NEUTRAL_READY = notesObj.lowIntensityStreak >= 3;

    let nextState = existing?.currentState || 'NEUTRAL';

    if (NEUTRAL_READY) {
      nextState = 'NEUTRAL';
    } else if (sev === 'CASUAL') {
      // Greetings/light chat: stay or drift to NEUTRAL
      nextState = 'NEUTRAL';
    } else if (sev === 'VENTING') {
      // Mild stress: pick light de-escalation state by emotion
      if (primary === 'ANGRY') nextState = 'ANGER_DEESCALATE';
      else if (primary === 'ANXIOUS' || primary === 'STRESSED') nextState = 'ANXIETY_CALMING';
      else if (primary === 'SAD') nextState = 'SAD_SUPPORT';
      else if (primary === 'LONELY') nextState = 'LONELY_COMPANIONSHIP';
      else nextState = 'NEUTRAL';
    } else if (sev === 'SUPPORT') {
      // Real support needed: map by emotion
      nextState = emotionState || existing?.currentState || 'NEUTRAL';
    } else if (sev === 'HIGH_RISK') {
      // Crisis-ish signals: keep or enter strongest relevant support state
      nextState = emotionState || existing?.currentState || 'SAD_SUPPORT';
    } else if ((primary === 'HOPEFUL' || primary === 'GRATEFUL') || longTermHope) {
      nextState = 'HOPE_GUIDANCE';
    } else if (longTermHope) {
      nextState = longTermHope;
    } else {
      nextState = existing?.currentState || 'NEUTRAL';
    }

    if (!existing) {
      return prisma.conversationStateMachine.create({
        data: {
          conversationId: cid,
          currentState: nextState,
          lastEmotion: (emotion?.primaryEmotion || 'NEUTRAL'),
          lastUpdatedAt: new Date(),
          notes: JSON.stringify(notesObj),
        },
      });
    }

    return prisma.conversationStateMachine.update({
      where: { conversationId: cid },
      data: {
        currentState: nextState,
        lastEmotion: (emotion?.primaryEmotion || existing.lastEmotion || 'NEUTRAL'),
        lastUpdatedAt: new Date(),
        notes: JSON.stringify(notesObj),
      },
    });
  } catch (e) {
    console.error('updateConversationStateMachine error', e && e.message ? e.message : e);
    return null;
  }
}

/**
 * Returns the high-level state object for prompt building and orchestration.
 * @param {Object} params
 * @param {number} params.conversationId
 */
async function getConversationState({ conversationId }) {
  try {
    if (!conversationId || !Number.isFinite(Number(conversationId))) {
      return { currentState: 'NEUTRAL', lastEmotion: 'NEUTRAL', lastUpdatedAt: new Date(), notes: null };
    }
    const cid = Number(conversationId);
    const row = await prisma.conversationStateMachine.findUnique({ where: { conversationId: cid } });
    return row || { currentState: 'NEUTRAL', lastEmotion: 'NEUTRAL', lastUpdatedAt: new Date(), notes: null };
  } catch (e) {
    console.error('getConversationState error', e && e.message ? e.message : e);
    return { currentState: 'NEUTRAL', lastEmotion: 'NEUTRAL', lastUpdatedAt: new Date(), notes: null };
  }
}

module.exports = {
  updateConversationStateMachine,
  getConversationState,
};
