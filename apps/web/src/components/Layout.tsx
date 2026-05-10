import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { useSourcesStore } from '@/stores/sources';

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

export function Layout({ children }: { children: ReactNode }) {
  const me = useAuthStore((s) => s.me);
  const logout = useAuthStore((s) => s.logout);
  const { categories, sources, unreadCounts, load } = useSourcesStore();

  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      <p className="font-mono text-chip uppercase text-muted">Streams</p>
      <nav className="mt-3 border-l border-rule">
        <NavLink to="/feed/all" className={sideNavClass} end>
          <span className="min-w-0 flex-1 truncate">All sources</span>
          <UnreadBadge count={unreadCounts.all} />
        </NavLink>
      </nav>
      {categories.length > 0 && (
        <>
          <p className="mt-8 font-mono text-chip uppercase text-muted">Categories</p>
          <nav className="mt-3 border-l border-rule">
            {categories.map((c) => (
              <NavLink key={c.id} to={`/feed/category/${c.id}`} className={sideNavClass}>
                <span
                  className="inline-block h-1.5 w-1.5 flex-none rounded-full"
                  style={{ background: c.color ?? '#6E665A' }}
                />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <UnreadBadge count={unreadCounts.categories[c.id] ?? 0} />
              </NavLink>
            ))}
          </nav>
        </>
      )}
      {sources.length > 0 && (
        <>
          <p className="mt-8 font-mono text-chip uppercase text-muted">Sources</p>
          <nav className="mt-3 border-l border-rule">
            {sources.map((s) => (
              <NavLink key={s.id} to={`/feed/source/${s.id}`} className={sideNavClass}>
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                <UnreadBadge count={unreadCounts.sources[s.id] ?? 0} />
              </NavLink>
            ))}
          </nav>
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-ink bg-paper">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <NavLink to="/feed/all" className="group flex items-baseline gap-1">
            <span className="font-display text-2xl font-semibold leading-none tracking-tight">
              a<span className="italic text-vermilion">—</span>RSS
            </span>
          </NavLink>
          <span className="hidden h-4 w-px bg-rule sm:block" />
          <nav className="flex flex-1 items-center gap-6 overflow-x-auto">
            <NavLink to="/feed/all" className={topNavClass}>Feed</NavLink>
            <NavLink to="/sources" className={topNavClass}>Sources</NavLink>
            <NavLink to="/categories" className={topNavClass}>Categories</NavLink>
            <NavLink to="/settings" className={topNavClass}>Settings</NavLink>
          </nav>
          <span className="hidden font-mono text-chip uppercase text-muted md:inline">
            {me?.email}
          </span>
          <button
            onClick={() => logout()}
            className="font-mono text-chip uppercase text-muted hover:text-vermilion"
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-10 px-6 py-10">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 flex-none lg:block">{sidebarContent}</aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile sliding panel + backdrop */}
      <div
        aria-hidden={!sidebarOpen}
        onClick={() => setSidebarOpen(false)}
        className={`fixed inset-0 z-40 bg-ink/40 transition-opacity duration-200 lg:hidden ${
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        aria-hidden={!sidebarOpen}
        aria-label="Navigation"
        className={`fixed left-0 top-0 z-50 flex h-full w-72 max-w-[85vw] flex-col bg-paper p-6 shadow-2xl transition-transform duration-200 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <span className="font-display text-xl font-semibold tracking-tight">
            a<span className="italic text-vermilion">—</span>RSS
          </span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="font-mono text-chip uppercase text-muted hover:text-ink"
            aria-label="Close navigation"
          >
            Close ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{sidebarContent}</div>
      </aside>

      {/* Floating action button — only on screens without the desktop sidebar */}
      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation"
          className="fixed bottom-6 left-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-paper shadow-lg transition-colors hover:bg-vermilion-deep focus:bg-vermilion-deep lg:hidden"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
            <line x1="4" y1="7" x2="18" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="4" y1="11" x2="18" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="4" y1="15" x2="18" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}
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
