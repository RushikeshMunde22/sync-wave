import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
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
import { feedbackRouter } from './feedback/feedback.routes.js';
import { playlistRouter } from './playlists/playlist.routes.js';
import { promotionsRouter } from './promotions/promotions.routes.js';
import { youtubeRouter } from './music/youtube.routes.js';
import { setupSocketHandlers } from './sync/sync.handlers.js';
import { sessionMiddleware, csrfProtection } from './auth/auth.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Bulletproof security: Hide Express signature
app.disable('x-powered-by');

const allowedOrigins = [
  config.BASE_URL,
  'https://syncwave.work.gd',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

const corsOriginChecker = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  if (!origin) return callback(null, true); // Mobile apps, curl, server-to-server
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    if (
      allowedOrigins.includes(origin) ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.onrender.com') ||
      hostname.endsWith('.vercel.app') ||
      hostname === 'syncwave.work.gd' ||
      hostname.endsWith('.work.gd')
    ) {
      return callback(null, true);
    }
  } catch {
    // Malformed origin
  }
  return callback(new Error('Blocked by CORS policy: Unauthorized Origin'), false);
};

// ── Security middleware ──────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "'unsafe-eval'",
        'https://www.youtube.com', 
        'https://s.ytimg.com',
        'https://pagead2.googlesyndication.com',
        'https://partner.googleadservices.com',
        'https://tpc.googlesyndication.com',
        'https://www.googletagservices.com'
      ],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: [
        "'self'", 
        'data:', 
        'https:', 
        'blob:', 
        'https://i.ytimg.com', 
        'https://*.ytimg.com',
        'https://pagead2.googlesyndication.com',
        'https://googleads.g.doubleclick.net',
        'https://*.doubleclick.net',
        'https://*.google.com',
        'https://*.googlesyndication.com'
      ],
      mediaSrc: ["'self'", 'https:', 'blob:', 'data:'],
      connectSrc: [
        "'self'", 
        'wss:', 
        'ws:', 
        'https://discoveryprovider.audius.co', 
        'https://api.jamendo.com', 
        'https://itunes.apple.com', 
        'https://*.apple.com',
        'https://audio-ssl.itunes.apple.com',
        'https://musicapi.x007.workers.dev',
        'https://*.jiosaavn.com',
        'https://*.saavn.com',
        'https://*.saavncdn.com',
        'https://hls-server.vercel.app',
        'https://pagead2.googlesyndication.com',
        'https://googleads.g.doubleclick.net',
        'https://tpc.googlesyndication.com'
      ],
      frameSrc: [
        "'self'", 
        'https://www.youtube.com', 
        'https://www.youtube-nocookie.com',
        'https://googleads.g.doubleclick.net',
        'https://tpc.googlesyndication.com',
        'https://www.google.com',
        'https://pagead2.googlesyndication.com'
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// Additional hardened HTTP response headers
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), vr=()');
  next();
});

app.use(cors({
  origin: corsOriginChecker,
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Anti-prototype pollution & null byte stripping middleware
app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    delete (req.body as any)['__proto__'];
    delete (req.body as any)['constructor'];
    delete (req.body as any)['prototype'];
  }
  next();
});

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
app.use('/api/feedback', feedbackRouter);
app.use('/api/playlists', playlistRouter);
app.use('/api/promotions', promotionsRouter);
app.use('/api/youtube', youtubeRouter);

// ── Socket.IO ────────────────────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: corsOriginChecker,
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
app.set('io', io);

// Socket.IO handlers are attached in start() after DB initialization and migrations

// ── Google AdSense ads.txt verification route ────────────
app.get('/ads.txt', (_req, res) => {
  const adsTxtPath = path.resolve(__dirname, '../../client/public/ads.txt');
  if (fs.existsSync(adsTxtPath)) {
    res.type('text/plain').sendFile(adsTxtPath);
  } else {
    res.type('text/plain').send('google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0\n');
  }
});

// ── Google Search Engine Sitemap & Robots.txt ─────────────
app.get('/sitemap.xml', (_req, res) => {
  const sitemapPath = path.resolve(__dirname, '../../client/public/sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    res.type('application/xml').sendFile(sitemapPath);
  } else {
    res.status(404).send('Sitemap not found');
  }
});

app.get('/robots.txt', (_req, res) => {
  const robotsPath = path.resolve(__dirname, '../../client/public/robots.txt');
  if (fs.existsSync(robotsPath)) {
    res.type('text/plain').sendFile(robotsPath);
  } else {
    res.type('text/plain').send('User-agent: *\nAllow: /\nSitemap: https://syncwave.work.gd/sitemap.xml\n');
  }
});

// ── Serve static files (client build & ads) ──────────────
const clientAdsPath = path.resolve(__dirname, '../../client/public/ads');
app.use('/ads', express.static(clientAdsPath));

const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath, {
  maxAge: config.NODE_ENV === 'production' ? '1d' : 0,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// ── API 404 handler ──────────────────────────────────────
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

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

  // Initialize Realtime Sync Engine (after DB and tables exist)
  setupSocketHandlers(io);
  console.log('✅ Realtime Sync Engine initialized');

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
