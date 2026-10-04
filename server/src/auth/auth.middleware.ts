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
  const baseUrl = config.BASE_URL;

  if (!origin) {
    res.status(403).json({ error: 'CSRF token missing or invalid (no origin header)' });
    return;
  }

  const normalizedOrigin = new URL(origin).origin;
  const normalizedBase = new URL(baseUrl).origin;

  if (normalizedOrigin !== normalizedBase) {
    res.status(403).json({ error: 'CSRF token missing or invalid (origin mismatch)' });
    return;
  }

  next();
}
