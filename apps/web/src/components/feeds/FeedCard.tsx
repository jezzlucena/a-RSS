import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Rss,
  MoreHorizontal,
  Edit,
  Trash2,
  FolderOpen,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Button, Card, CardContent } from '@/components/ui';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useRefreshFeed, useDeleteFeed, useTimeFormat } from '@/hooks';
import { cn } from '@/lib/utils';
import type { SubscriptionWithFeed } from '@arss/types';

interface FeedCardProps {
  subscription: SubscriptionWithFeed;
  isSelected?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onMove?: () => void;
}

export function FeedCard({
  subscription,
  isSelected,
  onClick,
  onEdit,
  onMove,
}: FeedCardProps) {
  const { t } = useTranslation('feeds');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshFeed = useRefreshFeed();
  const deleteFeed = useDeleteFeed();
  const { formatRelativeTime } = useTimeFormat();

  const { feed } = subscription;
  const displayTitle = subscription.customTitle || feed.title;

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRefreshing(true);
    try {
      await refreshFeed.mutateAsync(feed.id);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to unsubscribe from "${displayTitle}"?`)) {
      await deleteFeed.mutateAsync(feed.id);
    }
  };

  return (
    <Card
      hover
      className={cn(
        'cursor-pointer transition-all duration-200',
        isSelected && 'ring-2 ring-accent-500'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Feed Icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent-500/10 flex items-center justify-center">
            {feed.iconUrl ? (
              <img
                src={feed.iconUrl}
                alt=""
                className="w-6 h-6 rounded"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <Rss className={cn('w-5 h-5 text-accent-500', feed.iconUrl && 'hidden')} />
          </div>

          {/* Feed Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{displayTitle}</h3>
            {feed.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                {feed.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              {feed.lastFetchedAt && (
                <span>{t('updated', { time: formatRelativeTime(feed.lastFetchedAt) })}</span>
              )}
              {feed.lastError && (
                <span className="text-red-500 truncate" title={feed.lastError}>
                  Error
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh feed"
            >
              <motion.div
                animate={{ rotate: isRefreshing ? 360 : 0 }}
                transition={{
                  duration: 1,
                  repeat: isRefreshing ? Infinity : 0,
                  ease: 'linear',
                }}
              >
                <RefreshCw className="w-4 h-4" />
              </motion.div>
            </Button>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="min-w-[180px] glass rounded-lg p-1 shadow-lg animate-fade-in z-50"
                  sideOffset={5}
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none hover:bg-gray-100 dark:hover:bg-gray-800"
                    onSelect={onEdit}
                  >
                    <Edit className="w-4 h-4" />
                    Edit Feed
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none hover:bg-gray-100 dark:hover:bg-gray-800"
                    onSelect={onMove}
                  >
                    <FolderOpen className="w-4 h-4" />
                    Move to Category
                  </DropdownMenu.Item>

                  {feed.siteUrl && (
                    <DropdownMenu.Item
                      className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none hover:bg-gray-100 dark:hover:bg-gray-800"
                      onSelect={() => window.open(feed.siteUrl!, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Visit Website
                    </DropdownMenu.Item>
                  )}

                  <DropdownMenu.Separator className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

                  <DropdownMenu.Item
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onSelect={handleDelete}
                  >
                    <Trash2 className="w-4 h-4" />
                    Unsubscribe
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
