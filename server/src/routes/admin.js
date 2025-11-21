// server/src/routes/admin.js

const express = require('express');
const prisma = require('../prisma');
const router = express.Router();

// Manual retention endpoint
router.post('/run-retention', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deleted = await prisma.message.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo,
        },
      },
    });

    res.json({ message: 'Old messages deleted', count: deleted.count });
  } catch (err) {
    console.error('Retention error:', err);
    res.status(500).json({ message: 'Failed to run retention.' });
  }
});

module.exports = router;
