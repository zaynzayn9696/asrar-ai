require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');

const { globalLimiter, authLimiter, chatLimiter } = require('./middleware/rateLimit');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const userRoutes = require('./routes/user');
const billingRoutes = require('./routes/billing');

const app = express();
app.set("trust proxy", 1);

console.log(
  '[startup] ENV check:',
  'FRONTEND_URL set?',
  !!process.env.FRONTEND_URL,
  'JWT_SECRET set?',
  !!process.env.JWT_SECRET
);

const FRONTEND_ORIGIN = process.env.FRONTEND_URL;

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

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
app.use('/api/auth', authRoutes);

// Chat limiter for text + voice chat endpoints
app.use('/api/chat/message', chatLimiter);
app.use('/api/chat/voice', chatLimiter);
app.use('/api/chat', chatRoutes);
app.use('/api/users', userRoutes);
app.use('/api/user', userRoutes);
app.use('/api/billing', billingRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

const PORT = process.env.PORT || 4100;

console.log("[startup] JWT_SECRET set?", !!process.env.JWT_SECRET);

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
