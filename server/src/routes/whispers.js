// server/src/routes/whispers.js
// Whispers Mode API: trust + unlocked whispers per persona.

const express = require('express');
const prisma = require('../prisma');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

function computeNextLevelThreshold(trustScore) {
  const score = typeof trustScore === 'number' ? trustScore : 0;
  if (score <= 20) return 21;
  if (score <= 50) return 51;
  if (score <= 80) return 81;
  return null;
}

router.get('/:personaId/whispers/status', async (req, res) => {
  try {
    const userId = req.user.id;
    const personaId = String(req.params.personaId || '').trim();

    if (!personaId) {
      return res.status(400).json({ message: 'personaId is required' });
    }

    let trust = null;
    try {
      trust = await prisma.userPersonaTrust.findUnique({
        where: {
          userId_personaId: {
            userId,
            personaId,
          },
        },
      });
    } catch (err) {
      console.error(
        '[Whispers][Status] Failed to load UserPersonaTrust',
        err && err.message ? err.message : err
      );
    }

    let unlocked = [];

    try {
      unlocked = await prisma.userUnlockedWhisper.findMany({
        where: {
          userId,
          personaId,
        },
        include: {
          whisper: true,
        },
        orderBy: {
          unlockedAt: 'asc',
        },
      });
    } catch (err) {
      console.error(
        '[Whispers][Status] Failed to load UserUnlockedWhisper',
        err && err.message ? err.message : err
      );
      unlocked = [];
    }

    const unlockedWhispers = (unlocked || []).map((row) => ({
      id: row.whisperId,
      title: row.whisper ? row.whisper.title : '',
      levelRequired: row.whisper ? row.whisper.levelRequired : null,
      unlockedAt: row.unlockedAt,
      shortPreview:
        row.whisper && typeof row.whisper.contentTemplate === 'string'
          ? row.whisper.contentTemplate.slice(0, 140)
          : '',
      firstRevealedAt: row.firstRevealedAt,
    }));

    const trustScore = trust ? trust.trustScore : 0;
    const trustLevel = trust ? trust.trustLevel : 0;

    const nextLevelAt = computeNextLevelThreshold(trustScore);

    const hasNewUnrevealed = unlockedWhispers.some(
      (w) => !w.firstRevealedAt
    );

    return res.json({
      personaId,
      trustScore,
      trustLevel,
      nextLevelAt,
      unlockedWhispers,
      hasNewUnrevealed,
    });
  } catch (err) {
    console.error(
      '[Whispers][Status] Unexpected error',
      err && err.message ? err.message : err
    );
    return res.status(500).json({ message: 'Failed to load whispers status' });
  }
});

module.exports = router;
