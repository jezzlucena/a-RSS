import { z } from 'zod';
import { objectIdSchema, isoDateString } from './common.js';

export const bypassStrategy = z.enum(['default', 'ladder', 'googlebot', 'wayback', 'archive_ph', 'none']);
export type BypassStrategy = z.infer<typeof bypassStrategy>;

export const category = z.object({
  id: objectIdSchema,
  name: z.string().min(1).max(64),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export type Category = z.infer<typeof category>;

export const source = z.object({
  id: objectIdSchema,
  feedUrl: z.string().url(),
  siteUrl: z.string().url().nullable(),
  title: z.string(),
  categoryId: objectIdSchema.nullable(),
  pollIntervalMs: z.number().int().positive(),
  bypassStrategy: bypassStrategy.default('default'),
  lastPolledAt: isoDateString.nullable(),
});
export type Source = z.infer<typeof source>;

export const createSourceRequest = z.object({
  feedUrl: z.string().url(),
  categoryId: objectIdSchema.optional(),
  bypassStrategy: bypassStrategy.optional(),
});
export type CreateSourceRequest = z.infer<typeof createSourceRequest>;

export const updateSourceRequest = createSourceRequest.partial().extend({
  title: z.string().min(1).max(200).optional(),
});
export type UpdateSourceRequest = z.infer<typeof updateSourceRequest>;

export const createCategoryRequest = z.object({
  name: z.string().min(1).max(64),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export type CreateCategoryRequest = z.infer<typeof createCategoryRequest>;

export const updateCategoryRequest = createCategoryRequest.partial();
export type UpdateCategoryRequest = z.infer<typeof updateCategoryRequest>;

export const opmlImportRequest = z.object({
  xml: z.string().min(1).max(10 * 1024 * 1024),
  mergeStrategy: z.enum(['append']).default('append'),
});
export type OpmlImportRequest = z.infer<typeof opmlImportRequest>;

export const opmlImportResponse = z.object({
  importedCategories: z.number().int().nonnegative(),
  importedSources: z.number().int().nonnegative(),
  skippedSources: z.number().int().nonnegative(),
});
export type OpmlImportResponse = z.infer<typeof opmlImportResponse>;
