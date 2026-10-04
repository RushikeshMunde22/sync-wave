import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { audioEngine, calculateClockOffset } from '../player/AudioEngine.js';

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  clockOffset: number;
  connect: () => void;
  disconnect: () => void;
  setClockOffset: (offset: number) => void;
  syncClock: () => void;
}

let syncInterval: any = null;

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  clockOffset: 0,

  connect: () => {
    const currentSocket = get().socket;
    if (currentSocket) return;

    const socket = io({
      withCredentials: true,
      transports: ['websocket'],
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected to server:', socket.id);
      set({ isConnected: true });

      // Run initial clock sync series
      get().syncClock();
      if (!syncInterval) {
        syncInterval = setInterval(() => {
          get().syncClock();
        }, 30000);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      set({ isConnected: false });
      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
      }
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  setClockOffset: (offset) => {
    set({ clockOffset: offset });
    audioEngine.setClockOffset(offset);
  },

  syncClock: () => {
    const { socket } = get();
    if (!socket || !socket.connected) return;

    const t0 = Date.now();
    socket.emit('sync:ping', { t0 }, (response: { t0: number; ts: number }) => {
      if (response && typeof response.ts === 'number') {
        const t1 = Date.now();
        const offset = calculateClockOffset(t0, response.ts, t1);
        get().setClockOffset(offset);
      }
    });
  },
}));
