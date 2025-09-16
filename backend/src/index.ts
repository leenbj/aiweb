import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cron from 'node-cron';

import { config } from './config';
import { errorHandler, notFound } from './middleware/error';
import { logger } from './utils/logger';
import { initDatabase, closeDatabase } from './database';
import { setupWebSocket } from './websocket';

// Routes
import authRoutes from './routes/auth';
import websiteRoutes from './routes/websites';
import aiRoutes from './routes/ai';
import aiChatRoutes from './routes/aiChat';
import deploymentRoutes from './routes/deployment';
import serverRoutes from './routes/server';
import settingsRoutes from './routes/settings';
import tokensRoutes from './routes/tokens';
import adminRoutes from './routes/admin';
import { uploadsRouter } from './routes/uploads';
import notificationsRoutes from './routes/notifications';
import templateRoutes from './routes/templates';
// import screenshotRoutes from './routes/screenshots';

// Global error handlers for unhandled promises and exceptions
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at promise: ${promise}, reason: ${reason}`);
  // In development, keep process alive for better DX
  if (config.env === 'production') {
    // Optionally exit in production to allow restart
    // process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  if (config.env === 'production') {
    // Gracefully shutdown on uncaught exceptions
    process.exit(1);
  }
});

async function startServer() {
  try {
    const app = express();
    const server = createServer(app);
  
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'", "'unsafe-eval'"], // For development
      },
    },
  }));
  
  app.use(cors({
    origin: [
      config.frontend.url,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3002',
      'http://127.0.0.1:3002'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  
  // 禁用对SSE的压缩以避免首包与分块延迟
  app.use(compression({
    filter: (req, res) => {
      const accept = req.headers['accept'] || '';
      if (typeof accept === 'string' && accept.includes('text/event-stream')) {
        return false;
      }
      // @ts-ignore: compression has default filter
      return compression.filter ? compression.filter(req, res) : true;
    }
  }));
  
  // Rate limiting (adjusted for development)
  const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP',
  });
  app.use(limiter);
  
  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
    // Initialize database with retry logic (do not crash app if DB is down in dev)
    try {
      await initDatabaseWithRetry();
    } catch (err) {
      logger.error('Database initialization failed. Continuing to start server so that frontend can load.');
    }
  
  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/websites', websiteRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/ai-chat', aiChatRoutes);
  app.use('/api/deployment', deploymentRoutes);
  app.use('/api/server', serverRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/tokens', tokensRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/templates', templateRoutes);
  
  // 预览静态站点：/preview/website/:id/* -> SITES_ROOT/:id/*
  const path = require('path');
  const fs = require('fs');
  const { ensureRelative } = require('./utils/file');
  const { config: appConfig } = require('./config');
  app.get('/preview/website/:id/*', (req, res) => {
    const id = (req.params as any).id;
    const remaining = (req.params as any)[0] || 'index.html';
    const rel = ensureRelative(remaining);
    const root = path.resolve(process.env.SITES_ROOT || appConfig.server.sitesPath || './sites');
    const filePath = path.resolve(root, id, rel);
    if (!fs.existsSync(filePath)) return res.status(404).send('Not Found');
    res.sendFile(filePath);
  });
  // Optional alias to serve uploaded files under /uploads
  app.use('/uploads', uploadsRouter);
  // app.use('/api/screenshots', screenshotRoutes);
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // Error handling
  app.use(notFound);
  app.use(errorHandler);
  
  // Setup WebSocket
  const wss = new WebSocketServer({ server });
  setupWebSocket(wss);
  
    // Start server with error handling
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.port} is already in use`);
        process.exit(1);
      } else {
        logger.error('Server error:', error);
        throw error;
      }
    });

    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.env}`);
    });
  
  // Cron jobs for server maintenance
  cron.schedule('0 */6 * * *', async () => {
    logger.info('Running scheduled SSL certificate check');
    // SSL certificate renewal check
  });
  
  cron.schedule('0 0 * * *', async () => {
    logger.info('Running daily DNS status check');
    // DNS status check
  });
  
    // Graceful shutdown handlers
    const gracefulShutdown = (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`);
      server.close(async () => {
        try {
          await closeDatabase();
          logger.info('Process terminated gracefully');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
  } catch (error) {
    logger.error('Failed to initialize server:', error);
    throw error;
  }
}

async function initDatabaseWithRetry(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await initDatabase();
      return;
    } catch (error) {
      logger.error(`Database connection attempt ${i + 1} failed:`, error);
      if (i === retries - 1) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  // In dev, avoid exiting so nodemon doesn't loop-crash
});
