// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../prisma');
const requireAuth = require('../middleware/requireAuth');
const { LIMITS, getPlanLimits } = require('../config/limits');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/email');

const router = express.Router();

const isRenderProd =
  process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';

const AUTH_COOKIE_NAME = 'token';

function getAuthCookieOptions() {
  if (!isRenderProd) {
    return {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
  }

  const base = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

  const domain = process.env.COOKIE_DOMAIN;
  if (domain) {
    return { ...base, domain };
  }

  return base;
}

function getAuthCookieClearOptions() {
  const { maxAge, ...rest } = getAuthCookieOptions();
  return rest;
}

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
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
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

// Mirror chat.js semantics: dailyResetAt is an unlock timestamp for the
// free-plan 24h window, not "start of today".
async function ensureUsage(userId) {
  // Make sure a Usage row exists
  let usage = await prisma.usage.findUnique({ where: { userId } });
  const now = new Date();
  if (!usage) {
    usage = await prisma.usage.create({
      data: {
        userId,
        dailyCount: 0,
        monthlyCount: 0,
        dailyResetAt: null,
        monthlyResetAt: startOfMonth(),
      },
    });
  }

  const month0 = startOfMonth();
  const needsDailyReset = !!usage.dailyResetAt && usage.dailyResetAt <= now;
  const needsMonthlyReset = !usage.monthlyResetAt || usage.monthlyResetAt < month0;

  if (needsDailyReset || needsMonthlyReset) {
    const data = {};

    if (needsDailyReset) {
      data.dailyCount = 0;
      data.dailyResetAt = null;
    }

    if (needsMonthlyReset) {
      data.monthlyCount = 0;
      data.monthlyResetAt = month0;
    }

    usage = await prisma.usage.update({
      where: { userId },
      data,
    });
  }

  return usage;
}

function buildUsageSummary(user, usage) {
  const { dailyLimit, monthlyLimit } = getPlanLimits(user.email, user.plan);
  const dailyRemaining = Math.max(0, dailyLimit - (usage?.dailyCount || 0));
  const dailyResetInSeconds = usage?.dailyResetAt ? Math.floor((usage.dailyResetAt - new Date()) / 1000) : null;
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

function getFrontendBaseUrl() {
  const fromEnv = process.env.FRONTEND_URL;
  if (fromEnv && typeof fromEnv === 'string') {
    return fromEnv;
  }
  return 'http://localhost:5173';
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

    // Minimal instrumentation of cookie settings (no secrets)
    try {
      const cookieOptions = getAuthCookieOptions();
      console.log('[auth/register] setting auth cookie', {
        cookieName: AUTH_COOKIE_NAME,
        httpOnly: !!cookieOptions.httpOnly,
        secure: !!cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        domain: cookieOptions.domain || null,
        maxAge: cookieOptions.maxAge || null,
      });
    } catch (_) {}

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

    // Minimal instrumentation of cookie settings (no secrets)
    try {
      const cookieOptions = getAuthCookieOptions();
      console.log('[auth/login] setting auth cookie', {
        cookieName: AUTH_COOKIE_NAME,
        httpOnly: !!cookieOptions.httpOnly,
        secure: !!cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        domain: cookieOptions.domain || null,
        maxAge: cookieOptions.maxAge || null,
      });
    } catch (_) {}

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

// ---------- REQUEST PASSWORD RESET ----------
router.post('/request-password-reset', async (req, res) => {
  try {
    const emailRaw = req.body && typeof req.body.email === 'string' ? req.body.email : '';
    const email = emailRaw.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ ok: false, message: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      try {
        await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      } catch (_) {}

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: tokenHash,
          expiresAt,
        },
      });

      const frontendBase = getFrontendBaseUrl();
      let resetLink = frontendBase;
      try {
        const url = new URL('/reset-password', frontendBase);
        url.searchParams.set('token', rawToken);
        resetLink = url.toString();
      } catch (_) {
        resetLink = `${frontendBase.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;
      }

      try {
        await sendPasswordResetEmail({
          to: user.email,
          resetLink,
          language: 'en',
        });
      } catch (emailErr) {
        console.error('[auth/request-password-reset] email error:', emailErr && emailErr.message ? emailErr.message : emailErr);
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[auth/request-password-reset] error:', err && err.message ? err.message : err);
    return res.status(500).json({ ok: true });
  }
});

// ---------- VALIDATE RESET TOKEN ----------
router.post('/reset-password/validate', async (req, res) => {
  try {
    const rawToken = req.body && typeof req.body.token === 'string' ? req.body.token : '';
    if (!rawToken) {
      return res.status(400).json({ ok: false, valid: false, message: 'Invalid or expired reset link.' });
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date();

    const tokenRow = await prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
    });

    if (!tokenRow || tokenRow.expiresAt <= now) {
      return res.status(200).json({ ok: false, valid: false, message: 'Invalid or expired reset link.' });
    }

    return res.json({ ok: true, valid: true });
  } catch (err) {
    console.error('[auth/reset-password/validate] error:', err && err.message ? err.message : err);
    return res.status(500).json({ ok: false, valid: false, message: 'Invalid or expired reset link.' });
  }
});

// ---------- RESET PASSWORD ----------
router.post('/reset-password', async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    let { token, password, newPassword } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    if (!password && typeof newPassword === 'string') {
      password = newPassword;
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ message: 'New password is required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date();

    const tokenRow = await prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
    });

    if (!tokenRow || tokenRow.expiresAt <= now) {
      if (tokenRow && tokenRow.expiresAt <= now) {
        try {
          await prisma.passwordResetToken.delete({ where: { id: tokenRow.id } });
        } catch (_) {}
      }
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    const user = await prisma.user.findUnique({ where: { id: tokenRow.userId } });
    if (!user) {
      try {
        await prisma.passwordResetToken.delete({ where: { id: tokenRow.id } });
      } catch (_) {}
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    const hash = await bcrypt.hash(password, 10);

    try {
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } }),
        prisma.passwordResetToken.delete({ where: { id: tokenRow.id } }),
      ]);
    } catch (txErr) {
      console.error('[auth/reset-password] transaction error:', txErr && txErr.message ? txErr.message : txErr);
      return res.status(500).json({ message: 'Failed to reset password.' });
    }

    return res.json({ ok: true, message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error('[auth/reset-password] error:', err && err.message ? err.message : err);
    return res.status(500).json({ message: 'Failed to reset password.' });
  }
});

// ---------- LOGOUT ----------
router.post('/logout', (req, res) => {
  // Clear the auth cookie with the same attributes used when setting it
  res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieClearOptions());
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

    const usageSummary = buildUsageSummary(safeUser, usage);

    // If the user has already reached their daily limit, expose reset timing
    // information so the frontend can show the same banner after a refresh.
    let dailyLimitReached = false;
    let dailyResetAt = null;
    let dailyResetInSeconds = null;

    const { dailyLimit } = getPlanLimits(safeUser.email, safeUser.plan);
    const used = usage?.dailyCount || 0;
    if (dailyLimit > 0 && used >= dailyLimit) {
      const now = new Date();
      const resetAtDate = usage.dailyResetAt
        ? new Date(usage.dailyResetAt)
        : new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const resetInSeconds = Math.max(
        0,
        Math.floor((resetAtDate.getTime() - now.getTime()) / 1000)
      );

      dailyLimitReached = true;
      dailyResetAt = resetAtDate.toISOString();
      dailyResetInSeconds = resetInSeconds;
    }

    res.json({
      user: {
        ...safeUser,
        usage: {
          ...usageSummary,
          dailyLimitReached,
          dailyResetAt,
          dailyResetInSeconds,
        },
      },
    });
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
