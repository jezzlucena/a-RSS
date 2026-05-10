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

export const entryDetail = entry.extend({
  articleText: z.string().nullable(),
  byline: z.string().nullable(),
});
export type EntryDetail = z.infer<typeof entryDetail>;
