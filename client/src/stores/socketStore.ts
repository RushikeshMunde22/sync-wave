import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { audioEngine, calculateClockOffset } from '../player/AudioEngine.js';

export interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  clockOffset: number;
  connect: () => void;
  disconnect: () => void;
  setClockOffset: (offset: number) => void;
  syncClock: () => void;
}

let syncInterval: any = null;

export function getEstimatedServerTime(): number {
  return Date.now() + useSocketStore.getState().clockOffset;
}

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

      // Run initial multi-sample clock sync burst
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

  syncClock: async () => {
    const { socket } = get();
    if (!socket || !socket.connected) return;

    const samples: Array<{ rtt: number; offset: number }> = [];
    const NUM_SAMPLES = 5;

    for (let i = 0; i < NUM_SAMPLES; i++) {
      if (!socket.connected) break;
      const t0 = Date.now();
      try {
        await new Promise<void>((resolve) => {
          socket.emit('sync:ping', { t0 }, (response: { t0: number; ts: number }) => {
            if (response && typeof response.ts === 'number') {
              const t1 = Date.now();
              const rtt = Math.max(0, t1 - t0);
              const offset = calculateClockOffset(t0, response.ts, t1);
              samples.push({ rtt, offset });
            }
            resolve();
          });
          // Timeout protection per ping
          setTimeout(resolve, 800);
        });
      } catch {}

      if (i < NUM_SAMPLES - 1) {
        await new Promise((r) => setTimeout(r, 80));
      }
    }

    if (samples.length > 0) {
      // Sort by RTT ascending to prioritize lowest jitter/latency samples
      samples.sort((a, b) => a.rtt - b.rtt);
      // Select best subset (lowest RTTs) and compute median offset
      const bestSamples = samples.slice(0, Math.ceil(samples.length / 2) + 1);
      bestSamples.sort((a, b) => a.offset - b.offset);
      const medianOffset = Math.round(bestSamples[Math.floor(bestSamples.length / 2)]!.offset);
      
      const debugMode = typeof window !== 'undefined' && 
        (window.location.search.includes('debug=sync') || localStorage.getItem('SYNC_DEBUG') === '1');
      if (debugMode) {
        console.log(`[SyncDebug] Clock Offset estimated: ${medianOffset}ms (from ${samples.length} samples, min RTT: ${samples[0]?.rtt}ms)`);
      }
      get().setClockOffset(medianOffset);
    }
  },
}));
