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
 * Looks first in UserMemoryFact(identity.name), then falls back to User.name.
 * Returns a small object or null.
 */
async function getIdentityMemory({ userId }) {
  if (!userId || !Number.isFinite(Number(userId))) {
    return null;
  }
  const uid = Number(userId);

  try {
    let result = null;

    // Prefer explicit semantic memory facts.
    try {
      const fact = await prisma.userMemoryFact.findFirst({
        where: { userId: uid, kind: 'identity.name' },
        orderBy: { updatedAt: 'desc' },
        select: { value: true, confidence: true },
      });

      if (fact && typeof fact.value === 'string' && fact.value.trim()) {
        result = {
          name: fact.value.trim(),
          kind: 'identity.name',
          confidence:
            typeof fact.confidence === 'number' && Number.isFinite(fact.confidence)
              ? fact.confidence
              : 1.0,
          source: 'UserMemoryFact',
        };
      }
    } catch (err) {
      console.error(
        '[MemoryKernel] getIdentityMemory fact query error',
        err && err.message ? err.message : err
      );
    }

    // Fallback to account-level name if no fact is present.
    if (!result) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: uid },
          select: { name: true },
        });
        if (user && typeof user.name === 'string' && user.name.trim()) {
          result = {
            name: user.name.trim(),
            kind: 'identity.name',
            confidence: 0.7,
            source: 'User.name',
          };
        }
      } catch (err) {
        console.error(
          '[MemoryKernel] getIdentityMemory user fallback error',
          err && err.message ? err.message : err
        );
      }
    }

    console.log('[MemoryKernel] getIdentityMemory', {
      userId: uid,
      hasName: !!result,
      source: result && result.source ? result.source : null,
    });

    return result;
  } catch (err) {
    console.error(
      '[MemoryKernel] getIdentityMemory error',
      err && err.message ? err.message : err
    );
    return null;
  }
}

module.exports = {
  recordEvent,
  updateShortTerm,
  updateLongTerm,
  getIdentityMemory,
};

