import { create } from 'zustand';

interface UIState {
  activeChannel: string;   // channel ID (dynamic from DB)
  showMembers: boolean;
  setActiveChannel: (id: string) => void;
  toggleMembers: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeChannel: '',   // set by useServerData after channels load
  showMembers: true,
  setActiveChannel: (id) => set({ activeChannel: id }),
  toggleMembers: () => set((s) => ({ showMembers: !s.showMembers })),
}));
