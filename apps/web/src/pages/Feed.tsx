import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFeedStore } from '@/stores/feed';
import { useSourcesStore } from '@/stores/sources';
import { timeAgo } from '@/lib/timeAgo';
import { api } from '@/lib/api';
import type { Entry, EntryDetail, FeedView } from '@a-rss/shared';

export default function FeedPage() {
  const { viewKind, viewId } = useParams();
  const view = useMemo<FeedView>(() => {
    if (viewKind === 'category' && viewId) return `category:${viewId}` as FeedView;
    if (viewKind === 'source' && viewId) return `source:${viewId}` as FeedView;
    return 'all';
  }, [viewKind, viewId]);

  const order = useFeedStore((s) => s.order);
  const filter = useFeedStore((s) => s.filter);
  const entries = useFeedStore((s) => s.entries);
  const cursor = useFeedStore((s) => s.cursor);
  const loading = useFeedStore((s) => s.loading);
  const unreadCount = useFeedStore((s) => s.unreadCount);
  const error = useFeedStore((s) => s.error);
  const setViewAndOrder = useFeedStore((s) => s.setViewAndOrder);
  const setFilter = useFeedStore((s) => s.setFilter);
  const loadInitial = useFeedStore((s) => s.loadInitial);
  const loadMore = useFeedStore((s) => s.loadMore);
  const markBulkRead = useFeedStore((s) => s.markBulkRead);
  const toggleRead = useFeedStore((s) => s.toggleRead);

  const { categories, sources, load: loadSources } = useSourcesStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Mutual-exclusive expansion: only one card open at a time. Lifted to the page
  // so keyboard shortcuts (j/k/m/f/o) can drive it.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // Reset expansion whenever the underlying view/order/filter changes.
  useEffect(() => {
    setExpandedId(null);
  }, [view, order, filter]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  useEffect(() => {
    setViewAndOrder(view, order);
    void loadInitial();
  }, [view, order, filter, setViewAndOrder, loadInitial]);

  // --- Keyboard navigation -----------------------------------------------
  // Refs let the listener read the latest state without re-attaching on every change.
  const keyStateRef = useRef({ entries, expandedId });
  keyStateRef.current = { entries, expandedId };

  useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
      if (el.isContentEditable) return true;
      return false;
    }

    function expandAtIndex(idx: number, list: Entry[]) {
      const clamped = Math.max(0, Math.min(list.length - 1, idx));
      const target = list[clamped];
      if (target) setExpandedId(target.id);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      const { entries: list, expandedId: current } = keyStateRef.current;
      if (list.length === 0) return;
      const currentIdx = current ? list.findIndex((x) => x.id === current) : -1;

      switch (e.key) {
        case 'j': // expand next (move down)
          e.preventDefault();
          expandAtIndex(currentIdx < 0 ? 0 : currentIdx + 1, list);
          break;
        case 'k': // expand previous (move up)
          e.preventDefault();
          expandAtIndex(currentIdx < 0 ? 0 : currentIdx - 1, list);
          break;
        case 'm': {
          if (!current) return;
          e.preventDefault();
          void toggleRead(current);
          break;
        }
        case 'f': {
          if (!current) return;
          e.preventDefault();
          navigate(`/entries/${current}`);
          break;
        }
        case 'o': {
          if (!current) return;
          const target = list.find((x) => x.id === current);
          if (!target) return;
          e.preventDefault();
          window.open(target.url, '_blank', 'noopener,noreferrer');
          break;
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, toggleRead]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinelRef.current || !cursor) return;
    const obs = new IntersectionObserver(
      (xs) => {
        if (xs.some((x) => x.isIntersecting)) void loadMore();
      },
      { rootMargin: '200px' },
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [cursor, loadMore]);

  const kicker =
    view === 'all'
      ? 'All sources'
      : view.startsWith('category:')
        ? 'Category'
        : 'Source';

  const title =
    view === 'all'
      ? 'All sources'
      : view.startsWith('category:')
        ? categories.find((c) => `category:${c.id}` === view)?.name ?? 'Category'
        : sources.find((s) => `source:${s.id}` === view)?.title ?? 'Source';

  return (
    <div>
      {/* Masthead */}
      <header className="border-b-2 border-ink pb-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="font-mono text-chip uppercase text-muted">
              {kicker}
              <span className="mx-2 text-rule">·</span>
              <span className="text-ink">
                {unreadCount} unread
                {loading && entries.length === 0 ? ' · loading' : ''}
              </span>
            </p>
            <h1 className="font-display mt-3 text-5xl font-semibold leading-[0.95] tracking-tight">
              {title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FetchButton />
            <button
              onClick={() => useFeedStore.setState({ order: order === 'desc' ? 'asc' : 'desc' })}
              className="border border-ink px-4 py-2 font-mono text-chip uppercase text-ink transition-colors hover:bg-ink hover:text-paper focus:bg-ink focus:text-paper"
              title="Toggle sort order"
            >
              <span aria-hidden className="mr-2">{order === 'desc' ? '↓' : '↑'}</span>
              {order === 'desc' ? 'Newest' : 'Oldest'}
            </button>
            <div className="relative">
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value as 'all' | 'unread');
                  void loadInitial();
                }}
                className="appearance-none border border-ink bg-paper px-4 py-2 pr-9 font-mono text-chip uppercase text-ink transition-colors hover:bg-ink hover:text-paper focus:bg-ink focus:text-paper focus:outline-none cursor-pointer"
                title="Filter entries"
              >
                <option value="all">All</option>
                <option value="unread">Unread only</option>
              </select>
              <span
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-chip text-ink"
              >
                ⌄
              </span>
            </div>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="bg-ink px-4 py-2 font-mono text-chip uppercase text-paper transition-colors hover:bg-vermilion-deep focus:bg-vermilion-deep"
              >
                Mark read
                <span aria-hidden className="ml-2">⌄</span>
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-10 mt-1 w-64 border border-ink bg-paper-deep"
                >
                  {(
                    [
                      ['all', 'All entries in this view'],
                      ['olderThan1d', '1 day or older'],
                      ['olderThan7d', '7 days or older'],
                    ] as const
                  ).map(([scope, label]) => (
                    <button
                      key={scope}
                      role="menuitem"
                      className="block w-full border-b border-rule px-4 py-3 text-left text-sm text-ink last:border-b-0 hover:bg-ink hover:text-paper"
                      onClick={async () => {
                        setMenuOpen(false);
                        await markBulkRead(scope);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <p className="mt-4 font-mono text-[11px] uppercase tracking-chip text-muted">
        <Kbd>j</Kbd>/<Kbd>k</Kbd> navigate
        <span className="mx-3 text-rule">·</span>
        <Kbd>m</Kbd> mark read
        <span className="mx-3 text-rule">·</span>
        <Kbd>f</Kbd> full article
        <span className="mx-3 text-rule">·</span>
        <Kbd>o</Kbd> open source
      </p>

      {error && (
        <p
          role="alert"
          className="mt-6 border-l-2 border-vermilion pl-3 text-sm text-vermilion-deep"
        >
          {error}
        </p>
      )}

      {!loading && entries.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="divide-y divide-rule">
          {entries.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              isExpanded={expandedId === e.id}
              onToggle={() => handleToggleExpand(e.id)}
            />
          ))}
        </ul>
      )}

      <div ref={sentinelRef} className="h-8" />
      {loading && entries.length > 0 && (
        <p className="py-6 text-center font-mono text-chip uppercase text-muted">
          Loading more
        </p>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-16 border border-rule px-8 py-16 text-center">
      <p className="font-mono text-chip uppercase text-muted">No copy yet</p>
      <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight">
        The morning edition is empty.
      </h2>
      <p className="mt-3 text-sm text-muted">
        Add a source or wait for the next poll cycle. Stories arrive after the next pass.
      </p>
    </div>
  );
}

function FetchButton() {
  const polling = useFeedStore((s) => s.polling);
  const pollFeed = useFeedStore((s) => s.pollFeed);
  return (
    <button
      type="button"
      onClick={() => void pollFeed()}
      disabled={polling}
      className="border border-ink px-4 py-2 font-mono text-chip uppercase text-ink transition-colors hover:bg-ink hover:text-paper focus:bg-ink focus:text-paper disabled:cursor-progress disabled:opacity-60"
      title="Trigger a poll cycle for this view's sources"
    >
      <span aria-hidden className={`mr-2 inline-block ${polling ? 'animate-spin' : ''}`}>↻</span>
      {polling ? 'Fetching…' : 'Fetch'}
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-1 rounded border border-rule bg-paper-deep px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink">
      {children}
    </kbd>
  );
}

function EntryCard({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: Entry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const summarizeEntry = useFeedStore((s) => s.summarizeEntry);
  const toggleRead = useFeedStore((s) => s.toggleRead);
  const retryEntry = useFeedStore((s) => s.retryEntry);
  const [summarizing, setSummarizing] = useState(false);
  const [summarizeError, setSummarizeError] = useState<string | null>(null);
  // Fallback article body: when summarize fails or there's nothing to summarize,
  // fetch the full extracted text from /entries/:id and render it inline.
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [loadingFallback, setLoadingFallback] = useState(false);

  const cardRef = useRef<HTMLLIElement>(null);

  // Keep a ref to the latest entry so the collapse-cleanup can read fresh isRead state
  // (e.g. if the user pressed `m` to unmark while expanded, we should respect that).
  const entryRef = useRef(entry);
  entryRef.current = entry;

  const intro = entry.summary?.intro ?? null;
  const bullets = entry.summary?.bullets;
  const canExpand = entry.processingState !== 'failed';

  // React to expansion. On expand: scroll into view, restore default
  // auto-mark-on-collapse behavior, kick off summarization. On collapse (the cleanup):
  // if the entry is still unread AND the user hasn't explicitly marked it unread during
  // this expansion, mark it read — that's the "navigated away from" signal.
  useEffect(() => {
    if (!isExpanded) {
      setSummarizeError(null);
      setFallbackText(null);
      setLoadingFallback(false);
      return;
    }
    // (Re)expansion resets the "user wants this unread" flag, so a subsequent collapse
    // without explicit user action will mark it read by default.
    useFeedStore.getState().clearManualUnread(entry.id);

    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!entry.summary && entry.processingState === 'fetched') {
      setSummarizing(true);
      summarizeEntry(entry.id)
        .then((res) => {
          if (!res) setSummarizeError('Could not summarize this article.');
        })
        .catch((err) =>
          setSummarizeError(err instanceof Error ? err.message : 'Could not summarize.'),
        )
        .finally(() => setSummarizing(false));
    }
    return () => {
      // Runs when isExpanded transitions true → false, or on unmount while expanded.
      const latest = entryRef.current;
      const manuallyUnread = useFeedStore.getState().manuallyUnreadIds.has(latest.id);
      if (!manuallyUnread && !latest.isRead) {
        void toggleRead(latest.id);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  // Fallback article body: when expanded and we won't have bullets, fetch the
  // full extracted text from the detail endpoint so the card still has something
  // to read. Skips if a summary is present, while summarizing is in flight, or
  // before the article has been fetched at all.
  useEffect(() => {
    if (!isExpanded) return;
    if (entry.summary) return;
    if (summarizing) return;
    if (entry.processingState === 'pending') return;
    if (fallbackText !== null || loadingFallback) return;

    let cancelled = false;
    setLoadingFallback(true);
    api<EntryDetail>(`/entries/${entry.id}`)
      .then((data) => {
        if (cancelled) return;
        setFallbackText(data.articleText?.trim() || '');
      })
      .catch(() => {
        if (cancelled) return;
        setFallbackText('');
      })
      .finally(() => {
        if (!cancelled) setLoadingFallback(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isExpanded, entry.summary, summarizing, entry.processingState, fallbackText, loadingFallback, entry.id]);

  return (
    <li
      ref={cardRef}
      className={`py-10 transition-opacity ${
        entry.isRead ? 'opacity-40' : 'opacity-100'
      } ${isExpanded ? 'scroll-mt-6' : ''}`}
    >
      {/* Metadata row */}
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-mono text-chip uppercase text-muted">
          <span className="text-ink">{entry.sourceTitle}</span>
          <span className="mx-2 text-rule">·</span>
          {timeAgo(entry.publishedAt)}
          {entry.processingState === 'pending' && (
            <>
              <span className="mx-2 text-rule">·</span>
              <span className="text-muted">fetching</span>
            </>
          )}
          {entry.processingState === 'failed' && (
            <>
              <span className="mx-2 text-rule">·</span>
              <span className="text-vermilion-deep">fetch failed</span>
              <button
                type="button"
                onClick={() => void retryEntry(entry.id)}
                className="ml-3 inline-flex items-center gap-1 text-vermilion-deep underline underline-offset-[3px] hover:no-underline hover:text-vermilion focus:no-underline focus:text-vermilion"
                title="Re-fetch this article"
              >
                <span aria-hidden>↻</span> Retry
              </button>
            </>
          )}
        </p>
        {!entry.isRead && (
          <span
            aria-label="Unread"
            className="block h-2 w-2 flex-none rounded-full bg-vermilion"
          />
        )}
      </div>

      {/* Image above title, centered with a max-width — both clickable to toggle expansion. */}
      <div className="mt-3">
        {entry.image?.url && (
          <button
            type="button"
            onClick={onToggle}
            disabled={!canExpand}
            aria-label={isExpanded ? 'Collapse article' : 'Expand article'}
            className="mx-auto mb-5 block w-full max-w-md disabled:cursor-not-allowed"
          >
            <img
              src={entry.image.url}
              alt=""
              loading="lazy"
              className={`aspect-[4/3] w-full object-cover ring-1 transition-shadow hover:ring-2 hover:ring-vermilion ${
                isExpanded ? 'ring-vermilion' : 'ring-rule'
              }`}
            />
          </button>
        )}
        <h2 className="font-display mx-auto w-fit max-w-full text-left text-3xl font-semibold leading-[1.15] tracking-tight">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (canExpand) onToggle();
            }}
            aria-expanded={isExpanded}
            aria-disabled={!canExpand || undefined}
            role="button"
            className={`text-ink decoration-2 underline-offset-[6px] hover:underline hover:decoration-vermilion focus:underline focus:decoration-vermilion ${
              !canExpand ? 'pointer-events-none cursor-not-allowed text-muted' : 'cursor-pointer'
            } ${isExpanded ? 'underline decoration-vermilion' : 'decoration-rule'}`}
          >
            {entry.title}
          </a>
        </h2>

        {entry.processingState === 'failed' && entry.error && (
          <p className="mx-auto mt-3 w-fit max-w-full break-words text-left font-mono text-[12px] leading-[1.5] text-vermilion-deep">
            {entry.error}
          </p>
        )}
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div>
          {summarizing && (
            <p className="mt-5 font-mono text-chip uppercase text-muted">
              Summarizing… (Claude is reading the article)
            </p>
          )}

          {summarizeError && !summarizing && (
            <p className="mt-5 font-mono text-chip uppercase text-vermilion-deep">
              {summarizeError}
            </p>
          )}

          {intro && (
            <p className="font-display mt-4 text-[16.5px] italic leading-[1.5] text-ink/85">
              {intro}
            </p>
          )}

          {bullets && (
            <ul className="mt-5 space-y-2.5">
              {bullets.map((b, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[1.5em_1fr] items-baseline gap-2 text-[15.5px] leading-[1.55] text-ink"
                >
                  <span aria-hidden className="font-display text-vermilion">
                    —
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {!bullets && !summarizing && loadingFallback && (
            <p className="mt-5 font-mono text-chip uppercase text-muted">
              Loading article…
            </p>
          )}

          {!bullets && !summarizing && fallbackText && (
            <pre className="font-display mt-5 whitespace-pre-wrap break-words text-[15.5px] leading-[1.55] text-ink">
              {fallbackText}
            </pre>
          )}

          {!summarizing && !bullets && entry.processingState === 'pending' && (
            <p className="mt-5 font-display text-[15.5px] italic text-muted">
              Article is still being fetched. Try again in a moment.
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link
              to={`/entries/${entry.id}`}
              className="inline-flex items-center gap-2 font-mono text-chip uppercase text-ink transition-colors hover:text-vermilion focus:text-vermilion"
            >
              Full article
              <span aria-hidden>↗</span>
            </Link>
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-mono text-chip uppercase text-muted transition-colors hover:text-ink focus:text-ink"
            >
              Open source
              <span aria-hidden>↗</span>
            </a>
          </div>
        </div>
      )}
    </li>
  );
}
