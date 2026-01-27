import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gray-200 dark:bg-gray-700",
        className
      )}
    />
  );
}

// Preset skeleton components for common use cases
export function SkeletonText({ className, lines = 1 }: { className?: string; lines?: number }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

export function SkeletonCircle({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  return <Skeleton className={cn("rounded-full", sizes[size], className)} />;
}

// Article card skeleton for compact layout
export function ArticleCardSkeletonCompact() {
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
      <Skeleton className="w-2 h-2 rounded-full flex-shrink-0" />
      <Skeleton className="w-4 h-4 rounded flex-shrink-0" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-3 w-12 flex-shrink-0" />
    </div>
  );
}

// Article card skeleton for list layout
export function ArticleCardSkeletonList() {
  return (
    <div className="flex gap-4 p-4 glass rounded-xl">
      {/* Thumbnail */}
      <Skeleton className="w-24 h-24 rounded-lg flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Title */}
        <Skeleton className="h-5 w-3/4" />

        {/* Summary */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}

// Article card skeleton for cards layout
export function ArticleCardSkeletonCard() {
  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Image */}
      <Skeleton className="h-40 w-full rounded-none" />

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3" />

        {/* Summary */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 pt-2">
          <SkeletonCircle size="sm" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}

// Article card skeleton for magazine layout
export function ArticleCardSkeletonMagazine() {
  return (
    <div className="flex gap-4 p-4 glass rounded-xl">
      {/* Image */}
      <Skeleton className="w-48 h-32 rounded-lg flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Feed info */}
        <div className="flex items-center gap-2">
          <SkeletonCircle size="sm" />
          <Skeleton className="h-3 w-24" />
        </div>

        {/* Title */}
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />

        {/* Summary */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}

// Loading state for article list
interface ArticleListSkeletonProps {
  layout: 'compact' | 'list' | 'cards' | 'magazine';
  count?: number;
}

export function ArticleListSkeleton({ layout, count = 5 }: ArticleListSkeletonProps) {
  const SkeletonComponent = {
    compact: ArticleCardSkeletonCompact,
    list: ArticleCardSkeletonList,
    cards: ArticleCardSkeletonCard,
    magazine: ArticleCardSkeletonMagazine,
  }[layout];

  if (layout === 'cards') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonComponent key={i} />
        ))}
      </div>
    );
  }

  if (layout === 'compact') {
    return (
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonComponent key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonComponent key={i} />
      ))}
    </div>
  );
}
