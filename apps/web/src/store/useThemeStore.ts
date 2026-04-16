import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'oled';

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      toggleTheme: () => {
        const next: Theme = get().theme === 'light' ? 'oled' : 'light';
        set({ theme: next });
        applyTheme(next);
      },
    }),
    { name: 'deep-theme' }
  )
);

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}
