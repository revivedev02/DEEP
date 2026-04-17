import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light' | 'oled';

const THEME_ORDER: Theme[] = ['dark', 'light', 'oled'];

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  cycleTheme: () => void;
  /** @deprecated use cycleTheme */
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      cycleTheme: () => {
        const current = get().theme;
        const idx = THEME_ORDER.indexOf(current);
        const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
        set({ theme: next });
        applyTheme(next);
      },
      toggleTheme: () => {
        // Alias for cycleTheme for backward compat
        const current = get().theme;
        const idx = THEME_ORDER.indexOf(current);
        const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
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
