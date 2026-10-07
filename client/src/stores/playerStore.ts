import { create } from 'zustand';

export interface TrackInfo {
  id: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  durationMs: number;
  streamUrl?: string;
  addedBy?: string;
  attribution?: string;
  mediaType?: 'audio' | 'video';
  videoId?: string;
}

export interface PlaybackState {
  trackId: string | null;
  isPlaying: boolean;
  positionMs: number;
  serverTimeMs: number;
  version: number;
  controlledBy: string | null;
  track?: TrackInfo;
  mediaType?: 'audio' | 'video';
  videoId?: string;
}

export interface MemberPresence {
  userId: string;
  displayName: string;
  avatarEmoji: string;
  avatarColor: string;
  role: string;
  status: 'listening' | 'paused' | 'buffering';
}

export interface QueueItem {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  durationMs: number;
  addedBy: string;
  addedByName: string;
  position: number;
}

export interface SongRequest {
  id: string;
  groupId: string;
  trackId: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  durationMs: number;
  mediaType?: 'audio' | 'video';
  videoId?: string;
  requestedBy: string;
  requestedByName: string;
  createdAt: number;
}

export interface RoomState {
  groupId: string;
  groupName: string;
  inviteCode?: string;
  theme?: string;
  mediaMode?: 'music' | 'video' | 'both';
  playback: PlaybackState;
  queue: QueueItem[];
  members: MemberPresence[];
  membersCanControl: boolean;
  myRole: string;
  songRequests?: SongRequest[];
}

export interface SkipVoteState {
  votesNeeded: number;
  currentVotes: number;
  voters: string[];
}

export interface ReactionItem {
  id: string;
  userId: string;
  userName: string;
  emoji: string;
  timestamp: number;
}

interface PlayerStoreState {
  roomState: RoomState | null;
  playback: PlaybackState;
  queue: QueueItem[];
  members: MemberPresence[];
  songRequests: SongRequest[];
  isLocallyPaused: boolean;
  isAdminPaused: boolean;
  adminPausedBy: string | null;
  autoplayBlocked: boolean;
  skipVote: SkipVoteState | null;
  reactions: ReactionItem[];
  currentTimeMs: number;
  durationMs: number;

  setRoomState: (roomState: RoomState) => void;
  setPlayback: (playback: PlaybackState) => void;
  setQueue: (queue: QueueItem[]) => void;
  setMembers: (members: MemberPresence[]) => void;
  setSongRequests: (songRequests: SongRequest[]) => void;
  addMember: (member: MemberPresence) => void;
  removeMember: (userId: string) => void;
  updateMemberStatus: (userId: string, status: 'listening' | 'paused' | 'buffering') => void;
  setLocallyPaused: (paused: boolean) => void;
  setAdminPaused: (paused: boolean, adminName?: string | null) => void;
  setAutoplayBlocked: (blocked: boolean) => void;
  setSkipVote: (skipVote: SkipVoteState | null) => void;
  addReaction: (reaction: { userId: string; userName: string; emoji: string }) => void;
  setTime: (currentMs: number, durationMs: number) => void;
  resetRoom: () => void;
}

export const usePlayerStore = create<PlayerStoreState>((set) => ({
  roomState: null,
  playback: {
    trackId: null,
    isPlaying: false,
    positionMs: 0,
    serverTimeMs: 0,
    version: 0,
    controlledBy: null,
  },
  queue: [],
  members: [],
  songRequests: [],
  isLocallyPaused: false,
  isAdminPaused: false,
  adminPausedBy: null,
  autoplayBlocked: false,
  skipVote: null,
  reactions: [],
  currentTimeMs: 0,
  durationMs: 0,

  setRoomState: (roomState) =>
    set({
      roomState,
      playback: roomState.playback,
      queue: roomState.queue,
      members: roomState.members,
      songRequests: roomState.songRequests || [],
      isLocallyPaused: false,
      isAdminPaused: !roomState.playback.isPlaying && roomState.playback.controlledBy !== null,
    }),

  setPlayback: (playback) =>
    set((prev) => ({
      playback,
      durationMs: playback.track?.durationMs ?? prev.durationMs,
      // If server resumed, clear admin paused banner
      isAdminPaused: playback.isPlaying ? false : prev.isAdminPaused,
    })),

  setQueue: (queue) => set({ queue }),

  setMembers: (members) => set({ members }),

  setSongRequests: (songRequests) => set({ songRequests }),

  addMember: (member) =>
    set((prev) => {
      const filtered = prev.members.filter((m) => m.userId !== member.userId);
      return { members: [...filtered, member] };
    }),

  removeMember: (userId) =>
    set((prev) => ({
      members: prev.members.filter((m) => m.userId !== userId),
    })),

  updateMemberStatus: (userId, status) =>
    set((prev) => ({
      members: prev.members.map((m) =>
        m.userId === userId ? { ...m, status } : m
      ),
    })),

  setLocallyPaused: (paused) => set({ isLocallyPaused: paused }),

  setAdminPaused: (paused, adminName = null) =>
    set({
      isAdminPaused: paused,
      adminPausedBy: adminName,
    }),

  setAutoplayBlocked: (blocked) => set({ autoplayBlocked: blocked }),

  setSkipVote: (skipVote) => set({ skipVote }),

  addReaction: (reaction) =>
    set((prev) => {
      const item: ReactionItem = {
        id: `${Date.now()}-${Math.random()}`,
        userId: reaction.userId,
        userName: reaction.userName,
        emoji: reaction.emoji,
        timestamp: Date.now(),
      };
      // Keep only reactions from the last 8 seconds
      const now = Date.now();
      const recent = prev.reactions
        .filter((r) => now - r.timestamp < 8000)
        .slice(-15);
      return { reactions: [...recent, item] };
    }),

  setTime: (currentTimeMs, durationMs) =>
    set({ currentTimeMs, durationMs }),

  resetRoom: () =>
    set({
      roomState: null,
      playback: {
        trackId: null,
        isPlaying: false,
        positionMs: 0,
        serverTimeMs: 0,
        version: 0,
        controlledBy: null,
      },
      queue: [],
      members: [],
      songRequests: [],
      isLocallyPaused: false,
      isAdminPaused: false,
      adminPausedBy: null,
      autoplayBlocked: false,
      skipVote: null,
      reactions: [],
      currentTimeMs: 0,
      durationMs: 0,
    }),
}));
