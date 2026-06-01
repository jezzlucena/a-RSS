import { create } from 'zustand';
import type {
  Entry,
  EntrySummary,
  FeedView,
  FeedOrder,
  FeedResponse,
  BulkMarkReadScope,
  BulkMarkReadResponse,
  ProcessingState,
} from '@a-rss/shared';
import { toast } from 'react-toastify';
import { api } from '@/lib/api';
import { useSourcesStore } from '@/stores/sources';

function refreshSidebarCounts(): void {
  // Fire-and-forget — sidebar counts are advisory.
  void useSourcesStore.getState().refreshUnreadCounts();
}

export type FeedFilter = 'all' | 'unread';

interface FeedState {
  view: FeedView;
  order: FeedOrder;
  filter: FeedFilter;
  entries: Entry[];
  cursor: string | null;
  unreadCount: number;
  loading: boolean;
  error: string | null;
  /** Entry IDs the user explicitly marked unread. Suppresses the auto-mark-on-collapse
   *  behavior in the EntryCard until the entry is re-expanded. */
  manuallyUnreadIds: Set<string>;
  setViewAndOrder: (view: FeedView, order: FeedOrder) => void;
  setFilter: (filter: FeedFilter) => void;
  loadInitial: () => Promise<void>;
  loadMore: () => Promise<void>;
  /** Background, scroll-friendly refresh: merges the latest page into the existing
   *  list in place (no blank-then-refill) so the view never jumps to the top. */
  refresh: () => Promise<void>;
  markBulkRead: (scope: BulkMarkReadScope) => Promise<number>;
  summarizeEntry: (id: string) => Promise<EntrySummary | null>;
  toggleRead: (id: string) => Promise<boolean>;
  /** Card calls this on (re)expansion to restore the default auto-mark-on-collapse. */
  clearManualUnread: (id: string) => void;
  /** Re-enqueue the fetch + image pipeline for a failed entry. */
  retryEntry: (id: string) => Promise<void>;
  /** Trigger a poll cycle for the sources matching the current view, then reload. */
  pollFeed: () => Promise<void>;
  /** True while pollFeed is awaiting agenda jobs to settle. */
  polling: boolean;
}

const PAGE_LIMIT = 30;

async function fetchPage(
  view: FeedView,
  order: FeedOrder,
  filter: FeedFilter,
  cursor: string | null,
): Promise<FeedResponse> {
  const params = new URLSearchParams({ view, order, limit: String(PAGE_LIMIT) });
  if (cursor) params.set('cursor', cursor);
  if (filter === 'unread') params.set('unread', '1');
  return api<FeedResponse>(`/feeds?${params.toString()}`);
}

export const useFeedStore = create<FeedState>((set, get) => ({
  view: 'all',
  order: 'desc',
  filter: 'unread',
  entries: [],
  cursor: null,
  unreadCount: 0,
  loading: false,
  error: null,
  manuallyUnreadIds: new Set<string>(),
  polling: false,

  pollFeed: async () => {
    const { view, order, filter } = get();
    set({ polling: true, error: null });
    try {
      await api<{ enqueued: number }>('/sources/refresh', {
        method: 'POST',
        body: { view },
      });
      // Wait briefly so the agenda jobs queued by the api have time to run their
      // pollSource implementations before we ask for entries again.
      await new Promise((r) => setTimeout(r, 4_000));
      const data = await fetchPage(view, order, filter, null);
      set({ entries: data.entries, cursor: data.nextCursor, unreadCount: data.unreadCount });
    } catch (err) {
      // User-triggered (Fetch button) → transient toast rather than a sticky banner.
      toast.error(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      set({ polling: false });
    }
  },

  clearManualUnread: (id) => {
    const set_ = get().manuallyUnreadIds;
    if (!set_.has(id)) return;
    const copy = new Set(set_);
    copy.delete(id);
    set({ manuallyUnreadIds: copy });
  },

  setViewAndOrder: (view, order) => {
    if (view === get().view && order === get().order) return;
    set({ view, order, entries: [], cursor: null, unreadCount: 0, error: null });
  },

  setFilter: (filter) => {
    if (filter === get().filter) return;
    set({ filter, entries: [], cursor: null, error: null });
  },

  loadInitial: async () => {
    const { view, order, filter } = get();
    set({ loading: true, error: null, entries: [], cursor: null });
    try {
      const data = await fetchPage(view, order, filter, null);
      set({ entries: data.entries, cursor: data.nextCursor, unreadCount: data.unreadCount });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load feed' });
    } finally {
      set({ loading: false });
    }
  },

  loadMore: async () => {
    const { view, order, filter, cursor, loading, entries } = get();
    if (loading || !cursor) return;
    set({ loading: true, error: null });
    try {
      const data = await fetchPage(view, order, filter, cursor);
      set({
        entries: [...entries, ...data.entries],
        cursor: data.nextCursor,
        unreadCount: data.unreadCount,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load more' });
    } finally {
      set({ loading: false });
    }
  },

  refresh: async () => {
    const { view, order, filter, entries, loading } = get();
    // Don't fight an in-flight load/poll; those own the list.
    if (loading || get().polling) return;
    try {
      const data = await fetchPage(view, order, filter, null);

      // Update entries we already have in place — keep their position and any
      // locally-authoritative state (read flag, a summary the user already loaded)
      // so a passive refresh never un-reads an article or drops a summary.
      const incomingById = new Map(data.entries.map((e) => [e.id, e]));
      const merged = entries.map((e) => {
        const fresh = incomingById.get(e.id);
        if (!fresh) return e;
        return { ...fresh, isRead: e.isRead, summary: e.summary ?? fresh.summary };
      });

      // Genuinely-new entries (not yet in the list) go at the front, in server order.
      const existingIds = new Set(entries.map((e) => e.id));
      const fresh = data.entries.filter((e) => !existingIds.has(e.id));

      set({ entries: [...fresh, ...merged], unreadCount: data.unreadCount });
    } catch {
      // Background refresh — surface nothing on failure; the next tick retries.
    }
  },

  toggleRead: async (id) => {
    const entry = get().entries.find((e) => e.id === id);
    if (!entry) return false;
    const next = !entry.isRead;

    // Track explicit-unread intent so the EntryCard can suppress its
    // auto-mark-on-collapse behavior. Marking read clears the flag.
    const manualSet = new Set(get().manuallyUnreadIds);
    if (next === false) manualSet.add(id);
    else manualSet.delete(id);

    // Optimistic update — flip locally and adjust unreadCount.
    set({
      entries: get().entries.map((e) => (e.id === id ? { ...e, isRead: next } : e)),
      unreadCount: Math.max(0, get().unreadCount + (next ? -1 : 1)),
      manuallyUnreadIds: manualSet,
    });
    try {
      await api<{ isRead: boolean }>(`/entries/${id}/read`, {
        method: 'POST',
        body: { read: next },
      });
      refreshSidebarCounts();
      return next;
    } catch (err) {
      // Revert isRead + the manual flag.
      const revertSet = new Set(get().manuallyUnreadIds);
      if (next === false) revertSet.delete(id);
      else if (entry.isRead === false) revertSet.add(id);
      set({
        entries: get().entries.map((e) => (e.id === id ? { ...e, isRead: !next } : e)),
        unreadCount: Math.max(0, get().unreadCount + (next ? 1 : -1)),
        manuallyUnreadIds: revertSet,
      });
      toast.error(err instanceof Error ? err.message : 'Could not update read state');
      return entry.isRead;
    }
  },

  retryEntry: async (id) => {
    try {
      await api(`/entries/${id}/retry`, { method: 'POST' });
      // Optimistically reset to pending; agenda will run processEntry shortly.
      set({
        entries: get().entries.map((e) =>
          e.id === id ? { ...e, processingState: 'pending', error: null } : e,
        ),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retry failed');
    }
  },

  summarizeEntry: async (id) => {
    const existing = get().entries.find((e) => e.id === id);
    if (existing?.summary) return existing.summary;
    try {
      const response = await api<{ summary: EntrySummary; processingState: ProcessingState }>(
        `/entries/${id}/summarize`,
        { method: 'POST' },
      );
      set({
        entries: get().entries.map((e) =>
          e.id === id
            ? { ...e, summary: response.summary, processingState: response.processingState }
            : e,
        ),
      });
      return response.summary;
    } catch {
      // The EntryCard surfaces this inline in the expanded body (contextual),
      // so no global banner/toast here.
      return null;
    }
  },

  markBulkRead: async (scope) => {
    const { view, filter, entries } = get();
    try {
      const result = await api<BulkMarkReadResponse>('/feeds/mark-read', {
        method: 'POST',
        body: { view, scope },
      });
      // Optimistically mark the ones currently visible that match the scope.
      const cutoff =
        scope === 'olderThan1d'
          ? Date.now() - 86_400_000
          : scope === 'olderThan7d'
            ? Date.now() - 7 * 86_400_000
            : Infinity;
      const updated = entries.map((e) =>
        new Date(e.publishedAt).getTime() <= cutoff ? { ...e, isRead: true } : e,
      );
      // In unread-only mode, the just-read entries should drop out of the list.
      const visible = filter === 'unread' ? updated.filter((e) => !e.isRead) : updated;
      set({ entries: visible, unreadCount: Math.max(0, get().unreadCount - result.marked) });
      refreshSidebarCounts();
      return result.marked;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not mark entries read');
      return 0;
    }
  },
}));
