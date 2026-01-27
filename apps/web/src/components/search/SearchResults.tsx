import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Search, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { ArticleListSkeleton } from '@/components/ui/Skeleton';
import { FilterPanel } from './FilterPanel';
import { useSearch } from '@/hooks/useSearch';
import { useFeedStore } from '@/stores/feedStore';
import { useArticleStore } from '@/stores/articleStore';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import type { ArticleWithState } from '@arss/types';

interface SearchResultsProps {
  onSelectArticle: (article: ArticleWithState) => void;
}

export function SearchResults({ onSelectArticle }: SearchResultsProps) {
  const { t } = useTranslation('search');
  const { searchQuery, setSearchQuery } = useFeedStore();
  const { selectedArticleId } = useArticleStore();
  const { layout } = useUIStore();
  const {
    articles,
    pagination,
    isLoading,
    isFetching,
    page,
    setPage,
    search,
    filters,
    updateFilters,
    clearFilters,
  } = useSearch();

  // Trigger search when searchQuery changes
  useEffect(() => {
    if (searchQuery) {
      search(searchQuery);
    }
  }, [searchQuery, search]);

  if (!searchQuery) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{t('enterSearchTerm')}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <ArticleListSkeleton layout={layout} />;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {pagination ? t('resultsFor', { count: pagination.total }) : t('resultsForNoCount')}
          </span>
          <span className="font-medium">"{searchQuery}"</span>
          {isFetching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2">
          <FilterPanel
            filters={filters}
            onFilterChange={updateFilters}
            onClear={clearFilters}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
            {t('clear')}
          </Button>
        </div>
      </div>

      {/* Results list */}
      {articles.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t('noResults', { query: searchQuery })}</p>
            <p className="text-sm mt-2">{t('noResultsHint')}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto">
          {articles.map((article: ArticleWithState, index: number) => (
            <motion.button
              key={article.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => onSelectArticle(article)}
              className={cn(
                'w-full text-left p-4 rounded-lg',
                'bg-background/50 hover:bg-background/80',
                'border border-border/50 hover:border-border',
                'transition-all duration-200',
                selectedArticleId === article.id && 'ring-2 ring-primary/50 border-primary/50'
              )}
            >
              <div className="flex items-start gap-3">
                {article.feed?.iconUrl ? (
                  <img
                    src={article.feed.iconUrl}
                    alt=""
                    className="w-6 h-6 rounded flex-shrink-0 mt-0.5"
                  />
                ) : (
                  <div className="w-6 h-6 rounded bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Search className="w-3 h-3 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className={cn(
                    'font-medium line-clamp-2',
                    article.isRead && 'text-muted-foreground'
                  )}>
                    {article.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{article.feed?.title}</span>
                    <span>·</span>
                    <span>
                      {new Date(article.publishedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  {article.summary && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {article.summary}
                    </p>
                  )}
                </div>
              </div>
            </motion.button>
          ))}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                {t('previous')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('pageOf', { page, totalPages: pagination.totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                {t('next')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
