import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initializeDatabase, closeDb } from './db/database.js';
import { runMigrations } from './db/migrator.js';
import { seedSuperadmin } from './db/seed.js';
import { scheduleBackups } from './db/backup.js';
import { authRouter } from './auth/auth.routes.js';
import { groupRouter } from './groups/group.routes.js';
import { musicRouter } from './music/music.routes.js';
import { adminRouter } from './admin/admin.routes.js';
import { setupSocketHandlers } from './sync/sync.handlers.js';
import { socketAuthMiddleware } from './sync/sync.middleware.js';
import { sessionMiddleware, csrfProtection } from './auth/auth.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// ── Security middleware ──────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      mediaSrc: ["'self'", 'https:', 'blob:'],
      connectSrc: ["'self'", 'wss:', 'ws:', 'https://discoveryprovider.audius.co', 'https://api.jamendo.com'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

app.use(cors({
  origin: config.BASE_URL,
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser(config.SESSION_SECRET));

// ── Rate limiting ────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', globalLimiter);

// ── Session middleware ───────────────────────────────────
app.use(sessionMiddleware);

// ── Health check (before CSRF) ───────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── CSRF protection for state-changing routes ────────────
app.use('/api/', csrfProtection);

// ── API routes ───────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/groups', groupRouter);
app.use('/api/music', musicRouter);
app.use('/api/admin', adminRouter);

// ── Socket.IO ────────────────────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.BASE_URL,
    credentials: true,
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: false,
  },
  maxHttpBufferSize: 1e6,
  pingTimeout: 20000,
  pingInterval: 25000,
});

io.use(socketAuthMiddleware);
setupSocketHandlers(io);

// ── Serve static files (client build) ────────────────────
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath, {
  maxAge: config.NODE_ENV === 'production' ? '1d' : 0,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// ── SPA fallback ─────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// ── Global error handler ─────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.message);
  if (config.NODE_ENV === 'development') {
    console.error(err.stack);
  }
  res.status(500).json({ error: 'An internal error occurred.' });
});

// ── Startup ──────────────────────────────────────────────
async function start(): Promise<void> {
  console.log('\n🌊 SyncWave starting...\n');

  // Initialize database
  initializeDatabase();
  console.log('✅ Database initialized');

  // Run migrations
  runMigrations();
  console.log('✅ Migrations applied');

  // Seed superadmin
  await seedSuperadmin();
  console.log('✅ Superadmin ready');

  // Schedule backups
  scheduleBackups();
  console.log('✅ Backup scheduler started');

  // Start server
  httpServer.listen(config.PORT, () => {
    console.log(`\n🚀 SyncWave is live at ${config.BASE_URL}`);
    console.log(`   Environment: ${config.NODE_ENV}`);
    console.log(`   Database: ${config.DATA_DIR}/syncwave.db\n`);
  });
}

// ── Graceful shutdown ────────────────────────────────────
function shutdown(signal: string): void {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  httpServer.close(() => {
    closeDb();
    console.log('👋 SyncWave stopped.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  shutdown('UNCAUGHT EXCEPTION');
});

start().catch((err) => {
  console.error('❌ Failed to start SyncWave:', err);
  process.exit(1);
});

export { app, httpServer, io };
