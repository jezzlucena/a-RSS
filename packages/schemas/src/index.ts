import { z } from 'zod';

/**
 * Shared validation schemas used across the a-RSS application.
 * These can be used for both server-side and client-side validation.
 */

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(255),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Feed schemas
export const addFeedSchema = z.object({
  url: z.string().min(1, 'URL is required'),
  categoryId: z.string().uuid().optional(),
});

export const discoverFeedSchema = z.object({
  url: z.string().min(1, 'URL is required'),
});

export const updateSubscriptionSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  customTitle: z.string().nullable().optional(),
  order: z.number().int().optional(),
});

// Category schemas
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color format').optional(),
  parentId: z.string().uuid().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color format').optional(),
  parentId: z.string().uuid().nullable().optional(),
  order: z.number().int().optional(),
});

// Article schemas
export const articleListSchema = z.object({
  feedId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  isRead: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  isSaved: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().optional(),
  page: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .optional(),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .optional(),
  sortBy: z.enum(['publishedAt', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const updateArticleSchema = z.object({
  isRead: z.boolean().optional(),
  isSaved: z.boolean().optional(),
});

export const markBulkReadSchema = z.object({
  articleIds: z.array(z.string().uuid()).optional(),
  feedId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  olderThan: z.string().datetime().optional(),
});

// UUID param schemas
export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID'),
});

// Search schemas
export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  page: z
    .string()
    .transform(Number)
    .pipe(z.number().int().positive())
    .optional(),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .optional(),
  feedId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type AddFeedInput = z.infer<typeof addFeedSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ArticleListInput = z.infer<typeof articleListSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
export type MarkBulkReadInput = z.infer<typeof markBulkReadSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
