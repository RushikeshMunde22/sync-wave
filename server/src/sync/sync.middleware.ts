import { Socket } from 'socket.io';
import { z } from 'zod';
import cookie from 'cookie';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';

// Basic session validation mockup
export interface SessionUser {
  id: string;
  name: string;
  avatarColor: string;
  avatarEmoji: string;
}

export async function validateSession(token: string): Promise<SessionUser | null> {
  // In a real app, verify the token and return user from DB
  if (!token) return null;
  return {
    id: `user-${Math.random().toString(36).substr(2, 6)}`,
    name: 'SyncWave User',
    avatarColor: '#1DB954',
    avatarEmoji: '👋'
  };
}

export const socketAuthMiddleware = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    const rawCookies = socket.handshake.headers.cookie;
    if (!rawCookies) {
      return next(new Error('Authentication error: No cookies'));
    }

    const parsedCookies = cookie.parse(rawCookies);
    // Assuming 'session' is the name of the cookie containing the token
    const token = parsedCookies['session'];
    
    if (!token) {
      return next(new Error('Authentication error: No session token'));
    }

    const user = await validateSession(token);
    if (!user) {
      return next(new Error('Authentication error: Invalid session'));
    }

    // Attach user to socket data
    socket.data.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
};

const rateLimits = new Map<string, { count: number; resetTime: number; violations: number }>();

export const socketRateLimiter = (socket: Socket, next: (err?: Error) => void) => {
  const LIMIT = 30; // max events per second
  const WINDOW_MS = 1000;
  const MAX_VIOLATIONS = 3;

  const now = Date.now();
  let record = rateLimits.get(socket.id);

  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + WINDOW_MS, violations: record?.violations || 0 };
    rateLimits.set(socket.id, record);
    return next();
  }

  record.count++;
  
  if (record.count > LIMIT) {
    record.violations++;
    if (record.violations >= MAX_VIOLATIONS) {
      socket.disconnect(true);
      return next(new Error('Rate limit exceeded: Disconnected'));
    }
    return next(new Error('Rate limit exceeded'));
  }

  next();
};

export function validateSocketPayload<T>(schema: z.Schema<T>, payload: unknown): T {
  try {
    return schema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation Error: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}
