import { Server as SocketIOServer } from 'socket.io';
import { PlaybackState, QueueItem, MemberPresence, RoomState, ClientToServerEvents, ServerToClientEvents, TrackInfo } from './sync.events';

// In a real app, you would fetch this from a database or external API.
// For now, we mock track fetching.
const MOCK_TRACK_DB: Record<string, TrackInfo> = {
  'track-1': { id: 'track-1', title: 'Song 1', artist: 'Artist A', durationMs: 180000 },
  'track-2': { id: 'track-2', title: 'Song 2', artist: 'Artist B', durationMs: 240000 },
};

function getTrackInfo(trackId: string): TrackInfo | undefined {
  return MOCK_TRACK_DB[trackId];
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
    // In a real app, you would load active playback states from a database here
    console.log('SyncEngine initialized');
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
    
    // We await currentLock to queue up, then run fn and return its result
    await currentLock;
    return await fn();
  }

  getPlaybackState(groupId: string): PlaybackState {
    const state = this.playbackStates.get(groupId);
    if (state) return { ...state };
    
    // Default state if not found
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

      const remainingMs = trackInfo.durationMs - state.positionMs;
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
      // We might want to send admin-paused with user info, omitting full names for simplicity
      this.io.to(groupId).emit('playback:admin-paused', { pausedBy: userId, pausedByName: 'Admin' });
      this.persistState(groupId, state);
    });
  }

  async seek(groupId: string, userId: string, positionMs: number): Promise<void> {
    await this.withGroupLock(groupId, () => {
      const state = this.getPlaybackState(groupId);
      if (!state.trackId) return;

      const trackInfo = getTrackInfo(state.trackId) || state.track;
      if (!trackInfo) return;

      state.positionMs = Math.min(positionMs, trackInfo.durationMs);
      state.serverTimeMs = Date.now();
      state.version += 1;
      state.controlledBy = userId;

      this.playbackStates.set(groupId, state);
      this.broadcastPlaybackState(groupId, state);

      if (state.isPlaying) {
        const remainingMs = trackInfo.durationMs - state.positionMs;
        this.setTrackEndTimer(groupId, remainingMs);
      }
      this.persistState(groupId, state);
    });
  }

  async loadTrack(groupId: string, userId: string, trackId: string): Promise<void> {
    await this.withGroupLock(groupId, () => {
      const trackInfo = getTrackInfo(trackId);
      if (!trackInfo) return;

      const state = this.getPlaybackState(groupId);
      state.trackId = trackId;
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
    });
  }

  async skip(groupId: string, userId: string): Promise<void> {
    // For simplicity, treating anyone as having skip permissions instantly.
    // In a full implementation, you'd check roles.
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

      const newItem: QueueItem = {
        id: Math.random().toString(36).substring(7),
        trackId,
        title: trackInfo.title,
        artist: trackInfo.artist,
        artworkUrl: trackInfo.artworkUrl,
        durationMs: trackInfo.durationMs,
        addedBy: userId,
        addedByName: 'User',
        position: queue.length
      };

      if (playNext) {
        queue.splice(0, 0, newItem);
      } else {
        queue.push(newItem);
      }

      // Re-index positions
      queue.forEach((item, index) => item.position = index);
      this.queues.set(groupId, queue);
      this.broadcastQueue(groupId);
    });
  }

  async removeFromQueue(groupId: string, userId: string, queueItemId: string): Promise<void> {
    await this.withGroupLock(groupId, () => {
      let queue = this.queues.get(groupId) || [];
      queue = queue.filter(item => item.id !== queueItemId);
      queue.forEach((item, index) => item.position = index);
      this.queues.set(groupId, queue);
      this.broadcastQueue(groupId);
    });
  }

  async reorderQueue(groupId: string, userId: string, queueItemId: string, newPosition: number): Promise<void> {
    await this.withGroupLock(groupId, () => {
      let queue = this.queues.get(groupId) || [];
      const itemIndex = queue.findIndex(item => item.id === queueItemId);
      if (itemIndex === -1) return;

      const [item] = queue.splice(itemIndex, 1);
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
    // In a real app, save to Redis or Postgres
  }

  private loadState(groupId: string): PlaybackState | null {
    // In a real app, load from DB
    return null;
  }

  private broadcastPlaybackState(groupId: string, state: PlaybackState): void {
    this.io.to(groupId).emit('playback:state', state);
  }

  private broadcastQueue(groupId: string): void {
    const queue = this.getQueue(groupId);
    this.io.to(groupId).emit('queue:updated', { queue });
  }
}
