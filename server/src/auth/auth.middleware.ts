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
  try {
    normalizedOrigin = new URL(origin).origin;
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

  const isAllowed =
    allowedOrigins.includes(normalizedOrigin) ||
    normalizedOrigin.endsWith('.work.gd') ||
    normalizedOrigin.endsWith('.local');

  if (!isAllowed) {
    res.status(403).json({ error: 'CSRF token missing or invalid (origin mismatch)' });
    return;
  }

  next();
}
