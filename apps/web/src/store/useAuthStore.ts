import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  shortId: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  isAdmin: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  login:        (token: string, user: AuthUser) => void;
  logout:       () => void;
  isAuthenticated: () => boolean;
  updateAvatar:       (avatarUrl: string) => void;
  updateDisplayName:  (displayName: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      login: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      isAuthenticated: () => !!get().token && !!get().user,
      updateAvatar: (avatarUrl) =>
        set((s) => s.user ? { user: { ...s.user, avatarUrl } } : {}),
      updateDisplayName: (displayName) =>
        set((s) => s.user ? { user: { ...s.user, displayName } } : {}),
    }),
    { name: 'pdl-auth' }
  )
);
