require('dotenv').config();
const crypto = require('crypto');

// After app is created, before app.listen:
console.log('[startup] DATABASE_URL hash =', crypto
  .createHash('md5')
  .update(process.env.DATABASE_URL || '')
  .digest('hex')
);
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const requestMetadata = require('./middleware/requestMetadata');

const { globalLimiter, authLimiter, chatLimiter } = require('./middleware/rateLimit');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const userRoutes = require('./routes/user');
const billingRoutes = require('./routes/billing');
const adminRoutes = require('./routes/admin');
const whispersRoutes = require('./routes/whispers');
const emotionsRoutes = require('./routes/emotions');
const mirrorRoutes = require('./routes/mirror');
const portalsRoutes = require('./routes/portals');

const app = express();
app.set("trust proxy", 1);

console.log(
  '[startup] ENV check:',
  'FRONTEND_URL set?',
  !!process.env.FRONTEND_URL,
  'JWT_SECRET set?',
  !!process.env.JWT_SECRET
);

const FRONTEND_URL = process.env.FRONTEND_URL;
const allowedOrigins = [
  "https://asrarai.com",
  "https://www.asrarai.com",
  "https://asrar-ai.vercel.app",
  "https://staging.asrarai.com",
  "http://localhost:5173",
];

if (FRONTEND_URL && !allowedOrigins.includes(FRONTEND_URL)) {
  allowedOrigins.push(FRONTEND_URL);
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow no-origin requests (like curl/postman) and allowed browser origins
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.warn("[CORS] Blocked origin:", origin);
      // For unknown origins, deny without throwing to avoid crashing the request pipeline.
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json({
  verify: (req, res, buf) => {
    try {
      if (req.originalUrl === '/api/billing/webhook') {
        req.rawBody = buf.toString('utf8');
      }
    } catch (_) {}
  },
}));

app.use(cookieParser());
app.use(morgan('dev'));
app.use(requestMetadata);

// Global rate limit for all API routes
app.use('/api', globalLimiter);

// serve uploaded files
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Stricter limiter for auth endpoints
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/request-password-reset', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth', authRoutes);

// Chat limiter for text + voice chat endpoints
app.use('/api/chat/message', chatLimiter);
app.use('/api/chat/voice', chatLimiter);
app.use('/api/chat', chatRoutes);
app.use('/api/users', userRoutes);
app.use('/api/user', userRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);

// NOTE: Dev-only memory clear endpoint REMOVED for production safety.
// Use admin panel or direct DB access for testing if needed.

app.use('/api/personas', whispersRoutes);
app.use('/api/emotions', emotionsRoutes);
app.use('/api/mirror', mirrorRoutes);
app.use('/api/portals', portalsRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

const PORT = process.env.PORT || 4100;

console.log("[startup] JWT_SECRET set?", !!process.env.JWT_SECRET);

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
