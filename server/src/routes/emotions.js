// server/src/routes/emotions.js
// Emotional Timeline API: chart-ready data per user/persona.

const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { getTimeline } = require('../services/timelineService');

const router = express.Router();

router.use(requireAuth);

router.get('/timeline', async (req, res) => {
  try {
    const userId = req.user.id;
    const personaIdRaw = req.query.personaId;
    const range = req.query.range || '30d';
    const granularity = req.query.granularity || 'daily';

    const personaId = personaIdRaw ? String(personaIdRaw).trim() : '';

    if (!personaId) {
      return res.status(400).json({ message: 'personaId is required' });
    }

    const data = await getTimeline({
      userId,
      personaId,
      range,
      granularity,
    });

    return res.json(data);
  } catch (err) {
    console.error(
      '[Emotions][Timeline] Unexpected error',
      err && err.message ? err.message : err
    );
    return res.status(500).json({ message: 'Failed to load emotional timeline' });
  }
});

module.exports = router;
