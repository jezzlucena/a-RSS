import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Rss, Plus, ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui';
import { ArticleList, ArticleView } from '@/components/articles';
import { AddFeedModal } from '@/components/feeds';
import { KeyboardShortcutsHelp } from '@/components/common';
import { SearchResults } from '@/components/search/SearchResults';
import { useFeeds, useCategories, useKeyboardNavigation } from '@/hooks';
import { useFeedStore } from '@/stores/feedStore';
import { useArticleStore } from '@/stores/articleStore';
import { useUIStore } from '@/stores/uiStore';
import type { ArticleWithState } from '@arss/types';

type SortOrder = 'newest' | 'oldest';

export function HomePage() {
  const { t } = useTranslation('navigation');
  const { t: tArticles } = useTranslation('articles');
  const [isAddFeedOpen, setIsAddFeedOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest');
  };

  const { data: feeds = [], isLoading: feedsLoading } = useFeeds();
  const { isLoading: categoriesLoading } = useCategories();
  const { selectedView, searchQuery, selectedFeedId, selectedCategoryId, categories } = useFeedStore();
  const { selectedArticleId, selectArticle } = useArticleStore();
  const { articleView, splitPosition, setSplitPosition } = useUIStore();
  const [isDragging, setIsDragging] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const handleOpenArticle = useCallback((articleId: string) => {
    selectArticle(articleId);
  }, [selectArticle]);

  const handleFocusSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  const handleShowHelp = useCallback(() => {
    setIsHelpOpen(true);
  }, []);

  // Enable keyboard navigation
  useKeyboardNavigation({
    enabled: true,
    onOpenArticle: handleOpenArticle,
    onFocusSearch: handleFocusSearch,
    onShowHelp: handleShowHelp,
  });

  // Find selected feed and category names
  const selectedFeed = feeds.find((f) => f.feedId === selectedFeedId);
  const selectedFeedName = selectedFeed?.customTitle || selectedFeed?.feed.title || 'Feed';

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const selectedCategoryName = selectedCategory?.name || 'Category';

  const viewTitles: Record<string, string> = {
    all: t('viewTitles.all'),
    unread: t('viewTitles.unread'),
    saved: t('viewTitles.saved'),
    feed: selectedFeedName,
    category: selectedCategoryName,
    search: searchQuery ? t('viewTitles.searchQuery', { query: searchQuery }) : t('viewTitles.search'),
  };

  const handleSelectArticle = (article: ArticleWithState) => {
    selectArticle(article.id);
  };

  const handleCloseArticle = () => {
    selectArticle(null);
  };

  // Handle split pane dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !splitContainerRef.current) return;

    const container = splitContainerRef.current;
    const rect = container.getBoundingClientRect();

    // Calculate position based on split orientation
    const newPosition = articleView === 'split-horizontal'
      ? ((e.clientY - rect.top) / rect.height) * 100
      : ((e.clientX - rect.left) / rect.width) * 100;
    setSplitPosition(newPosition);
  }, [isDragging, setSplitPosition, articleView]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = articleView === 'split-horizontal' ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp, articleView]);

  // Empty state - no feeds
  if (!feedsLoading && feeds.length === 0) {
    return (
      <>
        <div className="h-full flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-md"
          >
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-accent-500/10 flex items-center justify-center">
              <Rss className="w-8 h-8 text-accent-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{t('welcome.title')}</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {t('welcome.description')}
            </p>
            <Button onClick={() => setIsAddFeedOpen(true)}>
              <Plus className="w-4 h-4" />
              {t('welcome.addFirstFeed')}
            </Button>
          </motion.div>
        </div>

        <AddFeedModal isOpen={isAddFeedOpen} onClose={() => setIsAddFeedOpen(false)} />
        <KeyboardShortcutsHelp isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      </>
    );
  }

  // Vertical split view layout (side by side)
  if (articleView === 'split-vertical') {
    return (
      <>
        <div ref={splitContainerRef} className="h-full flex">
          {/* Article list */}
          <div
            className="flex flex-col min-w-0 pr-2"
            style={{ width: `${splitPosition}%` }}
          >
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold truncate">{viewTitles[selectedView]}</h1>
              {selectedView !== 'search' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSortOrder}
                  className="gap-2 text-muted-foreground hover:text-foreground flex-shrink-0"
                >
                  {sortOrder === 'newest' ? (
                    <ArrowDown className="w-4 h-4" />
                  ) : (
                    <ArrowUp className="w-4 h-4" />
                  )}
                  {sortOrder === 'newest' ? tArticles('sort.newestFirst') : tArticles('sort.oldestFirst')}
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {selectedView === 'search' ? (
                <SearchResults onSelectArticle={handleSelectArticle} />
              ) : (
                <ArticleList onSelectArticle={handleSelectArticle} sortOrder={sortOrder} />
              )}
            </div>
          </div>

          {/* Resize handle */}
          <div
            className="relative flex-shrink-0 w-4 group cursor-col-resize"
            onMouseDown={handleMouseDown}
          >
            {/* Visible handle line */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 rounded-full bg-gray-200 dark:bg-gray-700 group-hover:bg-accent-500 group-active:bg-accent-500 transition-colors" />
            {/* Wider hit area */}
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>

          {/* Article view */}
          <div
            className="glass rounded-xl overflow-hidden pl-2"
            style={{ width: `${100 - splitPosition}%` }}
          >
            <ArticleView
              articleId={selectedArticleId}
              onClose={handleCloseArticle}
              mode="split"
            />
          </div>
        </div>

        <AddFeedModal isOpen={isAddFeedOpen} onClose={() => setIsAddFeedOpen(false)} />
        <KeyboardShortcutsHelp isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      </>
    );
  }

  // Horizontal split view layout (top/bottom)
  if (articleView === 'split-horizontal') {
    return (
      <>
        <div ref={splitContainerRef} className="h-full flex flex-col">
          {/* Article list */}
          <div
            className="flex flex-col min-w-0 pb-2"
            style={{ height: `${splitPosition}%` }}
          >
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold truncate">{viewTitles[selectedView]}</h1>
              {selectedView !== 'search' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSortOrder}
                  className="gap-2 text-muted-foreground hover:text-foreground flex-shrink-0"
                >
                  {sortOrder === 'newest' ? (
                    <ArrowDown className="w-4 h-4" />
                  ) : (
                    <ArrowUp className="w-4 h-4" />
                  )}
                  {sortOrder === 'newest' ? tArticles('sort.newestFirst') : tArticles('sort.oldestFirst')}
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {selectedView === 'search' ? (
                <SearchResults onSelectArticle={handleSelectArticle} />
              ) : (
                <ArticleList onSelectArticle={handleSelectArticle} sortOrder={sortOrder} />
              )}
            </div>
          </div>

          {/* Resize handle */}
          <div
            className="relative flex-shrink-0 h-4 group cursor-row-resize"
            onMouseDown={handleMouseDown}
          >
            {/* Visible handle line */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-gray-200 dark:bg-gray-700 group-hover:bg-accent-500 group-active:bg-accent-500 transition-colors" />
            {/* Wider hit area */}
            <div className="absolute inset-x-0 -top-1 -bottom-1" />
          </div>

          {/* Article view */}
          <div
            className="glass rounded-xl overflow-hidden pt-2"
            style={{ height: `${100 - splitPosition}%` }}
          >
            <ArticleView
              articleId={selectedArticleId}
              onClose={handleCloseArticle}
              mode="split"
            />
          </div>
        </div>

        <AddFeedModal isOpen={isAddFeedOpen} onClose={() => setIsAddFeedOpen(false)} />
        <KeyboardShortcutsHelp isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      </>
    );
  }

  // Full view - show article only when selected
  if (articleView === 'full' && selectedArticleId) {
    return (
      <>
        <div className="h-full flex flex-col">
          <ArticleView
            articleId={selectedArticleId}
            onClose={handleCloseArticle}
            mode="full"
          />
        </div>

        <AddFeedModal isOpen={isAddFeedOpen} onClose={() => setIsAddFeedOpen(false)} />
        <KeyboardShortcutsHelp isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      </>
    );
  }

  // List/Overlay view layout
  return (
    <>
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold truncate">{viewTitles[selectedView]}</h1>
          {selectedView !== 'search' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSortOrder}
              className="gap-2 text-muted-foreground hover:text-foreground flex-shrink-0"
            >
              {sortOrder === 'newest' ? (
                <ArrowDown className="w-4 h-4" />
              ) : (
                <ArrowUp className="w-4 h-4" />
              )}
              {sortOrder === 'newest' ? tArticles('sort.newestFirst') : tArticles('sort.oldestFirst')}
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {selectedView === 'search' ? (
            <SearchResults onSelectArticle={handleSelectArticle} />
          ) : (
            <ArticleList onSelectArticle={handleSelectArticle} sortOrder={sortOrder} />
          )}
        </div>
      </div>

      {/* Overlay article view */}
      <AnimatePresence>
        {selectedArticleId && articleView === 'overlay' && (
          <ArticleView
            key="overlay-article-view"
            articleId={selectedArticleId}
            onClose={handleCloseArticle}
            mode="overlay"
          />
        )}
      </AnimatePresence>

      <AddFeedModal isOpen={isAddFeedOpen} onClose={() => setIsAddFeedOpen(false)} />
      <KeyboardShortcutsHelp isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
}
