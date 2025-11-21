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

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
