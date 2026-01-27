import { useEffect } from 'react';
import { useMutation, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import i18n from '@/i18n';
import api from '@/lib/api';
import { useArticleStore } from '@/stores/articleStore';
import { toast } from '@/stores/toastStore';
import type { ArticleWithState, ArticleListParams, PaginatedResponse } from '@arss/types';

export function useArticles(params: ArticleListParams = {}) {
  const { setArticles, setHasMore } = useArticleStore();

  const query = useInfiniteQuery({
    queryKey: ['articles', params],
    queryFn: async ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams();
      searchParams.set('page', String(pageParam));
      if (params.limit) searchParams.set('limit', String(params.limit));
      if (params.feedId) searchParams.set('feedId', params.feedId);
      if (params.categoryId) searchParams.set('categoryId', params.categoryId);
      if (params.isRead !== undefined) searchParams.set('isRead', String(params.isRead));
      if (params.isSaved !== undefined) searchParams.set('isSaved', String(params.isSaved));
      if (params.search) searchParams.set('search', params.search);
      if (params.sortBy) searchParams.set('sortBy', params.sortBy);
      if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

      const response = await api.get<PaginatedResponse<ArticleWithState>>(`/articles?${searchParams}`);
      return {
        articles: response.data.data || [],
        pagination: response.data.pagination,
      };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.page < lastPage.pagination.totalPages) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  useEffect(() => {
    if (query.data) {
      const allArticles = query.data.pages.flatMap((page) => page.articles);
      setArticles(allArticles);
      const lastPage = query.data.pages[query.data.pages.length - 1];
      setHasMore(lastPage.pagination.page < lastPage.pagination.totalPages);
    }
  }, [query.data, setArticles, setHasMore]);

  return query;
}

export function useArticle(articleId: string | null) {
  return useQuery({
    queryKey: ['article', articleId],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: ArticleWithState }>(`/articles/${articleId}`);
      return response.data.data;
    },
    enabled: !!articleId,
    // Keep data fresh for 30 seconds to prevent refetching immediately after optimistic updates
    staleTime: 30 * 1000,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const { markAsRead } = useArticleStore();

  return useMutation({
    mutationFn: async (articleId: string) => {
      await api.patch(`/articles/${articleId}`, { isRead: true });
      return articleId;
    },
    onMutate: (articleId) => {
      markAsRead(articleId);

      // Find the article from the articles list cache to use for the single article cache
      let articleFromList: ArticleWithState | undefined;
      const articlesData = queryClient.getQueriesData<{ pages: { articles: ArticleWithState[]; pagination: unknown }[] }>({ queryKey: ['articles'] });
      for (const [, data] of articlesData) {
        if (data) {
          for (const page of data.pages) {
            const found = page.articles.find(a => a.id === articleId);
            if (found) {
              articleFromList = found;
              break;
            }
          }
          if (articleFromList) break;
        }
      }

      // Optimistically update the article in all cached queries without refetching
      // This keeps the article visible in the unread view but marked as read
      queryClient.setQueriesData<{ pages: { articles: ArticleWithState[]; pagination: unknown }[] }>(
        { queryKey: ['articles'] },
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              articles: page.articles.map((article) =>
                article.id === articleId ? { ...article, isRead: true } : article
              ),
            })),
          };
        }
      );

      // Update the single article query - use article from list if the cache is empty
      const existingArticle = queryClient.getQueryData<ArticleWithState>(['article', articleId]);
      if (existingArticle) {
        queryClient.setQueryData<ArticleWithState>(['article', articleId], { ...existingArticle, isRead: true });
      } else if (articleFromList) {
        queryClient.setQueryData<ArticleWithState>(['article', articleId], { ...articleFromList, isRead: true });
      }
    },
    onError: (_error, articleId) => {
      // Revert the optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['article', articleId] });
      toast.error(i18n.t('articles:messages.markReadFailed'));
    },
  });
}

export function useMarkAsUnread() {
  const queryClient = useQueryClient();
  const { markAsUnread } = useArticleStore();

  return useMutation({
    mutationFn: async (articleId: string) => {
      await api.patch(`/articles/${articleId}`, { isRead: false });
      return articleId;
    },
    onMutate: (articleId) => {
      markAsUnread(articleId);

      // Find the article from the articles list cache to use for the single article cache
      let articleFromList: ArticleWithState | undefined;
      const articlesData = queryClient.getQueriesData<{ pages: { articles: ArticleWithState[]; pagination: unknown }[] }>({ queryKey: ['articles'] });
      for (const [, data] of articlesData) {
        if (data) {
          for (const page of data.pages) {
            const found = page.articles.find(a => a.id === articleId);
            if (found) {
              articleFromList = found;
              break;
            }
          }
          if (articleFromList) break;
        }
      }

      // Optimistically update the article in all cached queries without refetching
      queryClient.setQueriesData<{ pages: { articles: ArticleWithState[]; pagination: unknown }[] }>(
        { queryKey: ['articles'] },
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              articles: page.articles.map((article) =>
                article.id === articleId ? { ...article, isRead: false } : article
              ),
            })),
          };
        }
      );

      // Update the single article query - use article from list if the cache is empty
      const existingArticle = queryClient.getQueryData<ArticleWithState>(['article', articleId]);
      if (existingArticle) {
        queryClient.setQueryData<ArticleWithState>(['article', articleId], { ...existingArticle, isRead: false });
      } else if (articleFromList) {
        queryClient.setQueryData<ArticleWithState>(['article', articleId], { ...articleFromList, isRead: false });
      }
    },
    onError: (_error, articleId) => {
      // Revert the optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['article', articleId] });
      toast.error(i18n.t('articles:messages.markUnreadFailed'));
    },
  });
}

export function useToggleSaved() {
  const queryClient = useQueryClient();
  const { toggleSaved, articles } = useArticleStore();

  // Helper to find article from all available sources
  const findArticle = (articleId: string): ArticleWithState | undefined => {
    // First check single article cache (most reliable for ArticleView)
    const singleArticle = queryClient.getQueryData<ArticleWithState>(['article', articleId]);
    if (singleArticle) return singleArticle;

    // Then check articles list cache
    const articlesData = queryClient.getQueriesData<{ pages: { articles: ArticleWithState[]; pagination: unknown }[] }>({ queryKey: ['articles'] });
    for (const [, data] of articlesData) {
      if (data) {
        for (const page of data.pages) {
          const found = page.articles.find(a => a.id === articleId);
          if (found) return found;
        }
      }
    }

    // Finally check Zustand store
    return articles.find((a) => a.id === articleId);
  };

  const mutation = useMutation({
    mutationFn: async ({ articleId, newSavedState }: { articleId: string; newSavedState: boolean }) => {
      await api.patch(`/articles/${articleId}`, { isSaved: newSavedState });
      return { articleId, isSaved: newSavedState };
    },
    onMutate: ({ articleId, newSavedState }) => {
      toggleSaved(articleId);

      // Find the article from cache
      const articleFromList = findArticle(articleId);

      // Get the updated article data
      const updatedArticle = articleFromList ? { ...articleFromList, isSaved: newSavedState } : null;

      // Get all article queries and update them individually
      const allQueries = queryClient.getQueriesData<{ pages: { articles: ArticleWithState[]; pagination: unknown }[] }>({ queryKey: ['articles'] });

      for (const [queryKey, oldData] of allQueries) {
        if (!oldData) continue;

        const params = queryKey[1] as ArticleListParams | undefined;
        const isSavedView = params?.isSaved === true;

        let newData;

        // For saved view: add article if saving, remove if unsaving
        if (isSavedView) {
          if (newSavedState && updatedArticle) {
            // Add to saved view if not already present
            const alreadyExists = oldData.pages.some(page =>
              page.articles.some(a => a.id === articleId)
            );
            if (!alreadyExists) {
              newData = {
                ...oldData,
                pages: oldData.pages.map((page, index) =>
                  index === 0
                    ? { ...page, articles: [updatedArticle, ...page.articles] }
                    : page
                ),
              };
            } else {
              // Update the existing article
              newData = {
                ...oldData,
                pages: oldData.pages.map((page) => ({
                  ...page,
                  articles: page.articles.map((a) =>
                    a.id === articleId ? { ...a, isSaved: newSavedState } : a
                  ),
                })),
              };
            }
          } else if (!newSavedState) {
            // Remove from saved view
            newData = {
              ...oldData,
              pages: oldData.pages.map((page) => ({
                ...page,
                articles: page.articles.filter((a) => a.id !== articleId),
              })),
            };
          }
        } else {
          // For other views, just update the property
          newData = {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              articles: page.articles.map((a) =>
                a.id === articleId ? { ...a, isSaved: newSavedState } : a
              ),
            })),
          };
        }

        if (newData) {
          queryClient.setQueryData(queryKey, newData);
        }
      }

      // Update the single article query - use article from list if the cache is empty
      const existingArticle = queryClient.getQueryData<ArticleWithState>(['article', articleId]);
      if (existingArticle) {
        queryClient.setQueryData<ArticleWithState>(['article', articleId], { ...existingArticle, isSaved: newSavedState });
      } else if (articleFromList) {
        queryClient.setQueryData<ArticleWithState>(['article', articleId], { ...articleFromList, isSaved: newSavedState });
      }

      return { newSavedState };
    },
    onSuccess: (_data, _vars, context) => {
      // Reset infinite queries to refetch only first page when accessed
      queryClient.resetQueries({ queryKey: ['articles'] });
      toast.success(context?.newSavedState ? i18n.t('articles:messages.saved') : i18n.t('articles:messages.unsaved'));
    },
    onError: (_error, { articleId }) => {
      // Revert the optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['article', articleId] });
      toast.error(i18n.t('articles:messages.saveFailed'));
    },
  });

  // Return a wrapper that maintains the old interface
  return {
    ...mutation,
    mutate: (articleId: string) => {
      const article = findArticle(articleId);
      const newSavedState = article ? !article.isSaved : true;
      mutation.mutate({ articleId, newSavedState });
    },
    mutateAsync: async (articleId: string) => {
      const article = findArticle(articleId);
      const newSavedState = article ? !article.isSaved : true;
      return mutation.mutateAsync({ articleId, newSavedState });
    },
  };
}

export function useMarkBulkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { articleIds?: string[]; feedId?: string; categoryId?: string }) => {
      const response = await api.post<{ success: boolean; data: { count: number } }>('/articles/mark-read', params);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<ArticleWithState>>(`/search?q=${encodeURIComponent(query)}`);
      return {
        articles: response.data.data || [],
        pagination: response.data.pagination,
      };
    },
    enabled: query.length > 0,
  });
}
