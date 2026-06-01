import { create } from 'zustand';

export type ThemePreference = 'system' | 'light' | 'dark';
type Resolved = 'light' | 'dark';

const STORAGE_KEY = 'arss-theme';

// Must match the --color-paper values in index.css (and the inline script in index.html)
// so the mobile browser chrome (theme-color) lines up with the app background.
const BACKGROUND: Record<Resolved, string> = {
  light: '#F4F1EA',
  dark: '#171510',
};

const prefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

function resolve(pref: ThemePreference): Resolved {
  if (pref === 'system') return prefersDark() ? 'dark' : 'light';
  return pref;
}

function apply(resolved: Resolved): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', BACKGROUND[resolved]);
}

function readStored(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'system';
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

interface ThemeState {
  preference: ThemePreference;
  /** The theme actually in effect (preference resolved against the OS). */
  resolved: Resolved;
  setPreference: (pref: ThemePreference) => void;
  /** Re-apply the current preference (call on mount and on OS scheme changes). */
  applyCurrent: () => void;
  /** Flip between explicit light/dark (used by the navbar toggle; never sets system). */
  toggle: () => void;
}

const initialPreference = readStored();

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: initialPreference,
  resolved: resolve(initialPreference),
  setPreference: (pref) => {
    localStorage.setItem(STORAGE_KEY, pref);
    const resolved = resolve(pref);
    apply(resolved);
    set({ preference: pref, resolved });
  },
  applyCurrent: () => {
    const resolved = resolve(get().preference);
    apply(resolved);
    set({ resolved });
  },
  toggle: () => get().setPreference(get().resolved === 'dark' ? 'light' : 'dark'),
}));
