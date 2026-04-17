import { create } from 'zustand';

interface UIState {
  activeChannel:        string;
  showMembers:          boolean;
  activeDmConversation: string | null;  // when set, DM pane is shown instead of channel

  setActiveChannel:        (id: string) => void;
  toggleMembers:           () => void;
  setActiveDmConversation: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeChannel:        '',
  showMembers:          true,
  activeDmConversation: null,

  // Selecting a channel clears any open DM
  setActiveChannel:        (id) => set({ activeChannel: id, activeDmConversation: null }),
  toggleMembers:           ()  => set((s) => ({ showMembers: !s.showMembers })),
  setActiveDmConversation: (id) => set({ activeDmConversation: id }),
}));
