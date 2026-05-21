import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';

import { init } from './db';
import { generalLimiter } from './middleware/rateLimit';
import authRoutes from './routes/auth';
import progressRoutes from './routes/progress';
import coinsRoutes from './routes/coins';
import subscribeRoutes from './routes/subscribe';
import adminRoutes from './routes/admin';
// @ts-ignore JS routes outside rootDir
const episodeRoutes = require('../routes/episodes');
// @ts-ignore JS routes outside rootDir
const adminCmsRoutes = require('../routes/admin-cms');

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

const app = express();

// Ensure directories exist
const dataDir = path.join(__dirname, '..', 'data');
const uploadsDir = path.join(__dirname, '..', 'uploads');
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
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      console.log('HTTP server closed');
      const { db } = require('./db');
      db.close(() => {
        console.log('Database connection closed');
        process.exit(0);
      });
    });
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
