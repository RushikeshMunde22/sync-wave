import argon2 from 'argon2';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarEmoji: string | null;
  avatarColor: string | null;
  role: 'user' | 'superadmin';
  isBanned: boolean;
  createdAt: string;
  lastSeenAt: string;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (err) {
    return false;
  }
}

export function checkPasswordStrength(password: string): { ok: boolean; reason?: string } {
  if (password.length < 10) return { ok: false, reason: 'Password must be at least 10 characters long' };
  if (/^(.)\1+$/.test(password)) return { ok: false, reason: 'Password cannot be all the same character' };
  const commonPatterns = ['1234567890', 'password123', 'qwertyuiop'];
  if (commonPatterns.some(p => password.toLowerCase().includes(p))) {
    return { ok: false, reason: 'Password is too common' };
  }
  return { ok: true };
}

export function generateRecoveryCode(): { code: string; hash: string } {
  const code = crypto.randomBytes(6).toString('hex');
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  return { code, hash };
}

export async function createUser(data: {
  email: string;
  password?: string;
  displayName: string;
  avatarEmoji?: string;
  avatarColor?: string;
}): Promise<{ user: User; recoveryCode?: string }> {
  const db = getDb();
  const id = uuidv4();
  const email = data.email.toLowerCase();
  
  let passwordHash = null;
  let recoveryCodePlain = undefined;
  let recoveryCodeHash = null;

  if (data.password) {
    passwordHash = await hashPassword(data.password);
    const recovery = generateRecoveryCode();
    recoveryCodePlain = recovery.code;
    recoveryCodeHash = recovery.hash;
  }

  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, email, password_hash, display_name, avatar_emoji, avatar_color, role, is_banned, recovery_code_hash, created_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    email,
    passwordHash,
    data.displayName,
    data.avatarEmoji || '🎧',
    data.avatarColor || '#6366f1',
    'user',
    0,
    recoveryCodeHash,
    now,
    now
  );

  const user = findUserById(id);
  if (!user) throw new Error('Failed to create user');
  return { user, recoveryCode: recoveryCodePlain };
}

export function findUserByEmail(email: string): User | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarEmoji: row.avatar_emoji,
    avatarColor: row.avatar_color,
    role: row.role,
    isBanned: Boolean(row.is_banned),
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

export function findUserById(id: string): User | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!row) return undefined;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarEmoji: row.avatar_emoji,
    avatarColor: row.avatar_color,
    role: row.role,
    isBanned: Boolean(row.is_banned),
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

export async function verifyLogin(email: string, password: string): Promise<User> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email) as any;
  if (!row || !row.password_hash) {
    throw new Error('Invalid email or password');
  }

  const valid = await verifyPassword(row.password_hash, password);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarEmoji: row.avatar_emoji,
    avatarColor: row.avatar_color,
    role: row.role,
    isBanned: Boolean(row.is_banned),
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

export function createSession(userId: string, userAgent?: string): string {
  const db = getDb();
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  const now = new Date().toISOString();
  const userAgentHash = userAgent ? crypto.createHash('sha256').update(userAgent).digest('hex') : null;

  db.prepare(`
    INSERT INTO sessions (id, user_id, user_agent_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, userId, userAgentHash, expiresAt, now);

  return sessionId;
}

export function validateSession(sessionId: string): User | null {
  const db = getDb();
  const now = new Date().toISOString();
  
  const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE id = ?').get(sessionId) as any;
  if (!session) return null;
  
  if (session.expires_at < now) {
    destroySession(sessionId);
    return null;
  }
  
  db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now, session.user_id);
  
  const user = findUserById(session.user_id);
  if (!user || user.isBanned) return null;
  
  return user;
}

export function destroySession(sessionId: string): void {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function destroyAllUserSessions(userId: string): void {
  getDb().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function rotateSession(oldSessionId: string, userAgent: string): string {
  const session = getDb().prepare('SELECT user_id FROM sessions WHERE id = ?').get(oldSessionId) as any;
  if (!session) {
    throw new Error('Session not found');
  }
  destroySession(oldSessionId);
  return createSession(session.user_id, userAgent);
}

export async function verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
  const db = getDb();
  const row = db.prepare('SELECT recovery_code_hash FROM users WHERE id = ?').get(userId) as any;
  if (!row || !row.recovery_code_hash) return false;
  
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  return hash === row.recovery_code_hash;
}

export async function resetPasswordWithRecovery(email: string, recoveryCode: string, newPassword: string): Promise<{ newRecoveryCode: string }> {
  const user = findUserByEmail(email);
  if (!user) throw new Error('Invalid recovery code or email');

  const valid = await verifyRecoveryCode(user.id, recoveryCode);
  if (!valid) throw new Error('Invalid recovery code or email');

  const strength = checkPasswordStrength(newPassword);
  if (!strength.ok) throw new Error(strength.reason);

  const passwordHash = await hashPassword(newPassword);
  const newRecovery = generateRecoveryCode();

  getDb().prepare(`
    UPDATE users 
    SET password_hash = ?, recovery_code_hash = ? 
    WHERE id = ?
  `).run(passwordHash, newRecovery.hash, user.id);

  destroyAllUserSessions(user.id);

  return { newRecoveryCode: newRecovery.code };
}

export async function resetPasswordByEmail(email: string): Promise<{ tempPassword: string; user: User } | null> {
  const user = findUserByEmail(email);
  if (!user) return null;

  // Generate a friendly 12-char secure alphanumeric password e.g. Sync-8a9F-2k4L
  const charset = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let tempPassword = 'Sw!';
  const bytes = crypto.randomBytes(9);
  for (let i = 0; i < 9; i++) {
    tempPassword += charset[bytes[i] % charset.length];
  }

  const passwordHash = await hashPassword(tempPassword);
  getDb().prepare(`
    UPDATE users 
    SET password_hash = ? 
    WHERE id = ?
  `).run(passwordHash, user.id);

  destroyAllUserSessions(user.id);
  return { tempPassword, user };
}

export function deleteUser(userId: string): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    // Delete any other related data here
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  })();
}

export function updateProfile(userId: string, data: Partial<{ displayName: string; avatarEmoji: string; avatarColor: string }>): void {
  const db = getDb();
  const updates: string[] = [];
  const params: any[] = [];

  if (data.displayName !== undefined) {
    updates.push('display_name = ?');
    params.push(data.displayName);
  }
  if (data.avatarEmoji !== undefined) {
    updates.push('avatar_emoji = ?');
    params.push(data.avatarEmoji);
  }
  if (data.avatarColor !== undefined) {
    updates.push('avatar_color = ?');
    params.push(data.avatarColor);
  }

  if (updates.length === 0) return;

  params.push(userId);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
}

export function cleanExpiredSessions(): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
}
