// server/src/routes/portals.js
const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const prisma = require('../prisma');
const {
  computeReadiness,
  scoreTraits,
  buildPortalsResult,
  savePortalsResult,
  PORTAL_KEY_ORDER,
} = require('../services/portalsService');

const router = express.Router();

router.use(requireAuth);

router.get('/readiness', async (req, res) => {
  try {
    const userId = req.user.id;
    const readiness = await computeReadiness({ userId });
    return res.json(readiness);
  } catch (err) {
    console.error('[Portals][Readiness] error', err && err.message ? err.message : err);
    return res.status(500).json({ message: 'Unable to check readiness' });
  }
});

router.post('/submit', async (req, res) => {
  try {
    const userId = req.user.id;
    const bodyAnswers = req.body && req.body.answers;

    // Re-validate readiness
    const readiness = await computeReadiness({ userId });
    if (!readiness.ready) {
      return res.status(400).json({ message: 'Not enough history yet', readiness });
    }

    // Normalize answers into map by portal index (0-based)
    const answersMap = {};
    if (Array.isArray(bodyAnswers)) {
      bodyAnswers.forEach((entry) => {
        if (!entry) return;
        const idx = Number(entry.portalId) - 1;
        if (idx >= 0 && idx < PORTAL_KEY_ORDER.length) {
          answersMap[idx] = entry.optionId;
        }
      });
    } else if (bodyAnswers && typeof bodyAnswers === 'object') {
      Object.entries(bodyAnswers).forEach(([k, v]) => {
        const idx = Number(k);
        if (!Number.isNaN(idx) && idx >= 0 && idx < PORTAL_KEY_ORDER.length) {
          answersMap[idx] = v;
        }
      });
    }

    if (Object.keys(answersMap).length < PORTAL_KEY_ORDER.length) {
      return res.status(400).json({ message: 'Incomplete answers' });
    }

    const traits = scoreTraits(answersMap);
    const result = await buildPortalsResult({ userId, traits });
    await savePortalsResult({ userId, result });

    try {
      await prisma.emotionalEvent.create({
        data: {
          userId,
          personaId: null,
          eventType: 'portals_taken',
          timestamp: new Date(),
        },
      });
    } catch (_) {}

    return res.json(result);
  } catch (err) {
    console.error('[Portals][Submit] error', err && err.message ? err.message : err);
    return res.status(500).json({ message: 'Failed to process portals test' });
  }
});

module.exports = router;
