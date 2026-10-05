import crypto from 'crypto';
import { getDb } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  inviteExpiresAt: string | null;
  inviteRevoked: boolean;
  membersCanControl: boolean;
  maxMembers: number;
  theme: string;
  isClosed: boolean;
  createdAt: string;
}

export interface GroupMember {
  userId: string;
  displayName: string;
  avatarEmoji: string;
  avatarColor: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

export interface GroupWithMeta extends Group {
  memberCount: number;
  currentTrackTitle?: string;
  isPlaying?: boolean;
  myRole: 'owner' | 'admin' | 'member';
}

// 10-character invite codes from a 32-char unambiguous alphabet
// Gives 32^10 = 1.1 quadrillion unique combinations — zero shortage risk
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 10;

export const generateInviteCode = (): string => {
  let code = '';
  // Use 10 cryptographically random bytes, one per character
  const bytes = crypto.randomBytes(INVITE_CODE_LENGTH);
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      // Modulo bias is negligible: 256 / 32 = exactly 8, no bias
      code += INVITE_ALPHABET[byte % INVITE_ALPHABET.length];
    }
  }
  return code;
};

export const createGroup = async (
  ownerId: string, 
  name: string, 
  options?: { maxMembers?: number; theme?: string }
): Promise<Group> => {
  const db = getDb();
  const groupId = uuidv4();
  const inviteCode = generateInviteCode();
  const maxMembers = options?.maxMembers || 50;
  const theme = options?.theme || 'default';
  
  db.transaction(() => {
    db.prepare(`
      INSERT INTO groups (id, name, owner_id, invite_code, invite_revoked, members_can_control, max_members, theme, is_closed) 
      VALUES (?, ?, ?, ?, 0, 0, ?, ?, 0)
    `).run(groupId, name, ownerId, inviteCode, maxMembers, theme);

    db.prepare(`
      INSERT INTO group_members (group_id, user_id, role)
      VALUES (?, ?, 'owner')
    `).run(groupId, ownerId);

    db.prepare(`
      INSERT INTO playback_state (group_id, is_playing, position_ms, updated_at_server_ms, version)
      VALUES (?, 0, 0, ?, 0)
    `).run(groupId, Date.now());
  })();

  const row = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
  return mapGroupDbToModel(row);
};

export const getGroup = async (groupId: string): Promise<Group | null> => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
  if (!row) return null;
  return mapGroupDbToModel(row);
};

export const getGroupByInviteCode = async (code: string): Promise<Group | null> => {
  const db = getDb();
  let row = db.prepare(`
    SELECT * FROM groups 
    WHERE invite_code = ? 
      AND invite_revoked = 0 
      AND is_closed = 0 
      AND (invite_expires_at IS NULL OR datetime(invite_expires_at) > datetime('now'))
  `).get(code);

  // Fallback: If not found by invite_code, check if code is a groupId (UUID)
  if (!row) {
    row = db.prepare(`
      SELECT * FROM groups 
      WHERE id = ? 
        AND is_closed = 0
    `).get(code);
  }

  if (!row) return null;
  return mapGroupDbToModel(row);
};

export const getUserGroups = async (userId: string): Promise<GroupWithMeta[]> => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT 
      g.*, 
      gm.role as my_role,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
      t.title as current_track_title,
      ps.is_playing
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    LEFT JOIN playback_state ps ON g.id = ps.group_id
    LEFT JOIN tracks t ON ps.track_id = t.id
    WHERE gm.user_id = ?
    ORDER BY g.created_at DESC
  `).all(userId) as any[];

  return rows.map(row => ({
    ...mapGroupDbToModel(row),
    memberCount: Number(row.member_count) || 1,
    currentTrackTitle: row.current_track_title || undefined,
    isPlaying: Boolean(row.is_playing),
    myRole: row.my_role
  }));
};

export const joinGroup = async (
  userId: string,
  code: string,
): Promise<{ group?: Group; error?: string; requiresApproval?: boolean }> => {
  const db = getDb();
  const group = await getGroupByInviteCode(code);
  
  if (!group) {
    return { error: 'Invalid or expired invite code' };
  }
  if (group.isClosed) {
    return { error: 'Group is closed' };
  }

  // Check if user is banned globally
  const user = db.prepare('SELECT is_banned FROM users WHERE id = ?').get(userId) as { is_banned: number } | undefined;
  if (user?.is_banned) {
    return { error: 'Your account is banned' };
  }

  // Check if user was previously kicked
  const kicked = db.prepare('SELECT 1 FROM group_kicked_users WHERE group_id = ? AND user_id = ?').get(group.id, userId);
  if (kicked) {
    const existingReq = db.prepare('SELECT id, status FROM group_join_requests WHERE group_id = ? AND user_id = ?').get(group.id, userId) as any;
    if (!existingReq || existingReq.status === 'denied') {
      const requestId = uuidv4();
      db.prepare(`
        INSERT OR REPLACE INTO group_join_requests (id, group_id, user_id, status, created_at)
        VALUES (?, ?, ?, 'pending', ?)
      `).run(requestId, group.id, userId, new Date().toISOString());
      return { 
        error: 'You were previously removed from this room. A join request has been sent to room moderators.', 
        requiresApproval: true 
      };
    } else if (existingReq.status === 'pending') {
      return { 
        error: 'Your request to join this room is currently pending approval from room moderators.', 
        requiresApproval: true 
      };
    }
    // If approved, clear kick and request records
    db.prepare('DELETE FROM group_kicked_users WHERE group_id = ? AND user_id = ?').run(group.id, userId);
    db.prepare('DELETE FROM group_join_requests WHERE group_id = ? AND user_id = ?').run(group.id, userId);
  }

  // If already a member, return group successfully (not an error!)
  const isMember = await isGroupMember(userId, group.id);
  if (isMember) {
    return { group };
  }

  const countRow = db.prepare('SELECT COUNT(*) as count FROM group_members WHERE group_id = ?').get(group.id) as { count: number };
  if (countRow.count >= group.maxMembers) {
    return { error: 'Group is full' };
  }

  db.prepare(`
    INSERT INTO group_members (group_id, user_id, role)
    VALUES (?, ?, 'member')
  `).run(group.id, userId);

  return { group };
};

export const leaveGroup = async (userId: string, groupId: string): Promise<void> => {
  const db = getDb();
  const role = await getMemberRole(userId, groupId);
  if (!role) return;

  if (role === 'owner') {
    // Promote longest-serving admin, then longest-serving member
    const nextAdmin = db.prepare(`
      SELECT user_id FROM group_members 
      WHERE group_id = ? AND role = 'admin' AND user_id != ?
      ORDER BY joined_at ASC LIMIT 1
    `).get(groupId, userId) as { user_id: string } | undefined;

    let newOwnerId = nextAdmin?.user_id;

    if (!newOwnerId) {
      const nextMember = db.prepare(`
        SELECT user_id FROM group_members 
        WHERE group_id = ? AND role = 'member' AND user_id != ?
        ORDER BY joined_at ASC LIMIT 1
      `).get(groupId, userId) as { user_id: string } | undefined;
      newOwnerId = nextMember?.user_id;
    }

    if (newOwnerId) {
      await transferOwnership(userId, newOwnerId, groupId);
    } else {
      await closeGroup(userId, groupId);
    }
  }

  db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, userId);
};

export const kickMember = async (actorId: string, targetId: string, groupId: string): Promise<void> => {
  const db = getDb();
  const actorRole = await getMemberRole(actorId, groupId);
  const targetRole = await getMemberRole(targetId, groupId);

  if (!actorRole || !targetRole) throw new Error('Member not found');
  if (actorRole === 'member') throw new Error('Unauthorized');
  if (targetRole === 'owner') throw new Error('Cannot kick owner');
  
  db.transaction(() => {
    db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, targetId);
    db.prepare(`
      INSERT OR REPLACE INTO group_kicked_users (group_id, user_id, kicked_by, kicked_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(groupId, targetId, actorId);
  })();
};

export const promoteMember = async (actorId: string, targetId: string, groupId: string): Promise<void> => {
  const db = getDb();
  const actorRole = await getMemberRole(actorId, groupId);
  if (actorRole !== 'owner' && actorRole !== 'admin') throw new Error('Unauthorized');

  const targetRole = await getMemberRole(targetId, groupId);
  if (targetRole === 'member') {
    db.prepare("UPDATE group_members SET role = 'admin' WHERE group_id = ? AND user_id = ?").run(groupId, targetId);
  }
};

export const demoteMember = async (actorId: string, targetId: string, groupId: string): Promise<void> => {
  const db = getDb();
  const actorRole = await getMemberRole(actorId, groupId);
  if (actorRole !== 'owner') throw new Error('Unauthorized');

  const targetRole = await getMemberRole(targetId, groupId);
  if (targetRole === 'admin') {
    db.prepare("UPDATE group_members SET role = 'member' WHERE group_id = ? AND user_id = ?").run(groupId, targetId);
  }
};

export const transferOwnership = async (ownerId: string, targetId: string, groupId: string): Promise<void> => {
  const db = getDb();
  const ownerRole = await getMemberRole(ownerId, groupId);
  if (ownerRole !== 'owner') throw new Error('Unauthorized');

  const targetRole = await getMemberRole(targetId, groupId);
  if (!targetRole) throw new Error('Target is not a member');

  db.transaction(() => {
    db.prepare("UPDATE group_members SET role = 'admin' WHERE group_id = ? AND user_id = ?").run(groupId, ownerId);
    db.prepare("UPDATE group_members SET role = 'owner' WHERE group_id = ? AND user_id = ?").run(groupId, targetId);
    db.prepare('UPDATE groups SET owner_id = ? WHERE id = ?').run(targetId, groupId);
  })();
};

export const regenerateInviteCode = async (actorId: string, groupId: string, expiresInHours?: number): Promise<string> => {
  const db = getDb();
  const actorRole = await getMemberRole(actorId, groupId);
  if (actorRole !== 'owner' && actorRole !== 'admin') throw new Error('Unauthorized');

  const newCode = generateInviteCode();
  const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 3600000).toISOString() : null;

  db.prepare(`
    UPDATE groups 
    SET invite_code = ?, invite_expires_at = ?, invite_revoked = 0 
    WHERE id = ?
  `).run(newCode, expiresAt, groupId);

  return newCode;
};

export const revokeInviteCode = async (actorId: string, groupId: string): Promise<void> => {
  const db = getDb();
  const actorRole = await getMemberRole(actorId, groupId);
  if (actorRole !== 'owner' && actorRole !== 'admin') throw new Error('Unauthorized');

  db.prepare('UPDATE groups SET invite_revoked = 1 WHERE id = ?').run(groupId);
};

export const updateGroupSettings = async (
  actorId: string, 
  groupId: string, 
  settings: Partial<Pick<Group, 'name' | 'membersCanControl' | 'maxMembers'>>
): Promise<void> => {
  const db = getDb();
  const actorRole = await getMemberRole(actorId, groupId);
  if (actorRole !== 'owner' && actorRole !== 'admin') throw new Error('Unauthorized');

  const updates: string[] = [];
  const values: any[] = [];

  if (settings.name !== undefined) {
    updates.push('name = ?');
    values.push(settings.name);
  }
  if (settings.membersCanControl !== undefined) {
    updates.push('members_can_control = ?');
    values.push(settings.membersCanControl ? 1 : 0);
  }
  if (settings.maxMembers !== undefined) {
    updates.push('max_members = ?');
    values.push(settings.maxMembers);
  }

  if (updates.length > 0) {
    values.push(groupId);
    db.prepare(`UPDATE groups SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
};

export const closeGroup = async (actorId: string, groupId: string): Promise<void> => {
  const db = getDb();
  const actorRole = await getMemberRole(actorId, groupId);
  if (actorRole !== 'owner') throw new Error('Unauthorized');

  db.prepare('UPDATE groups SET is_closed = 1 WHERE id = ?').run(groupId);
};

export const deleteGroup = async (actorId: string, groupId: string): Promise<void> => {
  const db = getDb();
  const actorRole = await getMemberRole(actorId, groupId);
  if (actorRole !== 'owner') throw new Error('Unauthorized');

  db.prepare('DELETE FROM groups WHERE id = ?').run(groupId);
};

export const getGroupMembers = async (groupId: string): Promise<GroupMember[]> => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT gm.user_id, gm.role, gm.joined_at, u.display_name, u.avatar_emoji, u.avatar_color
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ?
    ORDER BY gm.joined_at ASC
  `).all(groupId) as any[];

  return rows.map((row: any) => ({
    userId: row.user_id,
    displayName: row.display_name,
    avatarEmoji: row.avatar_emoji,
    avatarColor: row.avatar_color,
    role: row.role,
    joinedAt: row.joined_at
  }));
};

export const getMemberRole = async (userId: string, groupId: string): Promise<'owner' | 'admin' | 'member' | null> => {
  const db = getDb();
  const row = db.prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId) as { role: 'owner' | 'admin' | 'member' } | undefined;
  return row ? row.role : null;
};

export const isGroupMember = async (userId: string, groupId: string): Promise<boolean> => {
  const role = await getMemberRole(userId, groupId);
  return role !== null;
};

export const getPendingJoinRequests = async (actorId: string, groupId: string) => {
  const role = await getMemberRole(actorId, groupId);
  if (role !== 'owner' && role !== 'admin') throw new Error('Unauthorized');

  const db = getDb();
  return db.prepare(`
    SELECT r.id, r.user_id as userId, r.status, r.created_at as createdAt,
           u.display_name as displayName, u.avatar_emoji as avatarEmoji, u.avatar_color as avatarColor
    FROM group_join_requests r
    JOIN users u ON r.user_id = u.id
    WHERE r.group_id = ? AND r.status = 'pending'
    ORDER BY r.created_at ASC
  `).all(groupId);
};

export const handleJoinRequest = async (actorId: string, groupId: string, requestId: string, approve: boolean) => {
  const role = await getMemberRole(actorId, groupId);
  if (role !== 'owner' && role !== 'admin') throw new Error('Unauthorized');

  const db = getDb();
  const request = db.prepare('SELECT * FROM group_join_requests WHERE id = ? AND group_id = ?').get(requestId, groupId) as any;
  if (!request) throw new Error('Request not found');

  if (approve) {
    db.transaction(() => {
      db.prepare("UPDATE group_join_requests SET status = 'approved' WHERE id = ?").run(requestId);
      db.prepare('DELETE FROM group_kicked_users WHERE group_id = ? AND user_id = ?').run(groupId, request.user_id);
      db.prepare(`
        INSERT OR IGNORE INTO group_members (group_id, user_id, role)
        VALUES (?, ?, 'member')
      `).run(groupId, request.user_id);
    })();
  } else {
    db.prepare("UPDATE group_join_requests SET status = 'denied' WHERE id = ?").run(requestId);
  }
};

export const importPlaylistToQueue = async (actorId: string, groupId: string, playlistId: string): Promise<number> => {
  const db = getDb();
  const role = await getMemberRole(actorId, groupId);
  const group = await getGroup(groupId);
  if (!role || (!group?.membersCanControl && role !== 'owner' && role !== 'admin')) {
    throw new Error('You do not have permission to modify the queue in this room');
  }

  const tracks = db.prepare(`
    SELECT pt.track_id as trackId, pt.position
    FROM user_playlist_tracks pt
    JOIN user_playlists p ON pt.playlist_id = p.id
    WHERE pt.playlist_id = ? AND p.user_id = ?
    ORDER BY pt.position ASC
  `).all(playlistId, actorId) as { trackId: string; position: number }[];

  if (tracks.length === 0) return 0;

  const maxPosRow = db.prepare('SELECT COALESCE(MAX(position), 0) as max_pos FROM queue_items WHERE group_id = ?').get(groupId) as { max_pos: number };
  let nextPos = maxPosRow.max_pos + 1;

  db.transaction(() => {
    const insertStmt = db.prepare(`
      INSERT INTO queue_items (id, group_id, track_id, added_by, position)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const t of tracks) {
      insertStmt.run(uuidv4(), groupId, t.trackId, actorId, nextPos++);
    }
  })();

  return tracks.length;
};

function mapGroupDbToModel(row: any): Group {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    inviteCode: row.invite_code,
    inviteExpiresAt: row.invite_expires_at,
    inviteRevoked: Boolean(row.invite_revoked),
    membersCanControl: Boolean(row.members_can_control),
    maxMembers: Number(row.max_members) || 50,
    theme: row.theme || 'default',
    isClosed: Boolean(row.is_closed),
    createdAt: row.created_at
  };
}
