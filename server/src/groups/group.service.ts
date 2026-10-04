import crypto from 'crypto';
import db from '../db/database.js';
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
    code += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return code;
};

export const createGroup = async (ownerId: string, name: string): Promise<Group> => {
  const groupId = uuidv4();
  const inviteCode = generateInviteCode();
  
  await db.query(
    `INSERT INTO groups (id, name, owner_id, invite_code, invite_revoked, members_can_control, max_members, is_closed) 
     VALUES ($1, $2, $3, $4, false, true, 50, false)`,
    [groupId, name, ownerId, inviteCode]
  );

  await db.query(
    `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [groupId, ownerId]
  );

  await db.query(
    `INSERT INTO playback_state (group_id) VALUES ($1)`,
    [groupId]
  );

  const result = await db.query(`SELECT * FROM groups WHERE id = $1`, [groupId]);
  return mapGroupDbToModel(result.rows[0]);
};

export const getGroup = async (groupId: string): Promise<Group | null> => {
  const result = await db.query(`SELECT * FROM groups WHERE id = $1`, [groupId]);
  if (!result.rows.length) return null;
  return mapGroupDbToModel(result.rows[0]);
};

export const getGroupByInviteCode = async (code: string): Promise<Group | null> => {
  const result = await db.query(`
    SELECT * FROM groups 
    WHERE invite_code = $1 
      AND invite_revoked = false 
      AND is_closed = false 
      AND (invite_expires_at IS NULL OR invite_expires_at > NOW())
  `, [code]);
  if (!result.rows.length) return null;
  return mapGroupDbToModel(result.rows[0]);
};

export const getUserGroups = async (userId: string): Promise<GroupWithMeta[]> => {
  const result = await db.query(`
    SELECT 
      g.*, 
      gm.role as my_role,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
      ps.current_track_title,
      ps.is_playing
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    LEFT JOIN playback_state ps ON g.id = ps.group_id
    WHERE gm.user_id = $1
  `, [userId]);

  return result.rows.map(row => ({
    ...mapGroupDbToModel(row),
    memberCount: parseInt(row.member_count),
    currentTrackTitle: row.current_track_title || undefined,
    isPlaying: row.is_playing,
    myRole: row.my_role
  }));
};

export const joinGroup = async (userId: string, code: string): Promise<{ group?: Group; error?: string }> => {
  const group = await getGroupByInviteCode(code);
  
  if (!group) {
    return { error: 'Invalid or expired invite code' };
  }
  if (group.isClosed) {
    return { error: 'Group is closed' };
  }

  const isMember = await isGroupMember(userId, group.id);
  if (isMember) {
    return { error: 'Already a member of this group' };
  }

  const memberCountResult = await db.query(`SELECT COUNT(*) as count FROM group_members WHERE group_id = $1`, [group.id]);
  const memberCount = parseInt(memberCountResult.rows[0].count);

  if (memberCount >= group.maxMembers) {
    return { error: 'Group is full' };
  }

  const isBannedResult = await db.query(`SELECT 1 FROM group_bans WHERE group_id = $1 AND user_id = $2`, [group.id, userId]);
  if (isBannedResult.rows.length > 0) {
    return { error: 'You are banned from this group' };
  }

  await db.query(
    `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member')`,
    [group.id, userId]
  );

  return { group };
};

export const leaveGroup = async (userId: string, groupId: string): Promise<void> => {
  const role = await getMemberRole(userId, groupId);
  if (!role) return;

  if (role === 'owner') {
    const adminsResult = await db.query(`SELECT user_id FROM group_members WHERE group_id = $1 AND role = 'admin' ORDER BY joined_at ASC LIMIT 1`, [groupId]);
    let newOwnerId = adminsResult.rows[0]?.user_id;

    if (!newOwnerId) {
      const membersResult = await db.query(`SELECT user_id FROM group_members WHERE group_id = $1 AND role = 'member' AND user_id != $2 ORDER BY joined_at ASC LIMIT 1`, [groupId, userId]);
      newOwnerId = membersResult.rows[0]?.user_id;
    }

    if (newOwnerId) {
      await transferOwnership(userId, newOwnerId, groupId);
    } else {
      await closeGroup(userId, groupId);
    }
  }

  await db.query(`DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`, [groupId, userId]);
};

export const kickMember = async (actorId: string, targetId: string, groupId: string): Promise<void> => {
  const actorRole = await getMemberRole(actorId, groupId);
  const targetRole = await getMemberRole(targetId, groupId);

  if (!actorRole || !targetRole) throw new Error('Member not found');
  if (actorRole === 'member') throw new Error('Unauthorized');
  if (targetRole === 'owner') throw new Error('Cannot kick owner');
  
  await db.query(`DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`, [groupId, targetId]);
  await db.query(`INSERT INTO group_bans (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [groupId, targetId]);
};

export const promoteMember = async (actorId: string, targetId: string, groupId: string): Promise<void> => {
  const actorRole = await getMemberRole(actorId, groupId);
  if (actorRole !== 'owner' && actorRole !== 'admin') throw new Error('Unauthorized');

  const targetRole = await getMemberRole(targetId, groupId);
  if (targetRole === 'member') {
    await db.query(`UPDATE group_members SET role = 'admin' WHERE group_id = $1 AND user_id = $2`, [groupId, targetId]);
  }
};

export const demoteMember = async (actorId: string, targetId: string, groupId: string): Promise<void> => {
  const actorRole = await getMemberRole(actorId, groupId);
  if (actorRole !== 'owner') throw new Error('Unauthorized');

  const targetRole = await getMemberRole(targetId, groupId);
  if (targetRole === 'admin') {
    await db.query(`UPDATE group_members SET role = 'member' WHERE group_id = $1 AND user_id = $2`, [groupId, targetId]);
  }
};

export const transferOwnership = async (ownerId: string, targetId: string, groupId: string): Promise<void> => {
  const ownerRole = await getMemberRole(ownerId, groupId);
  if (ownerRole !== 'owner') throw new Error('Unauthorized');

  const targetRole = await getMemberRole(targetId, groupId);
  if (!targetRole) throw new Error('Target is not a member');

  await db.query('BEGIN');
  try {
    await db.query(`UPDATE group_members SET role = 'admin' WHERE group_id = $1 AND user_id = $2`, [groupId, ownerId]);
    await db.query(`UPDATE group_members SET role = 'owner' WHERE group_id = $1 AND user_id = $2`, [groupId, targetId]);
    await db.query(`UPDATE groups SET owner_id = $2 WHERE id = $1`, [groupId, targetId]);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
};

export const regenerateInviteCode = async (actorId: string, groupId: string, expiresInHours?: number): Promise<string> => {
  const actorRole = await getMemberRole(actorId, groupId);
  if (actorRole !== 'owner' && actorRole !== 'admin') throw new Error('Unauthorized');

  const newCode = generateInviteCode();
  const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 3600000).toISOString() : null;

  await db.query(
    `UPDATE groups SET invite_code = $1, invite_expires_at = $2, invite_revoked = false WHERE id = $3`,
    [newCode, expiresAt, groupId]
  );
  return newCode;
};

export const revokeInviteCode = async (actorId: string, groupId: string): Promise<void> => {
  const actorRole = await getMemberRole(actorId, groupId);
  if (actorRole !== 'owner' && actorRole !== 'admin') throw new Error('Unauthorized');

  await db.query(`UPDATE groups SET invite_revoked = true WHERE id = $1`, [groupId]);
};

export const updateGroupSettings = async (actorId: string, groupId: string, settings: Partial<Pick<Group, 'name' | 'membersCanControl' | 'maxMembers'>>): Promise<void> => {
  const actorRole = await getMemberRole(actorId, groupId);
  if (actorRole !== 'owner' && actorRole !== 'admin') throw new Error('Unauthorized');

  const updates = [];
  const values = [];
  let index = 1;

  if (settings.name !== undefined) {
    updates.push(`name = $${index++}`);
    values.push(settings.name);
  }
  if (settings.membersCanControl !== undefined) {
    updates.push(`members_can_control = $${index++}`);
    values.push(settings.membersCanControl);
  }
  if (settings.maxMembers !== undefined) {
    updates.push(`max_members = $${index++}`);
    values.push(settings.maxMembers);
  }

  if (updates.length > 0) {
    values.push(groupId);
    await db.query(`UPDATE groups SET ${updates.join(', ')} WHERE id = $${index}`, values);
  }
};

export const closeGroup = async (actorId: string, groupId: string): Promise<void> => {
  const actorRole = await getMemberRole(actorId, groupId);
  if (actorRole !== 'owner') throw new Error('Unauthorized');

  await db.query(`UPDATE groups SET is_closed = true WHERE id = $1`, [groupId]);
};

export const deleteGroup = async (actorId: string, groupId: string): Promise<void> => {
  const actorRole = await getMemberRole(actorId, groupId);
  if (actorRole !== 'owner') throw new Error('Unauthorized');

  await db.query(`DELETE FROM groups WHERE id = $1`, [groupId]);
};

export const getGroupMembers = async (groupId: string): Promise<GroupMember[]> => {
  const result = await db.query(`
    SELECT gm.user_id, gm.role, gm.joined_at, u.display_name, u.avatar_emoji, u.avatar_color
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = $1
  `, [groupId]);

  return result.rows.map(row => ({
    userId: row.user_id,
    displayName: row.display_name,
    avatarEmoji: row.avatar_emoji,
    avatarColor: row.avatar_color,
    role: row.role,
    joinedAt: row.joined_at
  }));
};

export const getMemberRole = async (userId: string, groupId: string): Promise<'owner' | 'admin' | 'member' | null> => {
  const result = await db.query(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, [groupId, userId]);
  return result.rows.length ? result.rows[0].role : null;
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
    inviteRevoked: row.invite_revoked,
    membersCanControl: row.members_can_control,
    maxMembers: row.max_members,
    isClosed: row.is_closed,
    createdAt: row.created_at
  };
}
