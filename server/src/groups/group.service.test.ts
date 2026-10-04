import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, closeDb } from '../db/database.js';
import { runMigrations } from '../db/migrator.js';
import { createUser } from '../auth/auth.service.js';
import {
  createGroup,
  getGroup,
  joinGroup,
  getMemberRole,
  promoteMember,
  demoteMember,
  kickMember,
  transferOwnership,
  leaveGroup,
  deleteGroup,
  getUserGroups,
} from './group.service.js';

describe('Group Governance Service', () => {
  let ownerUser: any;
  let memberUser: any;

  beforeAll(async () => {
    getDb();
    runMigrations();

    const u1 = await createUser({
      email: `owner_${Date.now()}@syncwave.test`,
      password: 'OwnerPassword123!',
      displayName: 'Room Master',
    });
    ownerUser = u1.user;

    const u2 = await createUser({
      email: `member_${Date.now()}@syncwave.test`,
      password: 'MemberPassword123!',
      displayName: 'Party Guest',
    });
    memberUser = u2.user;
  });

  afterAll(() => {
    closeDb();
  });

  it('creates a new group with owner membership and playback state snapshot', async () => {
    const group = await createGroup(ownerUser.id, 'Midnight Lo-Fi Lounge');
    expect(group.id).toBeDefined();
    expect(group.name).toBe('Midnight Lo-Fi Lounge');
    expect(group.ownerId).toBe(ownerUser.id);
    expect(group.inviteCode).toBeDefined();

    const role = await getMemberRole(ownerUser.id, group.id);
    expect(role).toBe('owner');

    const userGroups = await getUserGroups(ownerUser.id);
    expect(userGroups.length).toBeGreaterThan(0);
    expect(userGroups.some(g => g.id === group.id)).toBe(true);
  });

  it('allows another user to join via invite code', async () => {
    const group = await createGroup(ownerUser.id, 'Techno Bunker');
    const joinResult = await joinGroup(memberUser.id, group.inviteCode);

    expect(joinResult.error).toBeUndefined();
    expect(joinResult.group).toBeDefined();
    expect(joinResult.group?.id).toBe(group.id);

    const role = await getMemberRole(memberUser.id, group.id);
    expect(role).toBe('member');
  });

  it('promotes member to admin and demotes back to member', async () => {
    const group = await createGroup(ownerUser.id, 'Synthwave Oasis');
    await joinGroup(memberUser.id, group.inviteCode);

    // Promote to admin
    await promoteMember(ownerUser.id, memberUser.id, group.id);
    let role = await getMemberRole(memberUser.id, group.id);
    expect(role).toBe('admin');

    // Demote back to member
    await demoteMember(ownerUser.id, memberUser.id, group.id);
    role = await getMemberRole(memberUser.id, group.id);
    expect(role).toBe('member');
  });

  it('kicks a member from the room', async () => {
    const group = await createGroup(ownerUser.id, 'Chill Hop Café');
    await joinGroup(memberUser.id, group.inviteCode);

    await kickMember(ownerUser.id, memberUser.id, group.id);
    const role = await getMemberRole(memberUser.id, group.id);
    expect(role).toBeNull();
  });

  it('transfers room ownership to another member', async () => {
    const group = await createGroup(ownerUser.id, 'Vaporwave Mall');
    await joinGroup(memberUser.id, group.inviteCode);

    await transferOwnership(ownerUser.id, memberUser.id, group.id);

    const newOwnerRole = await getMemberRole(memberUser.id, group.id);
    const oldOwnerRole = await getMemberRole(ownerUser.id, group.id);

    expect(newOwnerRole).toBe('owner');
    expect(oldOwnerRole).toBe('admin');
  });

  it('allows a member to leave a room and owner to delete room', async () => {
    const group = await createGroup(ownerUser.id, 'Ephemeral Lounge');
    await joinGroup(memberUser.id, group.inviteCode);

    await leaveGroup(memberUser.id, group.id);
    const role = await getMemberRole(memberUser.id, group.id);
    expect(role).toBeNull();

    await deleteGroup(ownerUser.id, group.id);
    const deletedGroup = await getGroup(group.id);
    expect(deletedGroup).toBeNull();
  });
});
