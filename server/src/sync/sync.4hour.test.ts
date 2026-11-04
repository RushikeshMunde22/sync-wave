import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { SyncEngine } from './sync.engine.js';
import { getDb, closeDb } from '../db/database.js';
import { runMigrations } from '../db/migrator.js';
import { Server } from 'socket.io';

describe('4-Hour Playback & Server-Authoritative Sync Simulation', () => {
  let mockIo: any;
  let engine: SyncEngine;
  const groupId = `test-room-4h-${Date.now()}`;
  const userId = `user-host-${Date.now()}`;

  beforeAll(() => {
    const db = getDb();
    runMigrations();

    // Insert user
    db.prepare(`
      INSERT OR IGNORE INTO users (id, email, password_hash, display_name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, `${userId}@syncwave.test`, 'dummyhash', 'Test Host', 'user');

    // Insert group
    db.prepare(`
      INSERT OR IGNORE INTO groups (id, name, owner_id, invite_code)
      VALUES (?, ?, ?, ?)
    `).run(groupId, '4-Hour Room', userId, `INV4H_${Date.now()}`);
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1700000000000);

    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as Server;

    engine = new SyncEngine(mockIo);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays continuously for 4 hours without resetting to 0:00 or stopping', async () => {
    const trackId = 'youtube:longVideoId123';

    // 1. Host loads a YouTube track (duration: 4 hours = 14,400,000 ms)
    await engine.loadTrack(groupId, userId, trackId);
    let state = engine.getPlaybackState(groupId);
    expect(state).toBeDefined();
    expect(state.isPlaying).toBe(true);
    expect(state.positionMs).toBe(0);
    expect(state.serverTimeMs).toBe(1700000000000);

    // 2. Fast-forward 1 hour (3,600,000 ms)
    vi.advanceTimersByTime(3600 * 1000);
    let expectedPosMs = engine.getExpectedPositionMs(groupId);
    expect(expectedPosMs).toBe(3600 * 1000);

    // 3. Fast-forward another 2 hours (total 3 hours)
    vi.advanceTimersByTime(2 * 3600 * 1000);
    expectedPosMs = engine.getExpectedPositionMs(groupId);
    expect(expectedPosMs).toBe(3 * 3600 * 1000);

    // 4. Fast-forward to 3 hours 55 minutes
    vi.advanceTimersByTime(55 * 60 * 1000);
    expectedPosMs = engine.getExpectedPositionMs(groupId);
    expect(expectedPosMs).toBe((3 * 3600 + 55 * 60) * 1000);

    // Video must STILL be playing and NOT reset to 0:00
    state = engine.getPlaybackState(groupId);
    expect(state.isPlaying).toBe(true);
  });

  it('enforces monotonic sequence numbers and rejects stale commands', async () => {
    const trackId = 'youtube:testSeq123';

    await engine.loadTrack(groupId, userId, trackId);
    // Pause it first
    await engine.pause(groupId, userId, true);
    const seqAfterPause = engine.getPlaybackState(groupId).seq || 0;

    // Command 1: play with seq: seqAfterPause + 1 -> should succeed
    await engine.play(groupId, userId, seqAfterPause + 1);
    expect(engine.getPlaybackState(groupId).seq).toBeGreaterThan(seqAfterPause);
    const seqAfterPlay = engine.getPlaybackState(groupId).seq;

    // Stale command: seek with seq = 1 (older than seqAfterPlay) -> should be rejected
    const prevPosition = engine.getPlaybackState(groupId).positionMs;
    await engine.seek(groupId, userId, 50000, 1);
    // Position should NOT have changed to 50000
    expect(engine.getPlaybackState(groupId).positionMs).toBe(prevPosition);

    // Fresh command: seek with seq = seqAfterPlay + 1 -> should succeed
    await engine.seek(groupId, userId, 50000, seqAfterPlay + 1);
    expect(engine.getPlaybackState(groupId).positionMs).toBe(50000);
    expect(engine.getPlaybackState(groupId).seq).toBe(seqAfterPlay + 1);
  });

  it('persists state with sequence number to database and restores accurately on restart', async () => {
    const persistGroupId = `persist-${Date.now()}`;
    const db = getDb();
    db.prepare(`
      INSERT OR IGNORE INTO groups (id, name, owner_id, invite_code)
      VALUES (?, ?, ?, ?)
    `).run(persistGroupId, 'Persist Room', userId, `INVP_${Date.now()}`);

    const trackId = 'youtube:persistTestVid';

    await engine.loadTrack(persistGroupId, userId, trackId);
    // Advance 30 minutes
    vi.advanceTimersByTime(30 * 60 * 1000);
    await engine.pause(persistGroupId, userId, true);

    const savedState = engine.getPlaybackState(persistGroupId);
    expect(savedState.positionMs).toBe(30 * 60 * 1000);
    expect(savedState.isPlaying).toBe(false);

    // Simulate server crash/restart: create brand new SyncEngine instance and load
    const restartedEngine = new SyncEngine(mockIo);
    const loadedState = restartedEngine.getPlaybackState(persistGroupId);

    expect(loadedState).toBeDefined();
    expect(loadedState.positionMs).toBe(30 * 60 * 1000);
    expect(loadedState.isPlaying).toBe(false);
    expect(loadedState.seq).toBe(savedState.seq);
  });
});
