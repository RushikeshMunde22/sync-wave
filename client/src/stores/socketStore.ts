import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  clockOffset: number;
  connect: () => void;
  disconnect: () => void;
  setClockOffset: (offset: number) => void;
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
    });

    socket.on('connect', () => set({ isConnected: true }));
    socket.on('disconnect', () => set({ isConnected: false }));

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  setClockOffset: (offset) => set({ clockOffset: offset }),
}));
