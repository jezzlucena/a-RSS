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

// Matches the ids on the <link> boot tags in index.html and the light/dark asset
// pairs in public/ (logo.svg/logo_dark.svg, favicon.ico/favicon_dark.ico, etc).
const FAVICON: Record<'favicon-ico' | 'favicon-svg' | 'apple-touch-icon', Record<Resolved, string>> = {
  'favicon-ico': { light: '/favicon.ico', dark: '/favicon_dark.ico' },
  'favicon-svg': { light: '/logo.svg', dark: '/logo_dark.svg' },
  'apple-touch-icon': { light: '/logo.png', dark: '/logo_dark.png' },
};

function apply(resolved: Resolved): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', BACKGROUND[resolved]);
  for (const [id, hrefs] of Object.entries(FAVICON)) {
    document.getElementById(id)?.setAttribute('href', hrefs[resolved]);
  }
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
