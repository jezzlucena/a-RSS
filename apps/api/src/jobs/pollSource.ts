import RssParser from 'rss-parser';
import { decodeHTML } from 'entities';
import { Source } from '../models/source.js';
import { Entry } from '../models/entry.js';

const parser = new RssParser({ timeout: 15_000 });

export const MIN_INTERVAL_MS = 5 * 60_000;
export const MAX_INTERVAL_MS = 60 * 60_000;
const SHRINK = 0.5;
const GROW = 1.5;

export function adaptInterval(current: number, sawNewEntries: boolean): number {
  const next = sawNewEntries ? current * SHRINK : current * GROW;
  return Math.max(MIN_INTERVAL_MS, Math.min(MAX_INTERVAL_MS, Math.round(next)));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function pollSource(
  sourceId: string,
): Promise<{ inserted: number; insertedIds: string[]; intervalChanged: boolean; pollIntervalMs: number }> {
  const source = await Source.findById(sourceId);
  if (!source) {
    return { inserted: 0, insertedIds: [], intervalChanged: false, pollIntervalMs: MIN_INTERVAL_MS };
  }

  const headers: Record<string, string> = {};
  if (source.etag) headers['If-None-Match'] = source.etag;
  if (source.lastModified) headers['If-Modified-Since'] = source.lastModified;

  const res = await fetch(source.feedUrl, { headers });
  if (res.status === 304) {
    source.lastPolledAt = new Date();
    const oldInterval = source.pollIntervalMs;
    source.pollIntervalMs = adaptInterval(oldInterval, false);
    await source.save();
    return {
      inserted: 0,
      insertedIds: [],
      intervalChanged: source.pollIntervalMs !== oldInterval,
      pollIntervalMs: source.pollIntervalMs,
    };
  }
  if (!res.ok) {
    source.lastPolledAt = new Date();
    await source.save();
    throw new Error(`feed responded ${res.status}`);
  }

  const xml = await res.text();
  const feed = await parser.parseString(xml);

  const newEtag = res.headers.get('etag');
  const newLastModified = res.headers.get('last-modified');
  if (newEtag) source.etag = newEtag;
  if (newLastModified) source.lastModified = newLastModified;
  source.lastPolledAt = new Date();
  if (feed.title && feed.title !== source.title && !source.titleOverridden) {
    source.title = feed.title.slice(0, 200);
  }
  if (feed.link && !source.siteUrl) source.siteUrl = feed.link;

  let inserted = 0;
  const insertedIds: string[] = [];
  for (const item of feed.items) {
    const guid = item.guid ?? item.id ?? item.link;
    if (!guid || !item.link || !item.title) continue;
    // rss-parser's XML decode leaves double-escaped titles (e.g. a CMS that already
    // HTML-escaped, then a feed generator that escaped again) as literal entity text
    // like "&amp;#8217;" — decode once more so the title stores the real glyph.
    const title = decodeHTML(item.title).slice(0, 500);
    const publishedAt = item.isoDate
      ? new Date(item.isoDate)
      : item.pubDate
        ? new Date(item.pubDate)
        : new Date();
    const description =
      (item.contentSnippet ?? item.summary ?? item.content ?? '').toString().slice(0, 1000) || null;
    // Capture the feed-provided HTML body so processEntry has a fallback if every
    // paywall-bypass strategy fails. rss-parser surfaces full content via `content` or
    // `content:encoded` (depending on feed shape); fall back to summary.
    const feedItem = item as typeof item & { 'content:encoded'?: string };
    const feedHtmlSource =
      feedItem['content:encoded'] ?? feedItem.content ?? feedItem.summary ?? null;
    const rawHtml = feedHtmlSource
      ? `<!doctype html><html><head><title>${escapeHtml(title)}</title></head><body><article>${feedHtmlSource}</article></body></html>`.slice(
          0,
          200_000,
        )
      : null;

    const result = await Entry.updateOne(
      { sourceId: source._id, guid },
      {
        $setOnInsert: {
          userId: source.userId,
          sourceId: source._id,
          guid,
          url: item.link,
          title,
          publishedAt,
          description,
          rawHtml,
          processingState: 'pending',
        },
      },
      { upsert: true },
    );
    if (result.upsertedCount && result.upsertedCount > 0) {
      inserted++;
      if (result.upsertedId) insertedIds.push(String(result.upsertedId));
    } else if (rawHtml) {
      // Backfill rawHtml on existing entries that lack it (predate the feed-fallback
      // logic). If the entry was previously `failed`, transition it back to `pending`
      // and re-enqueue so processEntry can use the freshly-backfilled feed content.
      const previous = await Entry.findOneAndUpdate(
        {
          sourceId: source._id,
          guid,
          $or: [{ rawHtml: null }, { rawHtml: '' }, { rawHtml: { $exists: false } }],
        },
        [
          {
            $set: {
              rawHtml,
              processingState: {
                $cond: [
                  { $eq: ['$processingState', 'failed'] },
                  'pending',
                  '$processingState',
                ],
              },
              error: {
                $cond: [{ $eq: ['$processingState', 'failed'] }, null, '$error'],
              },
            },
          },
        ],
        { new: false, projection: '_id processingState' },
      );
      if (previous?.processingState === 'failed') {
        // Re-enqueue this entry so processEntry runs against the backfilled rawHtml.
        insertedIds.push(String(previous._id));
      }
    }
  }

  const oldInterval = source.pollIntervalMs;
  source.pollIntervalMs = adaptInterval(oldInterval, inserted > 0);
  await source.save();
  return {
    inserted,
    insertedIds,
    intervalChanged: source.pollIntervalMs !== oldInterval,
    pollIntervalMs: source.pollIntervalMs,
  };
}
