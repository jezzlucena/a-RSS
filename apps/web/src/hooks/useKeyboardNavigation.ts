import { useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useArticleStore } from '@/stores/articleStore';
import { useMarkAsRead, useMarkAsUnread, useToggleSaved } from './useArticles';
import type { ArticleWithState } from '@arss/types';

interface UseKeyboardNavigationOptions {
  enabled?: boolean;
  onOpenArticle?: (articleId: string) => void;
  onFocusSearch?: () => void;
  onShowHelp?: () => void;
}

export function useKeyboardNavigation(options: UseKeyboardNavigationOptions = {}) {
  const { enabled = true, onOpenArticle, onFocusSearch, onShowHelp } = options;

  const { selectedArticleId, selectArticle, articles } = useArticleStore();
  const markRead = useMarkAsRead();
  const markUnread = useMarkAsUnread();
  const toggleSaved = useToggleSaved();

  const articlesRef = useRef<ArticleWithState[]>(articles);
  articlesRef.current = articles;

  const selectedIdRef = useRef(selectedArticleId);
  selectedIdRef.current = selectedArticleId;

  const getCurrentIndex = useCallback(() => {
    if (!selectedIdRef.current) return -1;
    return articlesRef.current.findIndex((a: ArticleWithState) => a.id === selectedIdRef.current);
  }, []);

  const navigateToArticle = useCallback(
    (direction: 'next' | 'prev') => {
      const currentIndex = getCurrentIndex();
      const articles = articlesRef.current;

      if (articles.length === 0) return;

      let newIndex: number;
      if (currentIndex === -1) {
        // No selection, start from beginning or end
        newIndex = direction === 'next' ? 0 : articles.length - 1;
      } else {
        newIndex =
          direction === 'next'
            ? Math.min(currentIndex + 1, articles.length - 1)
            : Math.max(currentIndex - 1, 0);
      }

      const article = articles[newIndex];
      if (article) {
        selectArticle(article.id);
      }
    },
    [getCurrentIndex, selectArticle]
  );

  const openSelectedArticle = useCallback(() => {
    if (selectedIdRef.current && onOpenArticle) {
      onOpenArticle(selectedIdRef.current);
    }
  }, [onOpenArticle]);

  const toggleReadStatus = useCallback(async () => {
    if (!selectedIdRef.current) return;

    const article = articlesRef.current.find(
      (a: ArticleWithState) => a.id === selectedIdRef.current
    );
    if (article) {
      if (article.isRead) {
        await markUnread.mutateAsync(article.id);
      } else {
        await markRead.mutateAsync(article.id);
      }
    }
  }, [markRead, markUnread]);

  const toggleSaveStatus = useCallback(async () => {
    if (!selectedIdRef.current) return;

    const article = articlesRef.current.find(
      (a: ArticleWithState) => a.id === selectedIdRef.current
    );
    if (article) {
      await toggleSaved.mutateAsync(article.id);
    }
  }, [toggleSaved]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape to blur the input
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          navigateToArticle('next');
          break;

        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          navigateToArticle('prev');
          break;

        case 'o':
        case 'Enter':
          e.preventDefault();
          openSelectedArticle();
          break;

        case 'm':
          e.preventDefault();
          toggleReadStatus();
          break;

        case 's':
          // Only handle if not a save command (Cmd+S / Ctrl+S)
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            toggleSaveStatus();
          }
          break;

        case '/':
          e.preventDefault();
          onFocusSearch?.();
          break;

        case 'Escape':
          // Deselect current article
          selectArticle(null);
          break;

        case 'g':
          // Go to top with 'gg' (Vim-style)
          // This would need additional state to track if 'g' was pressed before
          break;

        case 'G':
          // Go to bottom
          if (articlesRef.current.length > 0) {
            const lastArticle =
              articlesRef.current[articlesRef.current.length - 1];
            selectArticle(lastArticle.id);
          }
          break;

        case '?':
          e.preventDefault();
          onShowHelp?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    navigateToArticle,
    openSelectedArticle,
    toggleReadStatus,
    toggleSaveStatus,
    onFocusSearch,
    onShowHelp,
    selectArticle,
  ]);

  return {
    navigateToArticle,
    openSelectedArticle,
    toggleReadStatus,
    toggleSaveStatus,
  };
}

// Hook to display keyboard shortcuts help
export function useKeyboardShortcuts() {
  const { t } = useTranslation('shortcuts');

  return [
    { key: 'j / ↓', description: t('nextArticle') },
    { key: 'k / ↑', description: t('prevArticle') },
    { key: 'o / Enter', description: t('openArticle') },
    { key: 'm', description: t('toggleReadUnread') },
    { key: 's', description: t('toggleSaved') },
    { key: '/', description: t('focusSearch') },
    { key: 'Esc', description: t('deselectClose') },
    { key: 'G', description: t('goToLast') },
    { key: '?', description: t('showHelp') },
  ];
}
