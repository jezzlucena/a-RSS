import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rss,
  Inbox,
  BookmarkCheck,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  LogOut,
  FileText,
  Sun,
  Moon,
  Monitor,
  MoreVertical,
  Edit,
  FolderOpen,
  Trash2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { useFeeds, useUpdatePreferences, useRefreshFeed, useDeleteFeed, useUnreadCount, useUnreadCountsByFeed } from '@/hooks';
import { AddFeedModal, EditFeedModal } from '@/components/feeds';
import { CategoryTree, CategoryModal } from '@/components/categories';
import { OPMLModal } from '@/components/settings';
import type { SubscriptionWithFeed } from '@arss/types';
import type { Category } from '@arss/types';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  collapsed?: boolean;
  badge?: number;
  onClick?: () => void;
}

function NavItem({ icon, label, isActive, collapsed, badge, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
        'hover:bg-white/50 dark:hover:bg-gray-800/50',
        isActive && 'bg-accent-500/10 text-accent-600 dark:text-accent-400',
        !isActive && 'text-gray-600 dark:text-gray-300'
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className="flex-1 text-left text-sm font-medium truncate"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      {badge !== undefined && badge > 0 && (
        <span
          className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-accent-500/20 text-accent-600 dark:text-accent-400 rounded-full transition-transform duration-200"
          style={collapsed ? { transform: "scale(0.75) translate(-24px, -10px)" } : undefined}
        >
          {badge > 999 ? '999+' : badge}
        </span>
      )}
    </button>
  );
}

interface FeedNavItemProps {
  subscription: SubscriptionWithFeed;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
  onEdit: () => void;
  unreadCount?: number;
}

function FeedNavItem({ subscription, isActive, collapsed, onClick, onEdit, unreadCount }: FeedNavItemProps) {
  const { t } = useTranslation('feeds');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshFeed = useRefreshFeed();
  const deleteFeed = useDeleteFeed();

  const { feed } = subscription;
  const displayTitle = subscription.customTitle || feed.title;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshFeed.mutateAsync(feed.id);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(t('confirmUnsubscribe', { title: displayTitle }))) {
      await deleteFeed.mutateAsync(feed.id);
    }
  };

  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
          'hover:bg-white/50 dark:hover:bg-gray-800/50',
          isActive && 'bg-accent-500/10 text-accent-600 dark:text-accent-400',
          !isActive && 'text-gray-600 dark:text-gray-300 cursor-pointer'
        )}
        title={displayTitle}
      >
        <span className="flex-shrink-0 group-hover:opacity-0">
          {feed.iconUrl ? (
            <img src={feed.iconUrl} alt="" className="w-5 h-5 rounded" />
          ) : (
            <Rss className="w-5 h-5" />
          )}
        </span>
        {!collapsed && (
          <span className="flex-1 text-left text-sm font-medium truncate">
            {displayTitle}
          </span>
        )}
        {unreadCount !== undefined && unreadCount > 0 && (
          <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-accent-500/20 text-accent-600 dark:text-accent-400 rounded-full">
            {unreadCount > 999 ? '999+' : unreadCount}
          </span>
        )}
      </button>

      {/* Context menu trigger - only show when not collapsed */}
      {!collapsed && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className={cn(
                `absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md`,
                'opacity-0 group-hover:opacity-100 transition-opacity',
                'hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[180px] glass rounded-lg p-1 shadow-lg animate-fade-in z-50 border-gray-400/50"
              sideOffset={5}
              align="end"
            >
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none hover:bg-gray-100 dark:hover:bg-gray-800"
                onSelect={onEdit}
              >
                <Edit className="w-4 h-4" />
                {t('contextMenu.editFeed')}
              </DropdownMenu.Item>

              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none hover:bg-gray-100 dark:hover:bg-gray-800"
                onSelect={onEdit}
              >
                <FolderOpen className="w-4 h-4" />
                {t('contextMenu.moveToCategory')}
              </DropdownMenu.Item>

              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none hover:bg-gray-100 dark:hover:bg-gray-800"
                onSelect={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
                {t('contextMenu.refreshFeed')}
              </DropdownMenu.Item>

              {feed.siteUrl && (
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none hover:bg-gray-100 dark:hover:bg-gray-800"
                  onSelect={() => window.open(feed.siteUrl!, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('contextMenu.visitWebsite')}
                </DropdownMenu.Item>
              )}

              <DropdownMenu.Separator className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                onSelect={handleDelete}
              >
                <Trash2 className="w-4 h-4" />
                {t('contextMenu.unsubscribe')}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
    </div>
  );
}

export function Sidebar() {
  const { t } = useTranslation('navigation');
  const { t: tFeeds } = useTranslation('feeds');
  const { t: tAuth } = useTranslation('auth');
  const [isAddFeedOpen, setIsAddFeedOpen] = useState(false);
  const [isOPMLOpen, setIsOPMLOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingFeed, setEditingFeed] = useState<SubscriptionWithFeed | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { sidebarCollapsed, toggleSidebarCollapsed, setSidebarCollapsed, theme, setTheme } = useUIStore();
  const { logout, user } = useAuthStore();
  const updatePreferences = useUpdatePreferences();

  const { data: feeds = [] } = useFeeds();
  const { data: unreadCount = 0 } = useUnreadCount();
  const { data: feedUnreadCounts = {} } = useUnreadCountsByFeed();

  // Collapse sidebar by default on narrow viewports
  useEffect(() => {
    if (window.innerWidth < 800) {
      setSidebarCollapsed(true);
    }
  }, [setSidebarCollapsed]);

  const isSettingsPage = location.pathname === '/settings';

  const handleNavClick = (view: 'all' | 'unread' | 'saved') => {
    const routes: Record<string, string> = {
      all: '/',
      unread: '/unread',
      saved: '/saved',
    };
    queryClient.invalidateQueries({ queryKey: ['articles'] });
    navigate(routes[view]);
  };

  const handleFeedClick = (feedId: string) => {
    queryClient.invalidateQueries({ queryKey: ['articles'] });
    navigate(`/feed/${feedId}`);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    updatePreferences.mutate({ theme: newTheme });
  };

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 72 : 280 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="h-full flex flex-col glass border-r border-white/10 dark:border-gray-700/30"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 dark:border-gray-700/30">
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center">
                  <Rss className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg">a-RSS</span>
              </motion.div>
            )}
          </AnimatePresence>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebarCollapsed}
            className="flex-shrink-0"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex-1 relative overflow-hidden">
          <nav className="h-full p-3 space-y-1 overflow-y-auto scrollbar-hide">
            <NavItem
              icon={<Inbox className="w-5 h-5" />}
              label={t('sidebar.allArticles')}
              isActive={location.pathname === '/' || location.pathname === '/all'}
              collapsed={sidebarCollapsed}
              onClick={() => handleNavClick('all')}
            />
            <NavItem
              icon={<Rss className="w-5 h-5" />}
              label={t('sidebar.unread')}
              isActive={location.pathname === '/unread'}
              collapsed={sidebarCollapsed}
              badge={unreadCount}
              onClick={() => handleNavClick('unread')}
            />
            <NavItem
              icon={<BookmarkCheck className="w-5 h-5" />}
              label={t('sidebar.saved')}
              isActive={location.pathname === '/saved'}
              collapsed={sidebarCollapsed}
              onClick={() => handleNavClick('saved')}
            />

            {/* Categories Section */}
            {!sidebarCollapsed && (
              <div className="pt-4">
                <CategoryTree
                  onAddCategory={() => {
                    setEditingCategory(null);
                    setIsCategoryModalOpen(true);
                  }}
                  onEditCategory={(category) => {
                    setEditingCategory(category);
                    setIsCategoryModalOpen(true);
                  }}
                />
              </div>
            )}

            {/* Feeds Section */}
            {!sidebarCollapsed && (
              <div className="pt-4 pb-6">
                <div className="flex items-center justify-between px-3 mb-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {t('sidebar.feeds')}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-6 w-6"
                    onClick={() => setIsAddFeedOpen(true)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {feeds.length === 0 ? (
                  <p className="px-3 text-sm text-gray-400">{tFeeds('noFeeds')}</p>
                ) : (
                  feeds.map((subscription) => (
                    <FeedNavItem
                      key={subscription.id}
                      subscription={subscription}
                      isActive={location.pathname === `/feed/${subscription.feedId}`}
                      collapsed={sidebarCollapsed}
                      onClick={() => handleFeedClick(subscription.feedId)}
                      onEdit={() => setEditingFeed(subscription)}
                      unreadCount={feedUnreadCounts[subscription.feedId]}
                    />
                  ))
                )}
              </div>
            )}
          </nav>

          {/* Fade effect at bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none bg-gradient-to-t from-white dark:from-gray-900 to-transparent"
            aria-hidden="true"
          />
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 dark:border-gray-700/30 space-y-1">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <div>
                <NavItem
                  icon={<Settings className="w-5 h-5" />}
                  label={t('sidebar.settings')}
                  collapsed={sidebarCollapsed}
                />
              </div>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="min-w-[200px] border-gray-400/50 glass rounded-lg p-1 shadow-lg animate-fade-in z-50"
                side="top"
                sideOffset={5}
                align="start"
              >
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none hover:bg-gray-100 dark:hover:bg-gray-800"
                  onSelect={() => navigate('/settings')}
                >
                  <Settings className="w-4 h-4" />
                  {t('sidebar.allSettings')}
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

                <DropdownMenu.Label className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {t('sidebar.theme')}
                </DropdownMenu.Label>
                <DropdownMenu.Item
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none',
                    theme === 'light'
                      ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                  onSelect={() => handleThemeChange('light')}
                >
                  <Sun className="w-4 h-4" />
                  {t('sidebar.light')}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none',
                    theme === 'dark'
                      ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                  onSelect={() => handleThemeChange('dark')}
                >
                  <Moon className="w-4 h-4" />
                  {t('sidebar.dark')}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none',
                    theme === 'system'
                      ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                  onSelect={() => handleThemeChange('system')}
                >
                  <Monitor className="w-4 h-4" />
                  {t('sidebar.system')}
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

                <DropdownMenu.Label className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {t('sidebar.data')}
                </DropdownMenu.Label>
                <DropdownMenu.Item
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none hover:bg-gray-100 dark:hover:bg-gray-800"
                  onSelect={() => setIsOPMLOpen(true)}
                >
                  <FileText className="w-4 h-4" />
                  {t('sidebar.importExportOPML')}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {user && (
            <NavItem
              icon={<LogOut className="w-5 h-5" />}
              label={tAuth('logout')}
              collapsed={sidebarCollapsed}
              onClick={logout}
            />
          )}
        </div>
      </motion.aside>

      <AddFeedModal isOpen={isAddFeedOpen} onClose={() => setIsAddFeedOpen(false)} />
      <OPMLModal isOpen={isOPMLOpen} onClose={() => setIsOPMLOpen(false)} />
      <EditFeedModal
        isOpen={!!editingFeed}
        onClose={() => setEditingFeed(null)}
        subscription={editingFeed}
      />
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        category={editingCategory}
      />
    </>
  );
}
