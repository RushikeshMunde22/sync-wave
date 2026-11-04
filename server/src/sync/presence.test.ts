import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncEngine } from './sync.engine.js';
import { MemberPresence } from './sync.events.js';
import { Server } from 'socket.io';

describe('Presence Management & Multi-Tab Resiliency', () => {
  let mockIo: any;
  let engine: SyncEngine;
  const groupId = 'room-presence-test';

  const userAlice: MemberPresence = {
    userId: 'user-alice',
    displayName: 'Alice',
    avatarEmoji: '🌸',
    avatarColor: '#ec4899',
    role: 'owner',
    status: 'listening',
  };

  const userBob: MemberPresence = {
    userId: 'user-bob',
    displayName: 'Bob',
    avatarEmoji: '⚡',
    avatarColor: '#3b82f6',
    role: 'member',
    status: 'listening',
  };

  beforeEach(() => {
    vi.useFakeTimers();

    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as Server;

    engine = new SyncEngine(mockIo);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts a user only once across multiple open tabs', () => {
    // Alice opens tab 1
    const isNew1 = engine.addMember(groupId, userAlice, 'socket-alice-tab1');
    expect(isNew1).toBe(true);
    expect(engine.getOnlineCount(groupId)).toBe(1);
    expect(engine.getMembers(groupId)).toHaveLength(1);

    // Alice opens tab 2
    const isNew2 = engine.addMember(groupId, userAlice, 'socket-alice-tab2');
    expect(isNew2).toBe(false); // Not a new user
    expect(engine.getOnlineCount(groupId)).toBe(1); // Still 1
    expect(engine.getMembers(groupId)).toHaveLength(1);

    // Bob joins
    const isNewBob = engine.addMember(groupId, userBob, 'socket-bob-tab1');
    expect(isNewBob).toBe(true);
    expect(engine.getOnlineCount(groupId)).toBe(2);
    expect(engine.getMembers(groupId)).toHaveLength(2);
  });

  it('preserves user presence when one of multiple tabs is closed', () => {
    engine.addMember(groupId, userAlice, 'socket-alice-tab1');
    engine.addMember(groupId, userAlice, 'socket-alice-tab2');
    expect(engine.getOnlineCount(groupId)).toBe(1);

    // Alice closes tab 1
    engine.removeMember(groupId, userAlice.userId, 'socket-alice-tab1', false);
    // User presence must not drop because tab 2 is still open
    expect(engine.getOnlineCount(groupId)).toBe(1);
    expect(engine.getMembers(groupId)).toHaveLength(1);
  });

  it('applies a 12s grace period when all tabs close before removing the user', () => {
    engine.addMember(groupId, userAlice, 'socket-alice-tab1');
    expect(engine.getOnlineCount(groupId)).toBe(1);

    // Alice tab 1 disconnects unexpectedly (e.g. page refresh / network drop)
    engine.removeMember(groupId, userAlice.userId, 'socket-alice-tab1', false);

    // During grace period (e.g. 5 seconds later), Alice is STILL present
    vi.advanceTimersByTime(5000);
    expect(engine.getOnlineCount(groupId)).toBe(1);
    expect(engine.getMembers(groupId)).toHaveLength(1);

    // After 12+ seconds with no reconnect, Alice is removed
    vi.advanceTimersByTime(8000); // Total 13 seconds
    expect(engine.getOnlineCount(groupId)).toBe(0);
    expect(engine.getMembers(groupId)).toHaveLength(0);
  });

  it('cancels the grace timer when the user reconnects within the 12s window', () => {
    engine.addMember(groupId, userAlice, 'socket-alice-tab1');
    expect(engine.getOnlineCount(groupId)).toBe(1);

    // Alice tab 1 disconnects
    engine.removeMember(groupId, userAlice.userId, 'socket-alice-tab1', false);
    vi.advanceTimersByTime(6000); // 6s passed

    // Alice reconnects with a new socket
    engine.addMember(groupId, userAlice, 'socket-alice-tab2');

    // Advance another 10s (past original 12s threshold)
    vi.advanceTimersByTime(10000);

    // Alice must STILL be in the room
    expect(engine.getOnlineCount(groupId)).toBe(1);
    expect(engine.getMembers(groupId)).toHaveLength(1);
  });

  it('immediately removes user when explicit room:leave is triggered', () => {
    engine.addMember(groupId, userAlice, 'socket-alice-tab1');
    expect(engine.getOnlineCount(groupId)).toBe(1);

    // Explicit leave (immediate = true)
    engine.removeMember(groupId, userAlice.userId, 'socket-alice-tab1', true);
    expect(engine.getOnlineCount(groupId)).toBe(0);
    expect(engine.getMembers(groupId)).toHaveLength(0);
  });
});
