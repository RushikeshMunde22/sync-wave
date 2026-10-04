import { Server as SocketIOServer } from 'socket.io';
import { PlaybackState, QueueItem, MemberPresence, ClientToServerEvents, ServerToClientEvents, TrackInfo } from './sync.events.js';
import { getDb } from '../db/database.js';

export function getTrackInfo(trackId: string): TrackInfo | undefined {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      title: row.title,
      artist: row.artist,
      artworkUrl: row.artwork_url || undefined,
      durationMs: row.duration_ms,
      streamUrl: row.stream_url_cached || undefined,
      attribution: row.attribution || undefined,
    };
  } catch (err) {
    console.error('Failed to get track info from DB:', err);
    return undefined;
  }
}

export class SyncEngine {
  private groupLocks = new Map<string, Promise<void>>();
  private playbackStates = new Map<string, PlaybackState>();
  private queues = new Map<string, QueueItem[]>();
  private trackEndTimers = new Map<string, NodeJS.Timeout>();
  private presence = new Map<string, Map<string, MemberPresence>>();
  private skipVotes = new Map<string, Set<string>>();

  constructor(private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>) {}

  init(): void {
    try {
      const db = getDb();
      const rows = db.prepare('SELECT group_id FROM playback_state').all() as { group_id: string }[];
      for (const row of rows) {
        const state = this.loadState(row.group_id);
        if (state) {
          this.playbackStates.set(row.group_id, state);
        }
      }
      console.log(`[SyncEngine] Initialized with ${rows.length} room state(s) from database.`);
    } catch (err) {
      console.error('[SyncEngine] Error initializing from DB:', err);
    }
  }

  private async withGroupLock<T>(groupId: string, fn: () => T | Promise<T>): Promise<T> {
    const currentLock = this.groupLocks.get(groupId) || Promise.resolve();
    const nextLock = currentLock.then(async () => {
      try {
        await fn();
      } catch (err) {
        console.error(`Error in group lock for ${groupId}:`, err);
      }
    });
    this.groupLocks.set(groupId, nextLock);
    
    await currentLock;
    return await fn();
  }

  getPlaybackState(groupId: string): PlaybackState {
    const state = this.playbackStates.get(groupId);
    if (state) return { ...state };
    
    // Check DB
    const dbState = this.loadState(groupId);
    if (dbState) {
      this.playbackStates.set(groupId, dbState);
      return { ...dbState };
    }

    return {
      trackId: null,
      isPlaying: false,
      positionMs: 0,
      serverTimeMs: Date.now(),
      version: 0,
      controlledBy: null
    };
  }

  async play(groupId: string, userId: string): Promise<void> {
    await this.withGroupLock(groupId, () => {
      const state = this.getPlaybackState(groupId);
      if (state.isPlaying || !state.trackId) return;

      const trackInfo = getTrackInfo(state.trackId) || state.track;
      if (!trackInfo) return;

      state.isPlaying = true;
      state.serverTimeMs = Date.now();
      state.version += 1;
      state.controlledBy = userId;
      
      this.playbackStates.set(groupId, state);
      this.broadcastPlaybackState(groupId, state);

      const remainingMs = Math.max(0, trackInfo.durationMs - state.positionMs);
      this.setTrackEndTimer(groupId, remainingMs);
      this.persistState(groupId, state);
    });
  }

  async pause(groupId: string, userId: string, forEveryone: boolean): Promise<void> {
    if (!forEveryone) {
      this.updatePresence(groupId, userId, 'paused');
      return;
    }

    await this.withGroupLock(groupId, () => {
      const state = this.getPlaybackState(groupId);
      if (!state.isPlaying) return;

      // Calculate new position
      const elapsedMs = Date.now() - state.serverTimeMs;
      state.positionMs += elapsedMs;
      state.isPlaying = false;
      state.serverTimeMs = Date.now();
      state.version += 1;
      state.controlledBy = userId;

      this.playbackStates.set(groupId, state);
      this.clearTrackEndTimer(groupId);
      this.broadcastPlaybackState(groupId, state);
      this.persistState(groupId, state);

      try {
        const db = getDb();
        const userRow = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId) as { display_name: string } | undefined;
        this.io.to(groupId).emit('playback:admin-paused', {
          pausedBy: userId,
          pausedByName: userRow?.display_name || 'Host'
        });
      } catch (e) {}
    });
  }

  async seek(groupId: string, userId: string, positionMs: number): Promise<void> {
    await this.withGroupLock(groupId, () => {
      const state = this.getPlaybackState(groupId);
      state.positionMs = positionMs;
      state.serverTimeMs = Date.now();
      state.version += 1;
      state.controlledBy = userId;

      this.playbackStates.set(groupId, state);
      this.broadcastPlaybackState(groupId, state);

      if (state.isPlaying && state.trackId) {
        const trackInfo = getTrackInfo(state.trackId) || state.track;
        if (trackInfo) {
          const remainingMs = Math.max(0, trackInfo.durationMs - positionMs);
          this.setTrackEndTimer(groupId, remainingMs);
        }
      }
      this.persistState(groupId, state);
    });
  }

  async loadTrack(groupId: string, userId: string, trackId: string): Promise<void> {
    await this.withGroupLock(groupId, () => {
      const trackInfo = getTrackInfo(trackId);
      if (!trackInfo) return;

      const state: PlaybackState = {
        trackId,
        track: trackInfo,
        isPlaying: true,
        positionMs: 0,
        serverTimeMs: Date.now(),
        version: (this.playbackStates.get(groupId)?.version || 0) + 1,
        controlledBy: userId
      };

      this.playbackStates.set(groupId, state);
      this.clearSkipVotes(groupId);
      this.broadcastPlaybackState(groupId, state);
      this.setTrackEndTimer(groupId, trackInfo.durationMs);
      this.persistState(groupId, state);
    });
  }

  async skip(groupId: string, userId: string): Promise<void> {
    await this.withGroupLock(groupId, () => {
      const state = this.getPlaybackState(groupId);
      const nextItem = this.popNextFromQueue(groupId);
      
      if (nextItem) {
        const trackInfo = getTrackInfo(nextItem.trackId);
        if (trackInfo) {
          state.trackId = nextItem.trackId;
          state.track = trackInfo;
          state.positionMs = 0;
          state.isPlaying = true;
          state.serverTimeMs = Date.now();
          state.version += 1;
          state.controlledBy = userId;
          
          this.playbackStates.set(groupId, state);
          this.clearSkipVotes(groupId);
          this.broadcastPlaybackState(groupId, state);
          this.setTrackEndTimer(groupId, trackInfo.durationMs);
          this.persistState(groupId, state);
          return;
        }
      }
      
      // Stop playback if queue is empty
      state.trackId = null;
      state.track = undefined;
      state.isPlaying = false;
      state.positionMs = 0;
      state.version += 1;
      state.controlledBy = userId;
      
      this.playbackStates.set(groupId, state);
      this.clearTrackEndTimer(groupId);
      this.broadcastPlaybackState(groupId, state);
      this.persistState(groupId, state);
    });
  }

  async onTrackEnded(groupId: string, trackId: string, version: number): Promise<void> {
    await this.withGroupLock(groupId, () => {
      const state = this.getPlaybackState(groupId);
      if (state.trackId !== trackId || state.version !== version) {
        return; // Dedup
      }

      const nextItem = this.popNextFromQueue(groupId);
      
      if (nextItem) {
        const trackInfo = getTrackInfo(nextItem.trackId);
        if (trackInfo) {
          state.trackId = nextItem.trackId;
          state.track = trackInfo;
          state.positionMs = 0;
          state.isPlaying = true;
          state.serverTimeMs = Date.now();
          state.version += 1;
          state.controlledBy = 'system';
          
          this.playbackStates.set(groupId, state);
          this.clearSkipVotes(groupId);
          this.broadcastPlaybackState(groupId, state);
          this.setTrackEndTimer(groupId, trackInfo.durationMs);
          this.persistState(groupId, state);
          return;
        }
      }
      
      state.trackId = null;
      state.track = undefined;
      state.isPlaying = false;
      state.positionMs = 0;
      state.version += 1;
      state.controlledBy = 'system';
      
      this.playbackStates.set(groupId, state);
      this.clearTrackEndTimer(groupId);
      this.broadcastPlaybackState(groupId, state);
      this.persistState(groupId, state);
    });
  }

  async resync(groupId: string): Promise<PlaybackState> {
    return this.getPlaybackState(groupId);
  }

  async addToQueue(groupId: string, userId: string, trackId: string, playNext?: boolean): Promise<void> {
    await this.withGroupLock(groupId, () => {
      const queue = this.queues.get(groupId) || [];
      const trackInfo = getTrackInfo(trackId);
      if (!trackInfo) return;

      let userName = 'Listener';
      try {
        const db = getDb();
        const userRow = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId) as { display_name: string } | undefined;
        if (userRow) userName = userRow.display_name;
      } catch (e) {}

      const newItem: QueueItem = {
        id: `q-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        trackId,
        title: trackInfo.title,
        artist: trackInfo.artist,
        artworkUrl: trackInfo.artworkUrl,
        durationMs: trackInfo.durationMs,
        addedBy: userId,
        addedByName: userName,
        position: queue.length
      };

      if (playNext) {
        queue.splice(0, 0, newItem);
      } else {
        queue.push(newItem);
      }

      queue.forEach((item, index) => item.position = index);
      this.queues.set(groupId, queue);
      this.broadcastQueue(groupId);
    });
  }

  async removeFromQueue(groupId: string, _userId: string, queueItemId: string): Promise<void> {
    await this.withGroupLock(groupId, () => {
      let queue = this.queues.get(groupId) || [];
      queue = queue.filter(item => item.id !== queueItemId);
      queue.forEach((item, index) => item.position = index);
      this.queues.set(groupId, queue);
      this.broadcastQueue(groupId);
    });
  }

  async reorderQueue(groupId: string, _userId: string, queueItemId: string, newPosition: number): Promise<void> {
    await this.withGroupLock(groupId, () => {
      const queue = this.queues.get(groupId) || [];
      const itemIndex = queue.findIndex(item => item.id === queueItemId);
      if (itemIndex === -1) return;

      const [item] = queue.splice(itemIndex, 1);
      if (!item) return;

      queue.splice(newPosition, 0, item);
      queue.forEach((i, index) => i.position = index);
      this.queues.set(groupId, queue);
      this.broadcastQueue(groupId);
    });
  }

  getQueue(groupId: string): QueueItem[] {
    return this.queues.get(groupId) || [];
  }

  private popNextFromQueue(groupId: string): QueueItem | null {
    const queue = this.queues.get(groupId) || [];
    if (queue.length === 0) return null;
    
    const nextItem = queue.shift()!;
    queue.forEach((item, index) => item.position = index);
    this.queues.set(groupId, queue);
    this.broadcastQueue(groupId);
    return nextItem;
  }

  addMember(groupId: string, member: MemberPresence): void {
    if (!this.presence.has(groupId)) {
      this.presence.set(groupId, new Map());
    }
    this.presence.get(groupId)!.set(member.userId, member);
  }

  removeMember(groupId: string, userId: string): void {
    if (this.presence.has(groupId)) {
      this.presence.get(groupId)!.delete(userId);
    }
  }

  updatePresence(groupId: string, userId: string, status: 'listening' | 'paused' | 'buffering'): void {
    const groupPresence = this.presence.get(groupId);
    if (groupPresence && groupPresence.has(userId)) {
      const member = groupPresence.get(userId)!;
      member.status = status;
      this.io.to(groupId).emit('presence:updated', { userId, status });
    }
  }

  getMembers(groupId: string): MemberPresence[] {
    const groupPresence = this.presence.get(groupId);
    return groupPresence ? Array.from(groupPresence.values()) : [];
  }

  getOnlineCount(groupId: string): number {
    return this.getMembers(groupId).length;
  }

  castSkipVote(groupId: string, userId: string): { votesNeeded: number; currentVotes: number; passed: boolean } {
    if (!this.skipVotes.has(groupId)) {
      this.skipVotes.set(groupId, new Set());
    }
    const votes = this.skipVotes.get(groupId)!;
    votes.add(userId);
    
    const members = this.getOnlineCount(groupId);
    const votesNeeded = Math.ceil(members / 2) || 1;
    const currentVotes = votes.size;
    const passed = currentVotes >= votesNeeded;

    return { votesNeeded, currentVotes, passed };
  }

  clearSkipVotes(groupId: string): void {
    if (this.skipVotes.has(groupId)) {
      this.skipVotes.get(groupId)!.clear();
    }
  }

  private setTrackEndTimer(groupId: string, remainingMs: number): void {
    this.clearTrackEndTimer(groupId);
    const state = this.getPlaybackState(groupId);
    if (!state.trackId) return;

    const version = state.version;
    const trackId = state.trackId;

    const timer = setTimeout(() => {
      this.onTrackEnded(groupId, trackId, version).catch(err => {
        console.error(`Error handling track end for group ${groupId}:`, err);
      });
    }, remainingMs);
    
    this.trackEndTimers.set(groupId, timer);
  }

  private clearTrackEndTimer(groupId: string): void {
    const timer = this.trackEndTimers.get(groupId);
    if (timer) {
      clearTimeout(timer);
      this.trackEndTimers.delete(groupId);
    }
  }

  private persistState(groupId: string, state: PlaybackState): void {
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO playback_state (group_id, track_id, is_playing, position_ms, updated_at_server_ms, version, controlled_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(group_id) DO UPDATE SET
          track_id = excluded.track_id,
          is_playing = excluded.is_playing,
          position_ms = excluded.position_ms,
          updated_at_server_ms = excluded.updated_at_server_ms,
          version = excluded.version,
          controlled_by = excluded.controlled_by
      `).run(
        groupId,
        state.trackId,
        state.isPlaying ? 1 : 0,
        state.positionMs,
        state.serverTimeMs,
        state.version,
        state.controlledBy
      );
    } catch (err) {
      console.error('Failed to persist playback state to DB:', err);
    }
  }

  private loadState(groupId: string): PlaybackState | null {
    try {
      const db = getDb();
      const row = db.prepare('SELECT * FROM playback_state WHERE group_id = ?').get(groupId) as any;
      if (!row) return null;
      let trackInfo: TrackInfo | undefined = undefined;
      if (row.track_id) {
        trackInfo = getTrackInfo(row.track_id);
      }
      return {
        trackId: row.track_id,
        isPlaying: Boolean(row.is_playing),
        positionMs: row.position_ms,
        serverTimeMs: row.updated_at_server_ms,
        version: row.version,
        controlledBy: row.controlled_by,
        track: trackInfo,
      };
    } catch (err) {
      console.error('Failed to load playback state from DB:', err);
      return null;
    }
  }

  private broadcastPlaybackState(groupId: string, state: PlaybackState): void {
    this.io.to(groupId).emit('playback:state', state);
  }

  private broadcastQueue(groupId: string): void {
    const queue = this.getQueue(groupId);
    this.io.to(groupId).emit('queue:updated', { queue });
  }
}
