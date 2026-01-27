import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  X,
  ArrowLeft,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Mail,
  Clock,
  Type,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Button, Card, CardContent, Spinner } from '@/components/ui';
import { ArticleErrorBoundary } from '@/components/common';
import { useArticle, useMarkAsRead, useMarkAsUnread, useToggleSaved, useTimeFormat } from '@/hooks';
import { useUIStore } from '@/stores/uiStore';
import { formatDate, getDomain, calculateReadingTime } from '@arss/utils';
import { cn } from '@/lib/utils';
import { sanitizeForReact } from '@/lib/sanitize';

interface ArticleViewProps {
  articleId: string | null;
  onClose: () => void;
  mode?: 'split' | 'split-horizontal' | 'split-vertical' | 'overlay' | 'full';
}

const fontSizeClasses = {
  small: 'prose-sm',
  medium: 'prose-base',
  large: 'prose-lg',
};

export function ArticleView({ articleId, onClose, mode = 'split' }: ArticleViewProps) {
  const { t } = useTranslation('articles');
  const { data: article, isLoading } = useArticle(articleId);
  const markAsRead = useMarkAsRead();
  const markAsUnread = useMarkAsUnread();
  const toggleSaved = useToggleSaved();
  const { fontSize, setFontSize, focusMode, toggleFocusMode } = useUIStore();
  const { formatRelativeTime, formatReadingTime } = useTimeFormat();

  const fontSizeLabels = {
    small: t('fontSize.small'),
    medium: t('fontSize.medium'),
    large: t('fontSize.large'),
  };

  // Track which article IDs have been auto-marked as read in this session
  const autoMarkedRef = useRef<Set<string>>(new Set());

  // Auto-mark article as read when first viewed
  useEffect(() => {
    if (article && !article.isRead && !autoMarkedRef.current.has(article.id)) {
      autoMarkedRef.current.add(article.id);
      markAsRead.mutate(article.id);
    }
  }, [article?.id]);

  if (!articleId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p>{t('selectToRead')}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <p>{t('notFound')}</p>
      </div>
    );
  }

  const readingTime = calculateReadingTime(article.content || article.summary || '');

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700",
        focusMode && "opacity-0 hover:opacity-100 transition-opacity duration-300"
      )}>
        <div className="flex items-center gap-2">
          {mode === 'full' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="mr-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              {t('back')}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() =>
              article.isRead
                ? markAsUnread.mutate(article.id)
                : markAsRead.mutate(article.id)
            }
            title={article.isRead ? t('markAsUnread') : t('markAsRead')}
          >
            <Mail
              className={cn(
                "w-4 h-4",
                article.isRead ? 'text-gray-400' : 'text-accent-500'
              )}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => toggleSaved.mutate(article.id)}
            title={article.isSaved ? t('removeFromSaved') : t('saveForLater')}
          >
            {article.isSaved ? (
              <BookmarkCheck className="w-4 h-4 text-accent-500" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            asChild
          >
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              title={t('openOriginal')}
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>

          {/* Font Size Dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" size="icon-sm" title={t('fontSize.title')}>
                <Type className="w-4 h-4" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="min-w-[120px] glass rounded-lg p-1 shadow-lg animate-fade-in z-50"
                sideOffset={5}
              >
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <DropdownMenu.Item
                    key={size}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none',
                      fontSize === size
                        ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    )}
                    onSelect={() => setFontSize(size)}
                  >
                    {fontSizeLabels[size]}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Focus Mode Toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleFocusMode}
            title={focusMode ? t('focusMode.exit') : t('focusMode.enter')}
          >
            {focusMode ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
        </div>
        {mode !== 'full' && (
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className={cn(
        "flex-1 overflow-y-auto",
        focusMode ? "px-8 py-12 max-w-3xl mx-auto" : "p-6"
      )}>
        {/* Meta */}
        <div className={cn(
          "flex items-center gap-4 mb-4 text-sm text-gray-500",
          focusMode && "justify-center"
        )}>
          <a
            href={article.feed.siteUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:text-accent-500"
          >
            {article.feed.iconUrl && !focusMode ? (
              <img
                src={article.feed.iconUrl}
                alt=""
                className="w-5 h-5 rounded"
              />
            ) : null}
            {article.feed.title}
          </a>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {formatRelativeTime(article.publishedAt)}
          </span>
          <span className="text-gray-400">
            {formatReadingTime(readingTime)}
          </span>
        </div>

        {/* Title */}
        <h1 className={cn(
          "font-bold mb-4 leading-tight",
          focusMode ? "text-4xl text-center" : "text-3xl",
          fontSize === 'small' && "text-2xl",
          fontSize === 'large' && "text-4xl"
        )}>
          {article.title}
        </h1>

        {/* Author & date */}
        <div className={cn(
          "flex items-center gap-4 mb-8 text-sm text-gray-500",
          focusMode && "justify-center"
        )}>
          {article.author && <span>{t('byAuthor', { author: article.author })}</span>}
          <span>{formatDate(article.publishedAt)}</span>
          {!focusMode && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-500 hover:underline"
            >
              {getDomain(article.url)}
            </a>
          )}
        </div>

        {/* Article content */}
        <article
          className={cn(
            "prose dark:prose-invert max-w-none",
            fontSizeClasses[fontSize],
            // Enhanced prose styling
            "prose-headings:font-bold prose-headings:tracking-tight",
            "prose-p:indent-8 prose-p:mt-4 [&>p:first-of-type]:indent-0 [&>p:first-of-type]:mt-0",
            "prose-a:text-accent-500 prose-a:no-underline hover:prose-a:underline",
            "prose-img:rounded-xl prose-img:shadow-lg",
            "prose-blockquote:border-l-accent-500 prose-blockquote:bg-gray-50 dark:prose-blockquote:bg-gray-800/50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg",
            "prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none",
            "prose-pre:bg-gray-900 prose-pre:text-gray-100",
            "prose-hr:border-gray-200 dark:prose-hr:border-gray-700",
            focusMode && "prose-lg"
          )}
          dangerouslySetInnerHTML={sanitizeForReact(article.content || article.summary || '')}
        />

        {/* Footer */}
        {!focusMode && (
          <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-500 hover:underline text-sm"
              >
                {t('readOriginalOn', { domain: getDomain(article.url) })}
              </a>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    article.isRead
                      ? markAsUnread.mutate(article.id)
                      : markAsRead.mutate(article.id)
                  }
                >
                  {article.isRead ? t('markAsUnread') : t('markAsRead')}
                </Button>
                <Button
                  variant={article.isSaved ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleSaved.mutate(article.id)}
                >
                  {article.isSaved ? (
                    <>
                      <BookmarkCheck className="w-4 h-4" />
                      {t('saved')}
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-4 h-4" />
                      {t('save')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );

  if (mode === 'overlay') {
    return (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, x: '100%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={cn(
            "fixed inset-y-0 right-0 z-50 glass",
            focusMode ? "w-full" : "w-full max-w-2xl"
          )}
        >
          {content}
        </motion.div>
      </>
    );
  }

  return content;
}
