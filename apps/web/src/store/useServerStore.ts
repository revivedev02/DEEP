import { create } from 'zustand';

export interface Channel {
  id:       string;
  name:     string;
  type:     'text' | 'voice';
  position: number;
}

interface ServerState {
  serverName: string;
  channels:   Channel[];
  isLoading:  boolean;
  setServerName: (name: string) => void;
  setChannels:   (channels: Channel[]) => void;
  setLoading:    (v: boolean) => void;
  addChannel:    (ch: Channel) => void;
  updateChannel: (id: string, data: Partial<Channel>) => void;
  removeChannel: (id: string) => void;
}

export const useServerStore = create<ServerState>((set) => ({
  serverName: 'DEEP',
  channels:   [],
  isLoading:  true,

  setServerName: (serverName) => set({ serverName }),
  setLoading:    (v) => set({ isLoading: v }),
  setChannels: (channels) =>
    set({ channels: [...channels].sort((a, b) => a.position - b.position) }),

  addChannel: (ch) =>
    set((s) => ({
      channels: [...s.channels, ch].sort((a, b) => a.position - b.position),
    })),

  updateChannel: (id, data) =>
    set((s) => ({
      channels: s.channels.map((c) => (c.id === id ? { ...c, ...data } : c)),
    })),

  removeChannel: (id) =>
    set((s) => ({ channels: s.channels.filter((c) => c.id !== id) })),
}));
