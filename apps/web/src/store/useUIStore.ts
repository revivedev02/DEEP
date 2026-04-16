export type Channel =
  | { id: 'general'; type: 'text';  name: 'general';  topic: 'General chat for the crew' }
  | { id: 'lounge';  type: 'voice'; name: 'lounge';   topic: 'Voice channel — coming soon' };

import { create } from 'zustand';

interface UIState {
  activeChannel: Channel['id'];
  showMembers: boolean;
  setActiveChannel: (id: Channel['id']) => void;
  toggleMembers: () => void;
}

export const CHANNELS: Channel[] = [
  { id: 'general', type: 'text',  name: 'general', topic: 'General chat for the crew' },
  { id: 'lounge',  type: 'voice', name: 'lounge',  topic: 'Voice channel — coming soon' },
];

export const useUIStore = create<UIState>((set) => ({
  activeChannel: 'general',
  showMembers: true,
  setActiveChannel: (id) => set({ activeChannel: id }),
  toggleMembers: () => set((s) => ({ showMembers: !s.showMembers })),
}));
