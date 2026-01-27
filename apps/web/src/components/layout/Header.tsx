import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, RefreshCw, LayoutGrid, Rows2, Newspaper, Rows4, PanelTop, PanelLeft, Layers, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { SearchInput } from '@/components/search';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

export function Header() {
  const { t } = useTranslation('settings');
  const { t: tSearch } = useTranslation('search');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme, setTheme, layout, setLayout, articleView, setArticleView } = useUIStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const searchQuery = searchParams.get('q') || '';

  const handleSearchSubmit = (query: string) => {
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    } else {
      navigate('/');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // TODO: Implement refresh logic
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  const toggleTheme = () => {
    if (theme === 'dark') setTheme('light');
    else setTheme('dark');
  };

  const layouts = [
    { value: 'compact' as const, icon: Rows4, label: t('feedLayout.compact') },
    { value: 'list' as const, icon: Rows2, label: t('feedLayout.list') },
    { value: 'cards' as const, icon: LayoutGrid, label: t('feedLayout.cards') },
    { value: 'magazine' as const, icon: Newspaper, label: t('feedLayout.magazine') },
  ];

  const articleViews = [
    { value: 'split-horizontal' as const, icon: PanelTop, label: t('articleView.splitHorizontal') },
    { value: 'split-vertical' as const, icon: PanelLeft, label: t('articleView.splitVertical') },
    { value: 'overlay' as const, icon: Layers, label: t('articleView.overlay') },
    { value: 'full' as const, icon: Maximize2, label: t('articleView.full') },
  ];

  return (
    <header className="h-16 flex items-center justify-between px-6 glass border-b border-white/10 dark:border-gray-700/30 z-10">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <SearchInput
          onSearch={handleSearchSubmit}
          placeholder={tSearch('placeholder')}
          initialValue={searchQuery}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Layout Switcher */}
        <div className="flex items-center p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
          {layouts.map(({ value, icon: Icon, label }) => (
            <Button
              key={value}
              variant="ghost"
              size="icon-sm"
              onClick={() => setLayout(value)}
              className={cn(
                'rounded-md',
                layout === value && 'bg-white dark:bg-gray-700 shadow-sm'
              )}
              title={label}
            >
              <Icon className="w-4 h-4" />
            </Button>
          ))}
        </div>

        {/* Article View Switcher */}
        <div className="flex items-center p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
          {articleViews.map(({ value, icon: Icon, label }) => (
            <Button
              key={value}
              variant="ghost"
              size="icon-sm"
              onClick={() => setArticleView(value)}
              className={cn(
                'rounded-md',
                articleView === value && 'bg-white dark:bg-gray-700 shadow-sm'
              )}
              title={label}
            >
              <Icon className="w-4 h-4" />
            </Button>
          ))}
        </div>

        {/* Refresh */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <motion.div
            animate={{ rotate: isRefreshing ? 360 : 0 }}
            transition={{
              duration: 1,
              repeat: isRefreshing ? Infinity : 0,
              ease: 'linear',
            }}
          >
            <RefreshCw className="w-5 h-5" />
          </motion.div>
        </Button>

        {/* Theme Toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={theme}
              initial={{ opacity: 0, rotate: -90, scale: 0.8 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.8 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {theme === 'dark' ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </motion.div>
          </AnimatePresence>
        </Button>
      </div>
    </header>
  );
}
