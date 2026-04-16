import { create } from 'zustand';

export interface MemberEntry {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
}

interface MembersState {
  members: MemberEntry[];
  setMembers: (m: MemberEntry[]) => void;
  updateMemberAvatar: (userId: string, avatarUrl: string) => void;
}

export const useMembersStore = create<MembersState>((set) => ({
  members: [],
  setMembers: (members) => set({ members }),
  updateMemberAvatar: (userId, avatarUrl) =>
    set((s) => ({
      members: s.members.map((m) =>
        m.id === userId ? { ...m, avatarUrl } : m
      ),
    })),
}));
