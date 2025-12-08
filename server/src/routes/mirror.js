// server/src/routes/mirror.js
// AI Mirror Mode API: generate reflective summary based on emotional history.

const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { personas, defaultPersona } = require('../config/personas');
const { generateMirrorForUser } = require('../services/mirrorService');

const router = express.Router();

router.use(requireAuth);

router.post('/:personaId', async (req, res) => {
  try {
    const userId = req.user.id;
    const personaId = String(req.params.personaId || '').trim();

    if (!personaId) {
      return res.status(400).json({ message: 'personaId is required' });
    }

    const body = req.body || {};
    const rangeInput = body.rangeDays || body.range || 30;
    // Mirror language should follow the explicit UI language sent from the client.
    // Default to English if not provided.
    const lang = body.lang || 'en';

    const personaMeta = personas[personaId] || defaultPersona;

    const result = await generateMirrorForUser({
      userId,
      personaId,
      rangeDays: rangeInput,
      personaMeta,
      lang,
    });

    return res.json({
      summaryText: result.summaryText,
      insights: result.insights,
      generatedAt: result.session ? result.session.generatedAt : null,
      rangeDays: result.insights ? result.insights.rangeDays : null,
      notEnoughHistory: !!result.notEnoughHistory,
    });
  } catch (err) {
    console.error(
      '[Mirror][Route] Unexpected error',
      err && err.message ? err.message : err
    );
    return res.status(500).json({ message: 'Failed to generate mirror summary' });
  }
});

module.exports = router;
