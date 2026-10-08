import { Server as SocketIOServer } from 'socket.io';
import { PlaybackState, QueueItem, MemberPresence, ClientToServerEvents, ServerToClientEvents, TrackInfo, SongRequest } from './sync.events.js';
import { getDb } from '../db/database.js';
import { providerManager } from '../music/provider.manager.js';
import { musicCache } from '../music/music.cache.js';

export function getTrackInfo(trackId: string): TrackInfo | undefined {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId) as any;
    const isVideo = trackId.startsWith('youtube:');
    const videoId = isVideo ? trackId.replace('youtube:', '') : undefined;

    if (!row) {
      if (isVideo && videoId) {
        return {
          id: trackId,
          title: `YouTube Video (${videoId})`,
          artist: 'YouTube',
          artworkUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          durationMs: 240000,
          attribution: 'YouTube',
          mediaType: 'video',
          videoId,
        };
      }
      return undefined;
    }

    return {
      id: row.id,
      title: row.title,
      artist: row.artist,
      artworkUrl: row.artwork_url || undefined,
      durationMs: row.duration_ms,
      streamUrl: row.stream_url_cached || undefined,
      attribution: row.attribution || undefined,
      mediaType: isVideo ? 'video' : 'audio',
      videoId,
    };
  } catch (err) {
    console.error('Failed to get track info from DB:', err);
    return undefined;
  }
}

let syncEngineInstance: SyncEngine | null = null;

export function getSyncEngine(): SyncEngine | null {
  return syncEngineInstance;
}

export class SyncEngine {
  private groupLocks = new Map<string, Promise<void>>();
  private playbackStates = new Map<string, PlaybackState>();
  private queues = new Map<string, QueueItem[]>();
  private trackEndTimers = new Map<string, NodeJS.Timeout>();
  private presence = new Map<string, Map<string, MemberPresence>>();
  private skipVotes = new Map<string, Set<string>>();
  private emptyGroupTimers = new Map<string, NodeJS.Timeout>();
  private songRequests = new Map<string, SongRequest[]>();

  constructor(private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>) {
    syncEngineInstance = this;
  }

  clearRoom(groupId: string): void {
    this.playbackStates.delete(groupId);
    this.queues.delete(groupId);
    this.songRequests.delete(groupId);
    this.presence.delete(groupId);
    this.skipVotes.delete(groupId);
    this.clearTrackEndTimer(groupId);
    this.cancelEmptyRoomDeletion(groupId);
  }

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
      // Scan active groups to schedule empty room auto-deletion if 0 members
      const activeGroups = db.prepare('SELECT id FROM groups WHERE is_closed = 0').all() as { id: string }[];
      for (const g of activeGroups) {
        if (this.getOnlineCount(g.id) === 0) {
          this.scheduleEmptyRoomDeletion(g.id);
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
    await this.withGroupLock(groupId, async () => {
      let trackInfo = getTrackInfo(trackId);
      if (!trackInfo || (!trackInfo.streamUrl && !trackId.startsWith('youtube:'))) {
        const [provider, ...rest] = trackId.split(':');
        const providerTrackId = rest.join(':');
        if (provider && providerTrackId) {
          const track = await providerManager.getTrack(provider, providerTrackId);
          if (track) {
            await musicCache.cacheTrack(track);
            trackInfo = getTrackInfo(trackId) || {
              id: track.id,
              title: track.title,
              artist: track.artist,
              artworkUrl: track.artworkUrl,
              durationMs: track.durationMs,
              streamUrl: track.streamUrl,
              attribution: track.attribution,
            };
          }
        }
      }
      if (!trackInfo) return;

      const isVideo = trackId.startsWith('youtube:') || trackInfo.mediaType === 'video';
      const videoId = trackInfo.videoId || (trackId.startsWith('youtube:') ? trackId.replace('youtube:', '') : undefined);

      const state: PlaybackState = {
        trackId,
        track: trackInfo,
        mediaType: isVideo ? 'video' : 'audio',
        videoId,
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

  private async getRecommendedNextTrack(currentTrackId?: string | null): Promise<TrackInfo | null> {
    try {
      let query = 'trending';
      let prevTrack: TrackInfo | undefined;
      if (currentTrackId) {
        prevTrack = getTrackInfo(currentTrackId);
        if (prevTrack?.artist) {
          const first = prevTrack.artist.split(',')[0] ?? '';
          query = (first.split('&')[0] ?? '').trim() || 'trending';
        } else if (prevTrack?.title) {
          query = prevTrack.title.replace(/\(.*?\)/g, '').trim();
        }
      }

      let res = await providerManager.search(query, 15, 0);
      if (!res.tracks || res.tracks.length === 0) {
        res = await providerManager.trending(15, 0);
      }

      const candidates = (res.tracks || []).filter(
        t => t.id !== currentTrackId && (!prevTrack || t.title.toLowerCase() !== prevTrack.title.toLowerCase())
      );

      const chosen = candidates[Math.floor(Math.random() * Math.min(candidates.length, 5))] || res.tracks[0];
      if (chosen) {
        await musicCache.cacheTrack(chosen);
        return getTrackInfo(chosen.id) || {
          id: chosen.id,
          title: chosen.title,
          artist: chosen.artist,
          artworkUrl: chosen.artworkUrl,
          durationMs: chosen.durationMs,
          streamUrl: chosen.streamUrl,
          attribution: chosen.attribution,
        };
      }
    } catch (err) {
      console.warn('[SyncEngine] Auto-recommendation lookup failed:', err);
    }
    return null;
  }

  async skip(groupId: string, userId: string): Promise<void> {
    await this.withGroupLock(groupId, async () => {
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

      // Auto-recommend next track if queue is empty!
      const recTrack = await this.getRecommendedNextTrack(state.trackId);
      if (recTrack) {
        state.trackId = recTrack.id;
        state.track = recTrack;
        state.positionMs = 0;
        state.isPlaying = true;
        state.serverTimeMs = Date.now();
        state.version += 1;
        state.controlledBy = userId;

        this.playbackStates.set(groupId, state);
        this.clearSkipVotes(groupId);
        this.broadcastPlaybackState(groupId, state);
        this.setTrackEndTimer(groupId, recTrack.durationMs);
        this.persistState(groupId, state);
        return;
      }
      
      // Stop playback if no recommendation available
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
    await this.withGroupLock(groupId, async () => {
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

      // Auto-recommend and play next track continuously so music never stops!
      const recTrack = await this.getRecommendedNextTrack(trackId);
      if (recTrack) {
        state.trackId = recTrack.id;
        state.track = recTrack;
        state.positionMs = 0;
        state.isPlaying = true;
        state.serverTimeMs = Date.now();
        state.version += 1;
        state.controlledBy = 'auto_recommendation';

        this.playbackStates.set(groupId, state);
        this.clearSkipVotes(groupId);
        this.broadcastPlaybackState(groupId, state);
        this.setTrackEndTimer(groupId, recTrack.durationMs);
        this.persistState(groupId, state);
        return;
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
    await this.withGroupLock(groupId, async () => {
      const currentState = this.getPlaybackState(groupId);
      const queue = this.queues.get(groupId) || [];
      let trackInfo = getTrackInfo(trackId);
      if (!trackInfo || !trackInfo.streamUrl) {
        const [provider, ...rest] = trackId.split(':');
        const providerTrackId = rest.join(':');
        if (provider && providerTrackId) {
          const track = await providerManager.getTrack(provider, providerTrackId);
          if (track) {
            await musicCache.cacheTrack(track);
            trackInfo = getTrackInfo(trackId);
          }
        }
      }
      if (!trackInfo) return;

      // If nothing is playing and no active track, play immediately for everyone!
      if (!currentState.trackId || (!currentState.isPlaying && queue.length === 0)) {
        await this.loadTrack(groupId, userId, trackId);
        return;
      }

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
    this.cancelEmptyRoomDeletion(groupId);
    if (!this.presence.has(groupId)) {
      this.presence.set(groupId, new Map());
    }
    this.presence.get(groupId)!.set(member.userId, member);
  }

  removeMember(groupId: string, userId: string): void {
    if (this.presence.has(groupId)) {
      this.presence.get(groupId)!.delete(userId);
      if (this.presence.get(groupId)!.size === 0) {
        this.presence.delete(groupId);
        this.scheduleEmptyRoomDeletion(groupId);
      }
    }
  }

  scheduleEmptyRoomDeletion(groupId: string): void {
    if (this.emptyGroupTimers.has(groupId)) return;
    console.log(`[SyncEngine] Room ${groupId} is empty. Scheduling auto-deletion in 5 minutes.`);
    const timer = setTimeout(async () => {
      try {
        if (this.getOnlineCount(groupId) === 0) {
          console.log(`[SyncEngine] Room ${groupId} has been empty for 5 minutes. Auto-deleting room.`);
          const db = getDb();
          db.prepare('DELETE FROM groups WHERE id = ?').run(groupId);
          this.playbackStates.delete(groupId);
          this.queues.delete(groupId);
          this.songRequests.delete(groupId);
          this.presence.delete(groupId);
          this.skipVotes.delete(groupId);
          this.clearTrackEndTimer(groupId);
          this.io.to(groupId).emit('room:deleted', { groupId, reason: 'Room deleted due to inactivity' });
        }
      } catch (err) {
        console.error(`[SyncEngine] Failed to auto-delete empty room ${groupId}:`, err);
      } finally {
        this.emptyGroupTimers.delete(groupId);
      }
    }, 5 * 60 * 1000); // 5 minutes

    this.emptyGroupTimers.set(groupId, timer);
  }

  cancelEmptyRoomDeletion(groupId: string): void {
    const timer = this.emptyGroupTimers.get(groupId);
    if (timer) {
      clearTimeout(timer);
      this.emptyGroupTimers.delete(groupId);
      console.log(`[SyncEngine] Member active in room ${groupId}. Cancelled empty room auto-deletion.`);
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
      // Verify group still exists before inserting to prevent foreign key errors on deleted/empty rooms
      const groupExists = db.prepare('SELECT 1 FROM groups WHERE id = ?').get(groupId);
      if (!groupExists) {
        this.playbackStates.delete(groupId);
        this.queues.delete(groupId);
        this.clearTrackEndTimer(groupId);
        this.songRequests.delete(groupId);
        this.presence.delete(groupId);
        this.skipVotes.delete(groupId);
        return;
      }

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
    } catch (err: any) {
      if (err?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        this.playbackStates.delete(groupId);
        this.queues.delete(groupId);
        this.clearTrackEndTimer(groupId);
        this.songRequests.delete(groupId);
        this.presence.delete(groupId);
        this.skipVotes.delete(groupId);
        return;
      }
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
        mediaType: trackInfo?.mediaType || (row.track_id?.startsWith('youtube:') ? 'video' : 'audio'),
        videoId: trackInfo?.videoId || (row.track_id?.startsWith('youtube:') ? row.track_id.replace('youtube:', '') : undefined),
      };
    } catch (err) {
      console.error('Failed to load playback state from DB:', err);
      return null;
    }
  }

  async reloadQueue(groupId: string): Promise<void> {
    try {
      const db = getDb();
      const rows = db.prepare(`
        SELECT qi.id, qi.track_id, qi.added_by, qi.position, u.display_name as added_by_name
        FROM queue_items qi
        LEFT JOIN users u ON qi.added_by = u.id
        WHERE qi.group_id = ?
        ORDER BY qi.position ASC
      `).all(groupId) as any[];

      const items: QueueItem[] = [];
      for (const row of rows) {
        let trackInfo = getTrackInfo(row.track_id);
        if (!trackInfo) {
          const [provider, ...rest] = row.track_id.split(':');
          const providerTrackId = rest.join(':');
          if (provider && providerTrackId) {
            const track = await providerManager.getTrack(provider, providerTrackId);
            if (track) {
              await musicCache.cacheTrack(track);
              trackInfo = getTrackInfo(row.track_id);
            }
          }
        }
        if (trackInfo) {
          items.push({
            id: row.id,
            trackId: row.track_id,
            title: trackInfo.title,
            artist: trackInfo.artist,
            artworkUrl: trackInfo.artworkUrl,
            durationMs: trackInfo.durationMs,
            addedBy: row.added_by,
            addedByName: row.added_by_name || 'Listener',
            position: row.position
          });
        }
      }
      this.queues.set(groupId, items);
      this.broadcastQueue(groupId);
    } catch (err) {
      console.error(`Failed to reload queue for ${groupId}:`, err);
    }
  }

  async autoPlayIfQuiet(groupId: string): Promise<void> {
    const state = this.getPlaybackState(groupId);
    if (!state.trackId || !state.isPlaying) {
      const queue = this.queues.get(groupId) || [];
      if (queue.length > 0) {
        const next = this.popNextFromQueue(groupId);
        if (next) {
          await this.loadTrack(groupId, next.addedBy, next.trackId);
        }
      }
    }
  }

  loadSongRequests(groupId: string): SongRequest[] {
    try {
      const db = getDb();
      const rows = db.prepare(`
        SELECT id, group_id as groupId, track_id as trackId, title, artist, 
               artwork_url as artworkUrl, duration_ms as durationMs,
               media_type as mediaType, video_id as videoId,
               requested_by as requestedBy, requested_by_name as requestedByName,
               created_at as createdAt
        FROM group_song_requests
        WHERE group_id = ?
        ORDER BY created_at ASC
      `).all(groupId) as SongRequest[];
      this.songRequests.set(groupId, rows);
      return rows;
    } catch (err) {
      console.error(`Failed to load song requests for ${groupId}:`, err);
      return [];
    }
  }

  getSongRequests(groupId: string): SongRequest[] {
    if (!this.songRequests.has(groupId)) {
      return this.loadSongRequests(groupId);
    }
    return this.songRequests.get(groupId) || [];
  }

  async addSongRequest(groupId: string, userId: string, trackId: string): Promise<SongRequest | null> {
    let trackInfo = getTrackInfo(trackId);
    if (!trackInfo || (!trackInfo.streamUrl && !trackId.startsWith('youtube:'))) {
      const [provider, ...rest] = trackId.split(':');
      const providerTrackId = rest.join(':');
      if (provider && providerTrackId) {
        const track = await providerManager.getTrack(provider, providerTrackId);
        if (track) {
          await musicCache.cacheTrack(track);
          trackInfo = getTrackInfo(trackId);
        }
      }
    }
    if (!trackInfo) return null;

    const db = getDb();
    const userRow = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId) as { display_name: string } | undefined;
    const userName = userRow?.display_name || 'Listener';
    const reqId = `sr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const isVideo = trackId.startsWith('youtube:') || trackInfo.mediaType === 'video';
    const videoId = trackInfo.videoId || (trackId.startsWith('youtube:') ? trackId.replace('youtube:', '') : undefined);

    const newReq: SongRequest = {
      id: reqId,
      groupId,
      trackId,
      title: trackInfo.title,
      artist: trackInfo.artist,
      artworkUrl: trackInfo.artworkUrl,
      durationMs: trackInfo.durationMs,
      mediaType: isVideo ? 'video' : 'audio',
      videoId,
      requestedBy: userId,
      requestedByName: userName,
      createdAt: Date.now(),
    };

    try {
      db.prepare(`
        INSERT INTO group_song_requests (id, group_id, track_id, title, artist, artwork_url, duration_ms, media_type, video_id, requested_by, requested_by_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newReq.id,
        newReq.groupId,
        newReq.trackId,
        newReq.title,
        newReq.artist,
        newReq.artworkUrl || null,
        newReq.durationMs,
        newReq.mediaType || 'audio',
        newReq.videoId || null,
        newReq.requestedBy,
        newReq.requestedByName,
        newReq.createdAt
      );
    } catch (err) {
      console.error('Failed to insert song request into DB:', err);
    }

    const list = this.getSongRequests(groupId);
    list.push(newReq);
    this.songRequests.set(groupId, list);
    this.broadcastSongRequests(groupId);
    return newReq;
  }

  async approveSongRequest(groupId: string, requestId: string, action: 'play-now' | 'queue'): Promise<void> {
    const list = this.getSongRequests(groupId);
    const reqItem = list.find((r) => r.id === requestId);
    if (!reqItem) return;

    try {
      const db = getDb();
      db.prepare('DELETE FROM group_song_requests WHERE id = ?').run(requestId);
    } catch (err) {
      console.error('Failed to delete approved song request from DB:', err);
    }
    const filtered = list.filter((r) => r.id !== requestId);
    this.songRequests.set(groupId, filtered);
    this.broadcastSongRequests(groupId);

    if (action === 'play-now') {
      await this.loadTrack(groupId, reqItem.requestedBy, reqItem.trackId);
    } else {
      await this.addToQueue(groupId, reqItem.requestedBy, reqItem.trackId);
    }
  }

  async rejectSongRequest(groupId: string, requestId: string): Promise<void> {
    try {
      const db = getDb();
      db.prepare('DELETE FROM group_song_requests WHERE id = ?').run(requestId);
    } catch (err) {
      console.error('Failed to delete rejected song request from DB:', err);
    }
    const list = this.getSongRequests(groupId);
    const filtered = list.filter((r) => r.id !== requestId);
    this.songRequests.set(groupId, filtered);
    this.broadcastSongRequests(groupId);
  }

  broadcastSongRequests(groupId: string): void {
    const requests = this.getSongRequests(groupId);
    this.io.to(groupId).emit('song-requests:updated', { requests });
  }

  private broadcastPlaybackState(groupId: string, state: PlaybackState): void {
    this.io.to(groupId).emit('playback:state', state);
  }

  private broadcastQueue(groupId: string): void {
    const queue = this.getQueue(groupId);
    this.io.to(groupId).emit('queue:updated', { queue });
  }
}
