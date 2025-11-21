const express = require('express');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// every chat route needs login
router.use(requireAuth);

router.get('/test', (req, res) => {
  res.json({
    ok: true,
    message: 'Billing is protected and working',
    userId: req.user.id,
  });
});

module.exports = router;
