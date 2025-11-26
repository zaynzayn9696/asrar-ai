// server/src/middleware/rateLimit.js
// Central IP-based rate limiting for Asrar API.
// All handlers return JSON responses (no HTML) to match the rest of the API.

const rateLimit = require('express-rate-limit');

// Global limiter for most API routes
const globalLimiter = rateLimit({
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
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 60, // 60 chat requests per 10 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'You are sending messages too quickly. Please slow down.',
    });
  },
});

module.exports = { globalLimiter, authLimiter, chatLimiter };
