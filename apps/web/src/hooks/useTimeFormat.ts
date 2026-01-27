import { useTranslation } from 'react-i18next';

/**
 * Hook for localized time formatting functions
 */
export function useTimeFormat() {
  const { t } = useTranslation('articles');

  /**
   * Format a date relative to now (e.g., "2h ago", "3d ago") with localization
   */
  const formatRelativeTime = (date: Date | string): string => {
    const now = new Date();
    const then = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return t('time.justNow');
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return t('time.minutesAgo', { count: diffInMinutes });
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return t('time.hoursAgo', { count: diffInHours });
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return t('time.daysAgo', { count: diffInDays });
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return t('time.weeksAgo', { count: diffInWeeks });
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return t('time.monthsAgo', { count: diffInMonths });
    }

    const diffInYears = Math.floor(diffInDays / 365);
    return t('time.yearsAgo', { count: diffInYears });
  };

  /**
   * Format reading time for display with localization
   */
  const formatReadingTime = (minutes: number): string => {
    if (minutes < 1) return t('time.lessThanOneMinRead');
    if (minutes === 1) return t('time.oneMinRead');
    return t('time.minRead', { count: minutes });
  };

  return {
    formatRelativeTime,
    formatReadingTime,
  };
}
