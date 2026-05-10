import { create } from 'zustand';
import type {
  Category,
  Source,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  CreateSourceRequest,
  UpdateSourceRequest,
  OpmlImportResponse,
} from '@a-rss/shared';
import { api } from '@/lib/api';

export interface UnreadCounts {
  all: number;
  categories: Record<string, number>;
  sources: Record<string, number>;
}

interface SourcesState {
  categories: Category[];
  sources: Source[];
  unreadCounts: UnreadCounts;
  loading: boolean;
  load: () => Promise<void>;
  refreshUnreadCounts: () => Promise<void>;
  createCategory: (input: CreateCategoryRequest) => Promise<void>;
  updateCategory: (id: string, input: UpdateCategoryRequest) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  createSource: (input: CreateSourceRequest) => Promise<void>;
  updateSource: (id: string, input: UpdateSourceRequest) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;
  refreshSource: (id: string) => Promise<void>;
  importOpml: (xml: string) => Promise<OpmlImportResponse>;
}

const EMPTY_COUNTS: UnreadCounts = { all: 0, categories: {}, sources: {} };

export const useSourcesStore = create<SourcesState>((set, get) => ({
  categories: [],
  sources: [],
  unreadCounts: EMPTY_COUNTS,
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const [categories, sources, counts] = await Promise.all([
        api<Category[]>('/categories'),
        api<Source[]>('/sources'),
        api<UnreadCounts>('/feeds/unread-counts').catch(() => EMPTY_COUNTS),
      ]);
      set({ categories, sources, unreadCounts: counts });
    } finally {
      set({ loading: false });
    }
  },

  refreshUnreadCounts: async () => {
    try {
      const counts = await api<UnreadCounts>('/feeds/unread-counts');
      set({ unreadCounts: counts });
    } catch {
      // Sidebar counts are advisory; swallow errors silently.
    }
  },

  createCategory: async (input) => {
    const cat = await api<Category>('/categories', { method: 'POST', body: input });
    set({ categories: [...get().categories, cat].sort((a, b) => a.name.localeCompare(b.name)) });
  },

  updateCategory: async (id, input) => {
    const cat = await api<Category>(`/categories/${id}`, { method: 'PATCH', body: input });
    set({
      categories: get()
        .categories.map((c) => (c.id === id ? cat : c))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  },

  deleteCategory: async (id) => {
    await api(`/categories/${id}`, { method: 'DELETE' });
    set({
      categories: get().categories.filter((c) => c.id !== id),
      sources: get().sources.map((s) => (s.categoryId === id ? { ...s, categoryId: null } : s)),
    });
  },

  createSource: async (input) => {
    const source = await api<Source>('/sources', { method: 'POST', body: input });
    set({ sources: [...get().sources, source].sort((a, b) => a.title.localeCompare(b.title)) });
  },

  updateSource: async (id, input) => {
    const source = await api<Source>(`/sources/${id}`, { method: 'PATCH', body: input });
    set({
      sources: get()
        .sources.map((s) => (s.id === id ? source : s))
        .sort((a, b) => a.title.localeCompare(b.title)),
    });
  },

  deleteSource: async (id) => {
    await api(`/sources/${id}`, { method: 'DELETE' });
    set({ sources: get().sources.filter((s) => s.id !== id) });
  },

  refreshSource: async (id) => {
    const source = await api<Source>(`/sources/${id}/refresh`, { method: 'POST' });
    set({ sources: get().sources.map((s) => (s.id === id ? source : s)) });
  },

  importOpml: async (xml) => {
    const result = await api<OpmlImportResponse>('/opml/import', {
      method: 'POST',
      body: { xml },
    });
    await get().load();
    return result;
  },
}));
