require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const { init } = require('./db');
const { generalLimiter } = require('./middleware/rateLimit');
const authRoutes = require('./routes/auth');
const progressRoutes = require('./routes/progress');
const coinsRoutes = require('./routes/coins');
const subscribeRoutes = require('./routes/subscribe');
const adminRoutes = require('./routes/admin');
const episodeRoutes = require('./routes/episodes');
const adminCmsRoutes = require('./routes/admin-cms');

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

const app = express();

// Ensure directories exist
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:8080', 'http://127.0.0.1:8080'],
  credentials: true
}));
app.use(generalLimiter);
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/coins', coinsRoutes);
app.use('/api/subscribe', subscribeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/episodes', episodeRoutes);
app.use('/api/admin', adminCmsRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await init();
  const server = app.listen(PORT, () => {
    console.log('Superglazka server running on port ' + PORT);
    console.log('Frontend allowed: ' + FRONTEND_URL);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      console.log('HTTP server closed');
      require('./db').db.close(() => {
        console.log('Database connection closed');
        process.exit(0);
      });
    });
    // Force exit after 10s
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
