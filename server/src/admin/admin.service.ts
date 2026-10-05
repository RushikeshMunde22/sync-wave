import { getDb } from '../db/database.js';
import { logAudit } from './audit.service.js';
import { randomBytes } from 'crypto';
import { getLiveConnectedUsersCount } from '../sync/sync.handlers.js';

export function getDashboardStats() {
  const db = getDb();
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  const onlineUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE datetime(last_seen_at) >= datetime('now', '-5 minutes')").get() as { count: number };
  const liveSockets = getLiveConnectedUsersCount();
  const activeRooms = db.prepare('SELECT COUNT(*) as count FROM playback_state WHERE is_playing = 1').get() as { count: number };
  const totalRooms = db.prepare('SELECT COUNT(*) as count FROM groups WHERE is_closed = 0').get() as { count: number };
  const tracksToday = db.prepare("SELECT COUNT(*) as count FROM queue_items WHERE date(added_at) = date('now')").get() as { count: number };
  const signupsWeek = db.prepare("SELECT COUNT(*) as count FROM users WHERE date(created_at) >= date('now', '-7 days')").get() as { count: number };
  
  const dbSizeRow = db.prepare('PRAGMA page_count').get() as { page_count: number };
  const pageSizeRow = db.prepare('PRAGMA page_size').get() as { page_size: number };
  const dbSizeBytes = dbSizeRow.page_count * pageSizeRow.page_size;

  return {
    totalUsers: totalUsers.count,
    liveUsersCount: Math.max(liveSockets, onlineUsers.count),
    onlineUsers: onlineUsers.count,
    activeRooms: activeRooms.count,
    totalRooms: totalRooms.count,
    tracksPlayedToday: tracksToday.count,
    signupsThisWeek: signupsWeek.count,
    dbSizeBytes,
    providerHealth: { itunes: 'ok', audius: 'ok', jamendo: 'ok' }
  };
}

export function listUsers(search: string, limit: number, offset: number) {
  const db = getDb();
  let query = 'SELECT id, email, display_name as displayName, role, is_banned as isBanned, created_at as createdAt FROM users';
  let countQuery = 'SELECT COUNT(*) as count FROM users';
  const params: any[] = [];
  
  if (search) {
    const searchPattern = `%${search}%`;
    query += ' WHERE email LIKE ? OR display_name LIKE ?';
    countQuery += ' WHERE email LIKE ? OR display_name LIKE ?';
    params.push(searchPattern, searchPattern);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const data = db.prepare(query).all(...params, limit, offset);
  const total = (db.prepare(countQuery).get(...params) as any).count;
  return { users: data, total };
}

export function getUserDetails(userId: string) {
  const db = getDb();
  return db.prepare('SELECT id, email, display_name as displayName, role, is_banned as isBanned, created_at as createdAt, last_seen_at as lastSeenAt FROM users WHERE id = ?').get(userId);
}

export function banUser(actorId: string, userId: string) {
  const db = getDb();
  db.prepare('UPDATE users SET is_banned = 1 WHERE id = ?').run(userId);
  logAudit(actorId, 'user.ban', userId, {});
}

export function unbanUser(actorId: string, userId: string) {
  const db = getDb();
  db.prepare('UPDATE users SET is_banned = 0 WHERE id = ?').run(userId);
  logAudit(actorId, 'user.unban', userId, {});
}

export function promoteToSuperadmin(actorId: string, userId: string) {
  const db = getDb();
  db.prepare('UPDATE users SET role = "superadmin" WHERE id = ?').run(userId);
  logAudit(actorId, 'user.promote', userId, {});
}

export function demoteSuperadmin(actorId: string, userId: string) {
  const db = getDb();
  db.prepare('UPDATE users SET role = "user" WHERE id = ?').run(userId);
  logAudit(actorId, 'user.demote', userId, {});
}

export function forceLogout(actorId: string, userId: string) {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  logAudit(actorId, 'user.force_logout', userId, {});
}

export function deleteUser(actorId: string, userId: string) {
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  logAudit(actorId, 'user.delete', userId, {});
}

export function listGroups(search: string, limit: number, offset: number) {
  const db = getDb();
  let query = 'SELECT g.id, g.name, u.display_name as ownerName, (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as memberCount, g.created_at as createdAt FROM groups g JOIN users u ON g.owner_id = u.id';
  let countQuery = 'SELECT COUNT(*) as count FROM groups g JOIN users u ON g.owner_id = u.id';
  const params: any[] = [];
  
  if (search) {
    const searchPattern = `%${search}%`;
    query += ' WHERE g.name LIKE ?';
    countQuery += ' WHERE g.name LIKE ?';
    params.push(searchPattern);
  }
  
  query += ' ORDER BY g.created_at DESC LIMIT ? OFFSET ?';
  const data = db.prepare(query).all(...params, limit, offset);
  const total = (db.prepare(countQuery).get(...params) as any).count;
  return { groups: data, total };
}

export function getGroupDetails(groupId: string) {
  const db = getDb();
  const group = db.prepare('SELECT g.id, g.name, g.invite_code as inviteCode, g.created_at as createdAt, u.display_name as ownerName FROM groups g JOIN users u ON g.owner_id = u.id WHERE g.id = ?').get(groupId);
  if (!group) return null;
  const members = db.prepare('SELECT u.id, u.display_name as displayName, m.role FROM group_members m JOIN users u ON m.user_id = u.id WHERE m.group_id = ?').all(groupId);
  const track = db.prepare('SELECT t.title, t.artist FROM playback_state p JOIN tracks t ON p.track_id = t.id WHERE p.group_id = ?').get(groupId);
  return { ...group, members, currentTrack: track || null };
}

export function deleteGroup(actorId: string, groupId: string) {
  const db = getDb();
  db.prepare('DELETE FROM groups WHERE id = ?').run(groupId);
  logAudit(actorId, 'group.delete', groupId, {});
}

export function regenerateInviteCode(actorId: string, groupId: string) {
  // 10-char code from 32-char unambiguous alphabet = 32^10 possibilities
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(10);
  const code = Array.from(bytes).map(b => ALPHABET[b % ALPHABET.length]).join('');
  const db = getDb();
  db.prepare('UPDATE groups SET invite_code = ? WHERE id = ?').run(code, groupId);
  logAudit(actorId, 'group.regenerate_code', groupId, { code });
  return code;
}

export function listReports(status: string, limit: number, offset: number) {
  const db = getDb();
  let query = 'SELECT r.id, r.reason, r.status, r.created_at as createdAt, u.display_name as reporterName, g.name as groupName FROM reports r JOIN users u ON r.reporter_id = u.id LEFT JOIN groups g ON r.group_id = g.id';
  let countQuery = 'SELECT COUNT(*) as count FROM reports r';
  const params: any[] = [];
  
  if (status) {
    query += ' WHERE r.status = ?';
    countQuery += ' WHERE status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
  const data = db.prepare(query).all(...params, limit, offset);
  const total = (db.prepare(countQuery).get(...params) as any).count;
  return { reports: data, total };
}

export function resolveReport(actorId: string, reportId: string, status: string) {
  const db = getDb();
  db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, reportId);
  logAudit(actorId, status === 'resolved' ? 'report.resolve' : 'report.dismiss', reportId, {});
}

export function getAuditLog(filters: any, limit: number, offset: number) {
  const db = getDb();
  let query = 'SELECT a.id, a.action, a.target, a.metadata, a.created_at as createdAt, u.email as actorEmail FROM audit_log a LEFT JOIN users u ON a.actor_id = u.id';
  let countQuery = 'SELECT COUNT(*) as count FROM audit_log';
  const params: any[] = [];
  const where = [];
  
  if (filters.action) {
    where.push('a.action = ?');
    params.push(filters.action);
  }
  if (where.length > 0) {
    query += ' WHERE ' + where.join(' AND ');
    countQuery += ' WHERE ' + where.join(' AND ');
  }
  
  query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
  const data = db.prepare(query).all(...params, limit, offset);
  const total = (db.prepare(countQuery).get(...params) as any).count;
  return { logs: data.map((d: any) => ({ ...d, metadata: d.metadata ? JSON.parse(d.metadata) : null })), total };
}

export function getSystemInfo() {
  const db = getDb();
  const migrationsRow = db.prepare('SELECT id FROM _migrations ORDER BY id DESC LIMIT 1').get() as { id: number } | undefined;
  
  const dbSizeRow = db.prepare('PRAGMA page_count').get() as { page_count: number };
  const pageSizeRow = db.prepare('PRAGMA page_size').get() as { page_size: number };
  const dbSizeBytes = dbSizeRow.page_count * pageSizeRow.page_size;

  return {
    health: 'ok',
    dbSizeBytes,
    migrationVersion: migrationsRow?.id || 0,
    nodeVersion: process.version,
    uptimeSeconds: process.uptime()
  };
}

export function getAnalytics() {
  return { signupsOverTime: [], activeUsers: 0, topTracks: [] };
}

export function getFeatureFlags() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM feature_flags').all() as any[];
  const flags: Record<string, string> = {};
  rows.forEach(r => flags[r.key] = r.value);
  return flags;
}

export function updateFeatureFlags(actorId: string, flags: Record<string, string>) {
  const db = getDb();
  const updateStmt = db.prepare('INSERT INTO feature_flags (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime("now")');
  db.transaction(() => {
    for (const [key, value] of Object.entries(flags)) {
      updateStmt.run(key, String(value));
    }
  })();
  logAudit(actorId, 'system.feature_flag', 'all', flags);
}
