import { create } from 'zustand';

export interface ProfileUser {
  id:          string;
  displayName: string;
  username:    string;
  avatarUrl:   string | null;
  bannerUrl:   string | null;
  isAdmin:     boolean;
}

interface ProfileCardState {
  visible: boolean;
  user:    ProfileUser | null;
  rect:    DOMRect | null;

  open:  (user: ProfileUser, rect: DOMRect) => void;
  close: () => void;
}

export const useProfileCardStore = create<ProfileCardState>((set) => ({
  visible: false,
  user:    null,
  rect:    null,

  open:  (user, rect) => set({ visible: true, user, rect }),
  close: ()           => set({ visible: false }),
}));
