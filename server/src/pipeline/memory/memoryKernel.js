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

module.exports = {
  recordEvent,
  updateShortTerm,
  updateLongTerm,
};

