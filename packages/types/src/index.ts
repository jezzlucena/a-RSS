// User types
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  id: string;
  userId: string;
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  layout: 'compact' | 'list' | 'cards' | 'magazine';
  articleView: 'split-horizontal' | 'split-vertical' | 'overlay' | 'full';
  fontSize: 'small' | 'medium' | 'large';
  createdAt: Date;
  updatedAt: Date;
}

// Category types
export interface Category {
  id: string;
  userId: string;
  name: string;
  color: string;
  parentId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
}

// Feed types
export interface Feed {
  id: string;
  url: string;
  title: string;
  description: string | null;
  siteUrl: string | null;
  iconUrl: string | null;
  lastFetchedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  userId: string;
  feedId: string;
  categoryId: string | null;
  customTitle: string | null;
  order: number;
  createdAt: Date;
}

export interface SubscriptionWithFeed extends Subscription {
  feed: Feed;
}

// Article types
export interface Article {
  id: string;
  feedId: string;
  guid: string;
  url: string;
  title: string;
  summary: string | null;
  content: string | null;
  author: string | null;
  imageUrl: string | null;
  publishedAt: Date;
  createdAt: Date;
}

export interface UserArticle {
  userId: string;
  articleId: string;
  isRead: boolean;
  isSaved: boolean;
  readAt: Date | null;
  savedAt: Date | null;
}

export interface ArticleWithState extends Article {
  feed: Feed;
  isRead: boolean;
  isSaved: boolean;
}

// API types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends ApiResponse<{
  user: User;
  tokens: AuthTokens;
}> {}

// Feed management types
export interface AddFeedRequest {
  url: string;
  categoryId?: string;
}

export interface CreateCategoryRequest {
  name: string;
  color?: string;
  parentId?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  color?: string;
  parentId?: string | null;
  order?: number;
}

// Article filter types
export interface ArticleFilters {
  feedId?: string;
  categoryId?: string;
  isRead?: boolean;
  isSaved?: boolean;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface ArticleListParams extends ArticleFilters {
  page?: number;
  limit?: number;
  sortBy?: 'publishedAt' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// OPML types
export interface OPMLOutline {
  title: string;
  xmlUrl?: string;
  htmlUrl?: string;
  children?: OPMLOutline[];
}
