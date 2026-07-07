import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { useSourcesStore } from '@/stores/sources';
import { useFeedStore } from '@/stores/feed';
import { useThemeStore } from '@/stores/theme';

const topNavClass = ({ isActive }: { isActive: boolean }) =>
  `font-mono text-chip uppercase px-1 py-1 transition-colors ${
    isActive
      ? 'text-vermilion underline decoration-vermilion decoration-2 underline-offset-[6px]'
      : 'text-ink hover:text-vermilion'
  }`;

const sideNavClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 py-1.5 text-sm transition-colors ${
    isActive
      ? 'text-ink font-medium border-l-2 border-vermilion pl-3 -ml-[2px]'
      : 'text-muted hover:text-ink pl-3 border-l-2 border-transparent -ml-[2px]'
  }`;

// Section titles ("Categories", "Sources") double as links to their management pages.
const sectionLinkClass = ({ isActive }: { isActive: boolean }) =>
  `mt-8 flex items-center font-mono text-chip uppercase transition-colors ${
    isActive ? 'text-vermilion' : 'text-muted hover:text-ink'
  }`;

export function Layout({ children }: { children: ReactNode }) {
  const me = useAuthStore((s) => s.me);
  const logout = useAuthStore((s) => s.logout);
  const { categories, sources, unreadCounts, load } = useSourcesStore();

  const loadInitial = useFeedStore((s) => s.loadInitial);

  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const logoSrc = useThemeStore((s) => s.resolved) === 'dark' ? '/logo_dark.svg' : '/logo.svg';

  // Clicking a sidebar feed link that points to the route you're already on is a
  // no-op for the router, so re-fetch the feed explicitly — that's the reload.
  const reloadIfActive = (e: MouseEvent, to: string) => {
    setSidebarOpen(false);
    if (location.pathname === to) {
      e.preventDefault();
      void loadInitial();
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-close the mobile panel on any route navigation.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Escape closes the panel.
  useEffect(() => {
    if (!sidebarOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSidebarOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  const sidebarContent = (
    <>
      <nav className="border-l-2 border-rule">
        <NavLink
          to="/feed/all"
          end
          className={sideNavClass}
          onClick={(e) => reloadIfActive(e, '/feed/all')}
        >
          <span className="min-w-0 flex-1 truncate">All sources</span>
          <UnreadBadge count={unreadCounts.all} />
        </NavLink>
      </nav>

      {/* Title links to the Categories management page; kept visible even when empty. */}
      <NavLink to="/categories" className={sectionLinkClass}>
        Categories
      </NavLink>
      {categories.length > 0 && (
        <nav className="mt-3 border-l-2 border-rule">
          {categories.map((c) => (
            <NavLink
              key={c.id}
              to={`/feed/category/${c.id}`}
              className={sideNavClass}
              onClick={(e) => reloadIfActive(e, `/feed/category/${c.id}`)}
            >
              <span
                className="inline-block h-1.5 w-1.5 flex-none rounded-full"
                style={{ background: c.color ?? '#6E665A' }}
              />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <UnreadBadge count={unreadCounts.categories[c.id] ?? 0} />
            </NavLink>
          ))}
        </nav>
      )}

      {/* Title links to the Sources management page; kept visible even when empty. */}
      <NavLink to="/sources" className={sectionLinkClass}>
        Sources
      </NavLink>
      {sources.length > 0 && (
        <nav className="mt-3 border-l-2 border-rule">
          {sources.map((s) => (
            <NavLink
              key={s.id}
              to={`/feed/source/${s.id}`}
              className={sideNavClass}
              onClick={(e) => reloadIfActive(e, `/feed/source/${s.id}`)}
            >
              <span className="min-w-0 flex-1 truncate">{s.title}</span>
              <UnreadBadge count={unreadCounts.sources[s.id] ?? 0} />
            </NavLink>
          ))}
        </nav>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b-2 border-ink bg-paper">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <NavLink
            to="/feed/all"
            onClick={(e) => {
              // Below lg the navbar is logo-only, so the logo doubles as the menu
              // opener — same as the floating hamburger.
              if (!window.matchMedia('(min-width: 1024px)').matches) {
                e.preventDefault();
                setSidebarOpen(true);
              }
            }}
            className="group flex items-center"
          >
            <img src={logoSrc} alt="" className="h-7 w-7 mr-2" />
            <span className="font-display text-2xl font-semibold leading-none tracking-tight">
              a<span className="italic text-vermilion">—</span>RSS
            </span>
          </NavLink>
          <span className="hidden h-4 w-px bg-rule lg:block" />
          {/* On small screens the navbar collapses to the logo; everything below
              moves into the retractable sidebar (see the mobile panel). */}
          <nav className="hidden flex-1 items-center gap-6 overflow-x-auto lg:flex">
            <NavLink to="/feed/all" className={topNavClass}>Feed</NavLink>
            <NavLink to="/sources" className={topNavClass}>Sources</NavLink>
            <NavLink to="/categories" className={topNavClass}>Categories</NavLink>
            <NavLink to="/settings" className={topNavClass}>Settings</NavLink>
          </nav>
          <ThemeToggle />
          <span className="ml-auto hidden font-mono text-chip uppercase text-muted lg:inline">
            {me?.email}
          </span>
          <button
            onClick={() => logout()}
            className="hidden font-mono text-chip uppercase text-muted hover:text-vermilion lg:inline-block"
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-10 px-6 py-6">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 flex-none lg:block">{sidebarContent}</aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile sliding panel + backdrop */}
      <div
        aria-hidden={!sidebarOpen}
        onClick={() => setSidebarOpen(false)}
        className={`fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        aria-hidden={!sidebarOpen}
        aria-label="Navigation"
        className={`fixed left-0 top-0 z-50 flex h-full w-72 max-w-[85vw] flex-col bg-paper p-6 pt-3 shadow-2xl border-r-2 border-ink transition-transform duration-200 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 flex items-center">
          <NavLink
            to="/feed/all"
            className="flex items-center font-display text-2xl font-semibold tracking-tight"
            onClick={(e) => reloadIfActive(e, '/feed/all')}
          >
            <img src={logoSrc} alt="" className="h-7 w-7 mr-2" />
            a<span className="italic text-vermilion">—</span>RSS
          </NavLink>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{sidebarContent}</div>
        {/* Account actions relocated from the (now logo-only) top navbar. */}
        <nav className="mt-4 flex flex-col border-t-2 border-rule pt-4">
          <NavLink to="/settings" className={sideNavClass}>
            <span className="min-w-0 flex-1 truncate">Settings</span>
          </NavLink>
          <button
            type="button"
            onClick={() => logout()}
            className="-ml-[2px] flex items-center gap-2 border-l-2 border-transparent py-1.5 pl-3 text-left text-sm text-muted transition-colors hover:text-vermilion"
          >
            <span className="min-w-0 flex-1 truncate">Sign out</span>
          </button>
        </nav>
      </aside>

      {/* Floating toggle — only on screens without the desktop sidebar. Morphs
          between a hamburger (closed) and an X (open). Sits above the panel so it
          stays tappable to close. */}
      <button
        type="button"
        onClick={() => setSidebarOpen((v) => !v)}
        aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={sidebarOpen}
        className="fixed right-4 bottom-4 z-[60] flex h-10 w-10 items-center justify-center rounded-full text-ink bg-paper/60 backdrop-blur-sm border-2 border-ink transition-all hover:bg-vermilion-deep focus:bg-vermilion-deep lg:hidden"
      >
        <span className="relative block h-3 w-4" aria-hidden>
          <span
            className={`absolute left-0 block h-0.5 w-[100%] rounded-full bg-current transition-all duration-300 ${
              sidebarOpen ? 'top-1/2 -translate-y-1/2 rotate-45' : 'top-0'
            }`}
          />
          <span
            className={`absolute left-0 top-1/2 block h-0.5 w-[100%] -translate-y-1/2 rounded-full bg-current transition-opacity duration-300 ${
              sidebarOpen ? 'opacity-0' : 'opacity-100'
            }`}
          />
          <span
            className={`absolute left-0 block h-0.5 w-[100%] rounded-full bg-current transition-all duration-300 ${
              sidebarOpen ? 'bottom-1/2 translate-y-1/2 -rotate-45' : 'bottom-0'
            }`}
          />
        </span>
      </button>
    </div>
  );
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="flex-none font-mono text-[10px] tabular-nums text-muted"
      title={`${count} unread`}
    >
      {count > 999 ? '999+' : count}
    </span>
  );
}

// Cycles between explicit light/dark (System is reachable from Settings). The sun and
// moon are stacked and cross-fade with a rotate/scale so the swap feels like a morph.
function ThemeToggle() {
  const resolved = useThemeStore((s) => s.resolved);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = resolved === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="ml-auto flex h-9 w-9 flex-none items-center justify-center border border-ink text-ink transition-colors hover:bg-ink hover:text-paper"
    >
      <span className="relative block h-5 w-5">
        {/* Sun — visible in light mode */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
          className={`absolute inset-0 h-5 w-5 transition-all duration-300 ${
            isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
          }`}
        >
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 1.8v2.4M12 19.8v2.4M1.8 12h2.4M19.8 12h2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M19.4 4.6l-1.7 1.7M6.3 17.7l-1.7 1.7" />
        </svg>
        {/* Moon — visible in dark mode */}
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
          className={`absolute inset-0 h-5 w-5 transition-all duration-300 ${
            isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
          }`}
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
        </svg>
      </span>
    </button>
  );
}
