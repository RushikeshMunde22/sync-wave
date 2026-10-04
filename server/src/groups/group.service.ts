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

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const generateInviteCode = (): string => {
  let code = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      code += INVITE_ALPHABET[byte % INVITE_ALPHABET.length];
    }
  }
  return code;
};

export const createGroup = async (ownerId: string, name: string): Promise<Group> => {
  const db = getDb();
  const groupId = uuidv4();
  const inviteCode = generateInviteCode();
  
  db.transaction(() => {
    db.prepare(`
      INSERT INTO groups (id, name, owner_id, invite_code, invite_revoked, members_can_control, max_members, is_closed) 
      VALUES (?, ?, ?, ?, 0, 0, 50, 0)
    `).run(groupId, name, ownerId, inviteCode);

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
  const row = db.prepare(`
    SELECT * FROM groups 
    WHERE invite_code = ? 
      AND invite_revoked = 0 
      AND is_closed = 0 
      AND (invite_expires_at IS NULL OR datetime(invite_expires_at) > datetime('now'))
  `).get(code);
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

export const joinGroup = async (userId: string, code: string): Promise<{ group?: Group; error?: string }> => {
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

  const isMember = await isGroupMember(userId, group.id);
  if (isMember) {
    return { error: 'Already a member of this group' };
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
  
  db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, targetId);
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

function mapGroupDbToModel(row: any): Group {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    inviteCode: row.invite_code,
    inviteExpiresAt: row.invite_expires_at,
    inviteRevoked: Boolean(row.invite_revoked),
    membersCanControl: Boolean(row.members_can_control),
    maxMembers: Number(row.max_members),
    isClosed: Boolean(row.is_closed),
    createdAt: row.created_at
  };
}
