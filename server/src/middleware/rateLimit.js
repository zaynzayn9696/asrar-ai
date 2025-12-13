// server/src/middleware/rateLimit.js
// Central IP-based rate limiting for Asrar API.
// All handlers return JSON responses (no HTML) to match the rest of the API.

const rateLimit = require('express-rate-limit');

// DEV BYPASS: Completely disable rate limiting in development
// DOUBLE-GUARD: Only active when BOTH conditions are true:
// 1. NODE_ENV is explicitly 'development'
// 2. ASRAR_LOCAL_DEV is explicitly 'true' (must be set manually)
// This prevents accidental bypass if only NODE_ENV is misconfigured
const IS_DEV_BYPASS_ENABLED =
  process.env.NODE_ENV === 'development' &&
  process.env.ASRAR_LOCAL_DEV === 'true';

// Skip function for dev bypass - logs when bypass is active
const devBypassSkip = (req) => {
  if (IS_DEV_BYPASS_ENABLED) {
    const userId = req.user?.id || req.body?.email || 'anonymous';
    console.log(`[RateLimit] bypass=true user=${userId} route=${req.originalUrl}`);
    return true; // Skip rate limiting
  }
  return false; // Apply rate limiting in production
};

// Global limiter for most API routes
const globalLimiter = rateLimit({
  skip: devBypassSkip,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const resetTime = req.rateLimit?.resetTime instanceof Date
      ? req.rateLimit.resetTime.getTime()
      : req.rateLimit?.resetTime;
    const retryAfterSeconds = resetTime
      ? Math.max(1, Math.ceil((resetTime - Date.now()) / 1000))
      : 15 * 60;

    res.status(429).json({
      error: 'Too many requests, please slow down.',
      retryAfterSeconds,
    });
  },
});

// Stricter limiter for auth (login/register)
const authLimiter = rateLimit({
  skip: devBypassSkip,
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many login/register attempts. Please try again later.',
    });
  },
});

// Chat limiter for text + voice chat endpoints
const chatLimiter = rateLimit({
  skip: devBypassSkip,
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 60, // 60 chat requests per 10 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    try {
      console.error('[RateLimit] Chat', {
        ip: req.ip,
        path: req.originalUrl,
        userId: req.user && req.user.id ? req.user.id : null,
        reason: 'too_many_requests',
      });
    } catch (_) {}

    res.status(429).json({
      error: 'rate_limited',
      code: 'TOO_MANY_REQUESTS',
      message: 'You are sending messages too quickly. Please slow down.',
    });
  },
});

module.exports = { globalLimiter, authLimiter, chatLimiter };
