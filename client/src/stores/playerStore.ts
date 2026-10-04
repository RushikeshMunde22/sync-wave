import { create } from 'zustand';

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  artworkUrl: string;
  sourceUrl: string;
}

interface PlaybackState {
  isPlaying: boolean;
  position: number;
  updatedAt: number;
  trackId: string | null;
  groupId: string | null;
}

interface PlayerState {
  playbackState: PlaybackState;
  queue: Track[];
  presence: any[];
  groupInfo: any;
  setPlaybackState: (state: Partial<PlaybackState>) => void;
  setQueue: (queue: Track[]) => void;
  setGroupInfo: (info: any) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  playbackState: {
    isPlaying: false,
    position: 0,
    updatedAt: Date.now(),
    trackId: null,
    groupId: null,
  },
  queue: [],
  presence: [],
  groupInfo: null,

  setPlaybackState: (state) => set((prev) => ({
    playbackState: { ...prev.playbackState, ...state, updatedAt: Date.now() }
  })),
  setQueue: (queue) => set({ queue }),
  setGroupInfo: (groupInfo) => set({ groupInfo }),
}));
