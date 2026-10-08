import { Request, Response, NextFunction } from 'express';
import { validateSession, User } from './auth.service.js';
import { config } from '../config.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function sessionMiddleware(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.signedCookies['syncwave_session'];
  
  if (!sessionId) {
    return next();
  }

  try {
    const user = validateSession(sessionId);
    if (user) {
      req.user = user;
    } else {
      res.clearCookie('syncwave_session', { path: '/' });
    }
  } catch (err) {
    console.error('Session validation error:', err);
  }
  
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

export function requireRole(role: 'user' | 'superadmin') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (req.user.role !== role && req.user.role !== 'superadmin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const origin = req.headers.origin || req.headers.referer;

  if (!origin) {
    res.status(403).json({ error: 'CSRF token missing or invalid (no origin header)' });
    return;
  }

  let normalizedOrigin: string;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(origin);
    normalizedOrigin = parsedUrl.origin;
  } catch {
    res.status(403).json({ error: 'CSRF token invalid (malformed origin)' });
    return;
  }

  let normalizedBase = '';
  try {
    normalizedBase = new URL(config.BASE_URL).origin;
  } catch {}

  const allowedOrigins = [
    normalizedBase,
    'https://syncwave.work.gd',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ].filter(Boolean);

  const hostname = parsedUrl.hostname;

  // Same-origin check: compare against current server host (including reverse-proxy headers)
  const forwardedHost = req.headers['x-forwarded-host'];
  const hostHeader = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) || req.headers.host || '';
  const currentHostname = hostHeader.split(':')[0];

  const isSameHost = Boolean(currentHostname && (hostname === currentHostname));

  const isAllowed =
    isSameHost ||
    allowedOrigins.includes(normalizedOrigin) ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.onrender.com') ||
    hostname.endsWith('.vercel.app') ||
    hostname === 'syncwave.work.gd' ||
    hostname.endsWith('.work.gd') ||
    hostname.endsWith('.local');

  if (!isAllowed) {
    res.status(403).json({ error: 'CSRF token missing or invalid (origin mismatch)' });
    return;
  }

  next();
}
