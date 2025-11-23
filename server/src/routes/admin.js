// server/src/routes/admin.js

const express = require('express');
const prisma = require('../prisma');
const requireAuth = require('../middleware/requireAuth');
const router = express.Router();

// Protect all admin routes
router.use(requireAuth);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const email = (req.user?.email || '').toLowerCase();
    if (email !== 'zaynzayn9696@gmail.com') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(now.getDate() - 13); // include today => 14 entries

    const [totalUsers, usersLast7DaysRaw, last14Created] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.findMany({
        where: { createdAt: { gte: fourteenDaysAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Build a date -> count map for the last 14 days
    const toDateKey = (d) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
      .toISOString().slice(0, 10);
    const counts = new Map();
    last14Created.forEach((u) => {
      const key = toDateKey(u.createdAt);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const usersByDayLast14Days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = toDateKey(d);
      usersByDayLast14Days.push({ date: key, count: counts.get(key) || 0 });
    }

    return res.json({
      totalUsers,
      usersLast7Days: usersLast7DaysRaw,
      usersByDayLast14Days,
    });
  } catch (err) {
    console.error('[admin/stats] error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

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
