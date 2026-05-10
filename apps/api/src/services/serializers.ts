import type { CategoryDoc } from '../models/category.js';
import type { SourceDoc } from '../models/source.js';
import type { EntryDoc } from '../models/entry.js';
import type { Category, Source, Entry } from '@a-rss/shared';

export function serializeCategory(c: CategoryDoc): Category {
  return {
    id: c.id,
    name: c.name,
    color: c.color ?? undefined,
  };
}

export function serializeSource(s: SourceDoc): Source {
  return {
    id: s.id,
    feedUrl: s.feedUrl,
    siteUrl: s.siteUrl ?? null,
    title: s.title,
    categoryId: s.categoryId ? String(s.categoryId) : null,
    pollIntervalMs: s.pollIntervalMs,
    bypassStrategy: (s.bypassStrategy ?? 'default') as Source['bypassStrategy'],
    lastPolledAt: s.lastPolledAt ? s.lastPolledAt.toISOString() : null,
  };
}

export interface SerializeEntryContext {
  sourceTitle: string;
  categoryId: string | null;
  isRead: boolean;
}

export function serializeEntry(e: EntryDoc, ctx: SerializeEntryContext): Entry {
  return {
    id: e.id,
    sourceId: String(e.sourceId),
    sourceTitle: ctx.sourceTitle,
    categoryId: ctx.categoryId,
    url: e.url,
    title: e.title,
    publishedAt: e.publishedAt.toISOString(),
    description: e.description ?? null,
    summary: e.summary
      ? {
          intro: e.summary.intro ?? null,
          bullets: e.summary.bullets as [string, string, string],
          model: e.summary.model,
          generatedAt: e.summary.generatedAt.toISOString(),
        }
      : null,
    image: e.image ? { url: e.image.url, source: e.image.source } : null,
    processingState: e.processingState as Entry['processingState'],
    isRead: ctx.isRead,
    error: e.error ?? null,
  };
}
