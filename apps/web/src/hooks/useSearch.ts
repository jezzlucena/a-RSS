import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useEffect, useRef } from 'react';
import api from '@/lib/api';
import type { ArticleWithState } from '@arss/types';

interface SearchSuggestion {
  title: string;
  type: 'article';
}

interface SearchFilters {
  feedId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}

interface SearchParams extends SearchFilters {
  q: string;
  page?: number;
  limit?: number;
}

interface SearchResponse {
  success: boolean;
  data: ArticleWithState[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface SuggestionsResponse {
  success: boolean;
  data: SearchSuggestion[];
}

async function searchArticles(params: SearchParams): Promise<SearchResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('q', params.q);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.feedId) searchParams.set('feedId', params.feedId);
  if (params.categoryId) searchParams.set('categoryId', params.categoryId);
  if (params.startDate) searchParams.set('startDate', params.startDate);
  if (params.endDate) searchParams.set('endDate', params.endDate);

  const response = await api.get<SearchResponse>(`/search?${searchParams.toString()}`);
  return response.data;
}

async function fetchSuggestions(query: string): Promise<SearchSuggestion[]> {
  if (query.length < 2) return [];

  const response = await api.get<SuggestionsResponse>(`/search/suggestions?q=${encodeURIComponent(query)}`);
  return response.data.data;
}

export function useSearchSuggestions(initialValue: string = '') {
  const [query, setQuery] = useState(initialValue);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with external initial value changes
  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  const updateQuery = useCallback((value: string) => {
    setQuery(value);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedQuery(value);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['search-suggestions', debouncedQuery],
    queryFn: () => fetchSuggestions(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30000,
  });

  return {
    query,
    setQuery: updateQuery,
    suggestions,
    isLoading,
    clearQuery: () => {
      setQuery('');
      setDebouncedQuery('');
    },
  };
}

export function useSearch(initialFilters?: SearchFilters) {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters || {});
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['search', searchQuery, filters, page],
    queryFn: () =>
      searchArticles({
        q: searchQuery,
        ...filters,
        page,
        limit: 20,
      }),
    enabled: searchQuery.length > 0,
  });

  const search = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(1);
  }, []);

  const updateFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setPage(1);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setFilters({});
    setPage(1);
  }, []);

  return {
    searchQuery,
    filters,
    search,
    updateFilters,
    clearFilters,
    clearSearch,
    articles: data?.data || [],
    pagination: data?.pagination,
    isLoading,
    isFetching,
    refetch,
    page,
    setPage,
  };
}
