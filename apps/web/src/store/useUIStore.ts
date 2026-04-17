import { create } from 'zustand';

export type SidebarMode = 'channels' | 'dms';

interface UIState {
  activeChannel:        string;
  showMembers:          boolean;
  sidebarMode:          SidebarMode;
  activeDmConversation: string | null;  // active DM conversation ID

  setActiveChannel:        (id: string) => void;
  toggleMembers:           () => void;
  setSidebarMode:          (mode: SidebarMode) => void;
  setActiveDmConversation: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeChannel:        '',
  showMembers:          true,
  sidebarMode:          'channels',
  activeDmConversation: null,

  setActiveChannel:        (id)   => set({ activeChannel: id }),
  toggleMembers:           ()     => set((s) => ({ showMembers: !s.showMembers })),
  setSidebarMode:          (mode) => set({ sidebarMode: mode }),
  setActiveDmConversation: (id)   => set({ activeDmConversation: id }),
}));
