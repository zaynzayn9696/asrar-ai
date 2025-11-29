// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const requireAuth = require('../middleware/requireAuth');
const { LIMITS, getPlanLimits } = require('../config/limits');
const { sendWelcomeEmail } = require('../utils/email');

const router = express.Router();

const isRenderProd =
  process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';

function createJwtForUser(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function setTokenCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: true,          // always true in your deployed app (Render is HTTPS)
    sameSite: "none",      // required for cross-site (Vercel -> Render)
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

router.get('/debug-cookie', (req, res) => {
  res.json({
    cookies: req.cookies || null,
    hasToken: !!(req.cookies && req.cookies.token),
  });
});

// Helpers for usage
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

async function ensureUsage(userId) {
  // Make sure a Usage row exists
  let usage = await prisma.usage.findUnique({ where: { userId } });
  if (!usage) {
    usage = await prisma.usage.create({
      data: { userId, dailyCount: 0, monthlyCount: 0, dailyResetAt: startOfToday(), monthlyResetAt: startOfMonth() },
    });
  }

  // Reset windows if expired
  const today = startOfToday();
  const month0 = startOfMonth();
  const needsDailyReset = !usage.dailyResetAt || usage.dailyResetAt < today;
  const needsMonthlyReset = !usage.monthlyResetAt || usage.monthlyResetAt < month0;

  if (needsDailyReset || needsMonthlyReset) {
    usage = await prisma.usage.update({
      where: { userId },
      data: {
        dailyCount: needsDailyReset ? 0 : usage.dailyCount,
        monthlyCount: needsMonthlyReset ? 0 : usage.monthlyCount,
        dailyResetAt: needsDailyReset ? today : usage.dailyResetAt,
        monthlyResetAt: needsMonthlyReset ? month0 : usage.monthlyResetAt,
      },
    });
  }

  return usage;
}

function buildUsageSummary(user, usage) {
  const { dailyLimit, monthlyLimit } = getPlanLimits(user.email, user.plan);
  const dailyRemaining = Math.max(0, dailyLimit - (usage?.dailyCount || 0));
  const monthlyRemaining = Math.max(
    0,
    (monthlyLimit || 0) - (usage?.monthlyCount || 0)
  );
  return {
    dailyUsed: usage?.dailyCount || 0,
    dailyLimit,
    dailyRemaining,
    monthlyUsed: usage?.monthlyCount || 0,
    monthlyLimit: monthlyLimit || 0,
    monthlyRemaining,
  };
}

// ---------- REGISTER ----------
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);

    const plan = (email || '').toLowerCase() === LIMITS.PREMIUM_TESTER_EMAIL ? 'pro' : 'free';

    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        name: name,
        plan,
      },
    });

    const usage = await ensureUsage(newUser.id);

    const safeUser = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      plan: newUser.plan,
      photoUrl: newUser.photoUrl,
      createdAt: newUser.createdAt,
    };

    // Best-effort welcome email; failure must not break signup
    try {
      await sendWelcomeEmail(newUser.email, newUser.name);
    } catch (emailErr) {
      console.error('[auth/register] Welcome email error:', emailErr && emailErr.message ? emailErr.message : emailErr);
    }

    const token = createJwtForUser(safeUser);
    setTokenCookie(res, token);

    return res.status(201).json({
      message: 'Account created successfully',
      token,
      user: { ...safeUser, usage: buildUsageSummary(safeUser, usage) },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ---------- LOGIN ----------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // If premium tester logs in and plan isn't pro, set to pro
    const shouldBePro = (user.email || '').toLowerCase() === LIMITS.PREMIUM_TESTER_EMAIL;
    if (shouldBePro && user.plan !== 'pro') {
      await prisma.user.update({ where: { id: user.id }, data: { plan: 'pro' } });
      user.plan = 'pro';
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      photoUrl: user.photoUrl,
      createdAt: user.createdAt,
    };

    const usage = await ensureUsage(user.id);

    const token = createJwtForUser(safeUser);
    setTokenCookie(res, token);

    return res.json({
      message: 'Logged in successfully',
      token,
      user: { ...safeUser, usage: buildUsageSummary(safeUser, usage) },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ---------- LOGOUT ----------
router.post('/logout', (req, res) => {
  // Clear the auth cookie with the same attributes used when setting it
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  });
  res.json({ message: 'Logged out successfully' });
});

// ---------- ME ----------
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const shouldBePro = (user.email || '').toLowerCase() === LIMITS.PREMIUM_TESTER_EMAIL;
    let effectiveUser = user;
    if (shouldBePro && user.plan !== 'pro') {
      effectiveUser = await prisma.user.update({ where: { id: user.id }, data: { plan: 'pro' } });
    }

    const usage = await ensureUsage(effectiveUser.id);

    const safeUser = {
      id: effectiveUser.id,
      email: effectiveUser.email,
      name: effectiveUser.name,
      plan: effectiveUser.plan,
      photoUrl: effectiveUser.photoUrl,
      createdAt: effectiveUser.createdAt,
      saveHistoryEnabled: effectiveUser.saveHistoryEnabled,
      isPremium: !!effectiveUser.isPremium,
      lemonCustomerId: effectiveUser.lemonCustomerId || null,
      lemonSubscriptionId: effectiveUser.lemonSubscriptionId || null,
    };

    res.json({ user: { ...safeUser, usage: buildUsageSummary(safeUser, usage) } });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ---------- SAVE HISTORY ----------
router.patch('/save-history', requireAuth, async (req, res) => {
  const { saveHistoryEnabled } = req.body;

  if (typeof saveHistoryEnabled !== 'boolean') {
    return res.status(400).json({ message: 'Invalid value for saveHistoryEnabled' });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { saveHistoryEnabled },
    });

    res.json({
      message: 'Save history preference updated',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        plan: updatedUser.plan,
        saveHistoryEnabled: updatedUser.saveHistoryEnabled,
      },
    });
  } catch (err) {
    console.error('Error updating save history preference:', err);
    res.status(500).json({ message: 'Failed to update save history preference' });
  }
});

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

router.get("/google/start", (req, res) => {
  console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);
  console.log("GOOGLE_REDIRECT_URI:", process.env.GOOGLE_REDIRECT_URI);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });

  const redirectUrl = `${GOOGLE_AUTH_BASE}?${params.toString()}`;
  return res.redirect(redirectUrl);
});

router.get("/google/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send("Missing 'code' from Google.");
  }

  try {
    // 1) Exchange code -> tokens
    const tokenParams = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    });

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("Google token error:", tokenJson);
      return res.status(500).send("Failed to get tokens from Google.");
    }

    const accessToken = tokenJson.access_token;

    // 2) Get user profile from Google
    const profileRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const profile = await profileRes.json();

    if (!profile.email) {
      console.error("Google profile has no email:", profile);
      return res.status(500).send("Could not get email from Google profile.");
    }

    const email = profile.email.toLowerCase();
    const name =
      profile.name ||
      profile.given_name ||
      profile.family_name ||
      "Asrar user";

    // 3) Find or create local user
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Prisma expects passwordHash, so create a random one
      const randomPasswordHash = await bcrypt.hash(
        `google-${profile.sub || email}-${Date.now()}`,
        10
      );

      user = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash: randomPasswordHash,
          plan: email === LIMITS.PREMIUM_TESTER_EMAIL ? 'pro' : 'free',
          // If you add provider fields later:
          // provider: "google",
          // providerId: profile.sub,
        },
      });

      // Send welcome email only for newly created Google users
      try {
        await sendWelcomeEmail(user.email, user.name);
      } catch (emailErr) {
        console.error('[auth/google-callback] Welcome email error:', emailErr && emailErr.message ? emailErr.message : emailErr);
      }
    } else if (email === LIMITS.PREMIUM_TESTER_EMAIL && user.plan !== 'pro') {
      user = await prisma.user.update({ where: { id: user.id }, data: { plan: 'pro' } });
    }

    // 4) Prepare a "safe user" object like in /login
    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      createdAt: user.createdAt,
    };

    const usage = await ensureUsage(user.id);

    const token = createJwtForUser(safeUser);

    // Keep cookie for browsers that allow it
    setTokenCookie(res, token);

    const frontendBase = process.env.FRONTEND_URL;

    // Redirect to an intermediate frontend route with the token in the query string
    const redirectUrl = new URL("/google-auth-complete", frontendBase);
    redirectUrl.searchParams.set("token", token);

    console.log("[google-callback] redirecting to:", redirectUrl.toString());

    return res.redirect(redirectUrl.toString());
  } catch (err) {
    console.error("Google callback error:", err);
    return res.status(500).send("Something went wrong with Google login.");
  }
});

module.exports = router;
