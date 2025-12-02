// server/src/routes/admin.js

const express = require('express');
const prisma = require('../prisma');
const { getPlanLimits } = require('../config/limits');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const { isAdminEmail } = require('../middleware/requireAdmin');
const router = express.Router();

// Protect all admin routes
router.use(requireAuth);
router.use(requireAdmin);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const email = (req.user?.email || '').toLowerCase();
    if (!isAdminEmail(email)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(now.getDate() - 13); // include today => 14 entries

    const [totalUsers, usersLast7DaysRaw, last14Created, premiumUsersCount, recentUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.findMany({
        where: { createdAt: { gte: fourteenDaysAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.user.count({ where: { isPremium: true } }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500,
        include: { usage: true },
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

    // Map recent users to a compact shape with usage
    const users = recentUsers.map((u) => {
      const { dailyLimit, monthlyLimit } = getPlanLimits(u.email, u.plan);
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        plan: u.plan,
        isPremium: !!u.isPremium,
        createdAt: u.createdAt,
        lastLoginAt: null,
        dailyUsed: u.usage ? u.usage.dailyCount : 0,
        dailyLimit,
        monthlyUsed: u.usage ? u.usage.monthlyCount : 0,
        monthlyLimit: monthlyLimit || 0,
      };
    });

    const premiumUsers = premiumUsersCount;
    const freeUsers = totalUsers - premiumUsersCount;
    const estimatedMrr = Number((premiumUsers * 4.99).toFixed(2));

    return res.json({
      // new simplified fields
      totalUsers,
      premiumUsers,
      freeUsers,
      estimatedMrr,
      users,
      // legacy fields preserved (for backward compatibility if any other UI reads them)
      usersLast7Days: usersLast7DaysRaw,
      usersByDayLast14Days,
      premiumUsersCount,
      totalPremiumUsers: premiumUsersCount,
      totalFreeUsers: freeUsers,
      last7DaysUsers: usersLast7DaysRaw,
      signupsByDay: usersByDayLast14Days,
    });
  } catch (err) {
    console.error('[admin/stats] error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/users?q=search
router.get('/users', async (req, res) => {
  try {
    const email = (req.user?.email || '').toLowerCase();
    if (!isAdminEmail(email)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const q = (req.query.q || '').toString().trim();
    const where = q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        isPremium: true,
        createdAt: true,
        saveHistoryEnabled: true,
        photoUrl: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.json({ users });
  } catch (err) {
    console.error('[admin/users] error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/user/:id
router.get('/user/:id', async (req, res) => {
  try {
    const email = (req.user?.email || '').toLowerCase();
    if (!isAdminEmail(email)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        isPremium: true,
        createdAt: true,
        saveHistoryEnabled: true,
        photoUrl: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'Not found' });
    return res.json({ user });
  } catch (err) {
    console.error('[admin/user/:id] error', err && err.message ? err.message : err);
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
