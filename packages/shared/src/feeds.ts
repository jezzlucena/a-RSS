import { z } from 'zod';
import { objectIdSchema } from './common.js';
import { entry } from './entries.js';

export const feedView = z.union([
  z.literal('all'),
  z.string().regex(/^category:[a-f0-9]{24}$/i),
  z.string().regex(/^source:[a-f0-9]{24}$/i),
]);
export type FeedView = z.infer<typeof feedView>;

export const feedOrder = z.enum(['asc', 'desc']);
export type FeedOrder = z.infer<typeof feedOrder>;

export const feedQuery = z.object({
  view: feedView.default('all'),
  order: feedOrder.default('desc'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  unread: z.coerce.boolean().default(false),
});
export type FeedQuery = z.infer<typeof feedQuery>;

export const feedResponse = z.object({
  entries: z.array(entry),
  nextCursor: z.string().nullable(),
  unreadCount: z.number().int().nonnegative(),
});
export type FeedResponse = z.infer<typeof feedResponse>;

export const bulkMarkReadScope = z.enum(['all', 'olderThan1d', 'olderThan7d']);
export type BulkMarkReadScope = z.infer<typeof bulkMarkReadScope>;

export const bulkMarkReadRequest = z.object({
  view: feedView,
  scope: bulkMarkReadScope,
});
export type BulkMarkReadRequest = z.infer<typeof bulkMarkReadRequest>;

export const bulkMarkReadResponse = z.object({
  marked: z.number().int().nonnegative(),
});
export type BulkMarkReadResponse = z.infer<typeof bulkMarkReadResponse>;

// Internal helper: parse a feedView discriminator
export function parseFeedView(v: FeedView):
  | { kind: 'all' }
  | { kind: 'category'; id: string }
  | { kind: 'source'; id: string } {
  if (v === 'all') return { kind: 'all' };
  const [kind, id] = v.split(':') as ['category' | 'source', string];
  return { kind, id };
}

// Re-export to keep callers from importing two paths
export { objectIdSchema };
