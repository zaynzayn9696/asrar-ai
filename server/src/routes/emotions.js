// server/src/routes/emotions.js
// Emotional Timeline API: chart-ready data per user/persona.

const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { getTimeline } = require('../services/timelineService');
const { buildMirrorSummaryForPersona, buildMirrorSummaryAcrossPersonas } = require('../services/emotionalLongTerm');

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

router.get('/mirror-summary', async (req, res) => {
  try {
    const userId = req.user.id;
    const personaIdRaw = req.query.personaId;
    const range = req.query.range || '30d';

    let summary;
    if (personaIdRaw && personaIdRaw !== 'all' && personaIdRaw !== 'global') {
      summary = await buildMirrorSummaryForPersona({
        userId,
        personaId: String(personaIdRaw).trim(),
        rangeDays: parseInt(range.replace('d', ''), 10) || 30,
      });
    } else {
      summary = await buildMirrorSummaryAcrossPersonas({
        userId,
        rangeDays: parseInt(range.replace('d', ''), 10) || 30,
      });
    }

    return res.json(summary);
  } catch (err) {
    console.error(
      '[Emotions][MirrorSummary] Unexpected error',
      err && err.message ? err.message : err
    );
    return res.status(500).json({ message: 'Failed to generate mirror summary' });
  }
});

module.exports = router;
