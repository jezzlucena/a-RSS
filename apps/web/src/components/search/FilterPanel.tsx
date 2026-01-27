import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, Calendar, Folder, Rss, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui';
import { useFeeds, useCategories } from '@/hooks';
import { cn } from '@/lib/utils';

interface FilterValues {
  feedId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}

interface FilterPanelProps {
  filters: FilterValues;
  onFilterChange: (filters: Partial<FilterValues>) => void;
  onClear: () => void;
  className?: string;
}

export function FilterPanel({
  filters,
  onFilterChange,
  onClear,
  className,
}: FilterPanelProps) {
  const { t } = useTranslation('search');
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: feeds = [] } = useFeeds();
  const { data: categories = [] } = useCategories();

  const activeFilterCount = [
    filters.feedId,
    filters.categoryId,
    filters.startDate,
    filters.endDate,
  ].filter(Boolean).length;

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    // Convert to ISO string for API
    if (value) {
      const date = new Date(value);
      onFilterChange({ [field]: date.toISOString() });
    } else {
      onFilterChange({ [field]: undefined });
    }
  };

  const formatDateForInput = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toISOString().split('T')[0];
  };

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'gap-2',
          activeFilterCount > 0 && 'border-primary/50 text-primary'
        )}
      >
        <Filter className="w-4 h-4" />
        {t('filters.title')}
        {activeFilterCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/20 rounded-full">
            {activeFilterCount}
          </span>
        )}
        <ChevronDown
          className={cn(
            'w-4 h-4 transition-transform',
            isExpanded && 'rotate-180'
          )}
        />
      </Button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'absolute top-full left-0 z-50 mt-2 w-80',
              'bg-background/95 backdrop-blur-lg',
              'border border-border/50 rounded-lg',
              'shadow-lg overflow-hidden'
            )}
          >
            <div className="p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{t('filters.title')}</h3>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3 mr-1" />
                    {t('filters.clearAll')}
                  </Button>
                )}
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  {t('filters.dateRange')}
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="date"
                      value={formatDateForInput(filters.startDate)}
                      onChange={(e) => handleDateChange('startDate', e.target.value)}
                      className={cn(
                        'w-full px-3 py-2 text-sm rounded-md',
                        'bg-muted/50 border border-border/50',
                        'focus:outline-none focus:ring-2 focus:ring-primary/50'
                      )}
                    />
                  </div>
                  <span className="flex items-center text-muted-foreground">{t('filters.to')}</span>
                  <div className="flex-1">
                    <input
                      type="date"
                      value={formatDateForInput(filters.endDate)}
                      onChange={(e) => handleDateChange('endDate', e.target.value)}
                      className={cn(
                        'w-full px-3 py-2 text-sm rounded-md',
                        'bg-muted/50 border border-border/50',
                        'focus:outline-none focus:ring-2 focus:ring-primary/50'
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Folder className="w-4 h-4" />
                  {t('filters.category')}
                </label>
                <select
                  value={filters.categoryId || ''}
                  onChange={(e) => onFilterChange({ categoryId: e.target.value || undefined })}
                  className={cn(
                    'w-full px-3 py-2 text-sm rounded-md',
                    'bg-muted/50 border border-border/50',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50'
                  )}
                >
                  <option value="">{t('filters.allCategories')}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Feed Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Rss className="w-4 h-4" />
                  {t('filters.feed')}
                </label>
                <select
                  value={filters.feedId || ''}
                  onChange={(e) => onFilterChange({ feedId: e.target.value || undefined })}
                  className={cn(
                    'w-full px-3 py-2 text-sm rounded-md',
                    'bg-muted/50 border border-border/50',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50'
                  )}
                >
                  <option value="">{t('filters.allFeeds')}</option>
                  {feeds.map((subscription) => (
                    <option key={subscription.feedId} value={subscription.feedId}>
                      {subscription.customTitle || subscription.feed.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Date Presets */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  {t('filters.quickPresets')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: t('filters.today'), days: 0 },
                    { label: t('filters.week'), days: 7 },
                    { label: t('filters.month'), days: 30 },
                    { label: t('filters.threeMonths'), days: 90 },
                  ].map(({ label, days }) => (
                    <Button
                      key={days}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        const now = new Date();
                        const start = new Date();
                        start.setDate(now.getDate() - days);
                        onFilterChange({
                          startDate: start.toISOString(),
                          endDate: now.toISOString(),
                        });
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
