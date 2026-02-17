/**
 * Shared constants used across the a-RSS application.
 */

// Password requirements
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// Query limits
export const QUERY_LIMIT_DEFAULT = 20;
export const QUERY_LIMIT_MAX = 100;

// JWT expiry times (in seconds)
export const JWT_ACCESS_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days
export const JWT_REFRESH_TOKEN_EXPIRY = 90 * 24 * 60 * 60; // 90 days

// Storage keys
export const STORAGE_KEYS = {
  AUTH: 'arss-auth',
  LANGUAGE: 'arss-language',
  THEME: 'arss-theme',
  LAYOUT: 'arss-layout',
  PREFERENCES: 'arss-preferences',
} as const;

// Layout options
export const LAYOUTS = ['compact', 'list', 'cards', 'magazine'] as const;
export type Layout = (typeof LAYOUTS)[number];

// Theme options
export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

// Article view options
export const ARTICLE_VIEWS = ['split-horizontal', 'split-vertical', 'overlay', 'full'] as const;
export type ArticleView = (typeof ARTICLE_VIEWS)[number];

// Font size options
export const FONT_SIZES = ['small', 'medium', 'large'] as const;
export type FontSize = (typeof FONT_SIZES)[number];

// Feed view options
export const FEED_VIEWS = ['all', 'unread', 'saved', 'feed', 'category', 'search'] as const;
export type FeedView = (typeof FEED_VIEWS)[number];

// Sort order options
export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

// Sort by options
export const SORT_BY_OPTIONS = ['publishedAt', 'createdAt'] as const;
export type SortBy = (typeof SORT_BY_OPTIONS)[number];

// Refresh intervals (in milliseconds)
export const REFRESH_INTERVALS = {
  UNREAD_COUNT: 60 * 1000, // 1 minute
  FEEDS: 15 * 60 * 1000, // 15 minutes
} as const;

// API rate limits
export const RATE_LIMITS = {
  GENERAL: 500, // requests per 15 minutes
  AUTH: 20, // attempts per 15 minutes
  PASSWORD_RESET: 5, // attempts per hour
  FEED_OPERATIONS: 60, // requests per minute
} as const;

// Max stored refresh tokens per user
export const MAX_REFRESH_TOKENS_PER_USER = 5;
