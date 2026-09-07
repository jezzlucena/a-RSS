import { z } from 'zod';
import { objectIdSchema, isoDateString } from './common.js';

export const entrySummary = z.object({
  intro: z.string().nullable(),
  bullets: z.tuple([z.string(), z.string(), z.string()]),
  model: z.string(),
  generatedAt: isoDateString,
});
export type EntrySummary = z.infer<typeof entrySummary>;

export const entryImage = z.object({
  url: z.string().url(),
  source: z.enum(['og', 'inline', 'placeholder']),
});
export type EntryImage = z.infer<typeof entryImage>;

export const processingState = z.enum(['pending', 'fetched', 'summarized', 'failed']);
export type ProcessingState = z.infer<typeof processingState>;

export const entry = z.object({
  id: objectIdSchema,
  sourceId: objectIdSchema,
  sourceTitle: z.string(),
  categoryId: objectIdSchema.nullable(),
  url: z.string().url(),
  title: z.string(),
  publishedAt: isoDateString,
  description: z.string().nullable(),
  summary: entrySummary.nullable(),
  image: entryImage.nullable(),
  processingState: processingState,
  isRead: z.boolean(),
  error: z.string().nullable(),
});
export type Entry = z.infer<typeof entry>;

/** One row of GET /entries/failures (a `failed` entry that hasn't been dismissed). */
export const failedEntry = z.object({
  id: objectIdSchema,
  sourceId: objectIdSchema,
  sourceTitle: z.string(),
  url: z.string(),
  title: z.string(),
  publishedAt: isoDateString,
  updatedAt: isoDateString,
  error: z.string().nullable(),
});
export type FailedEntry = z.infer<typeof failedEntry>;

/** Paged newest-first by `updatedAt`; pass `nextCursor` back verbatim. */
export const failuresResponse = z.object({
  items: z.array(failedEntry),
  nextCursor: z.string().nullable(),
});
export type FailuresResponse = z.infer<typeof failuresResponse>;

export const entryDetail = entry.extend({
  articleText: z.string().nullable(),
  byline: z.string().nullable(),
});
export type EntryDetail = z.infer<typeof entryDetail>;
