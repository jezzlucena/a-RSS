import { Entry } from '../models/entry.js';
import { Source } from '../models/source.js';
import { fetchArticle, FetcherError } from '../services/fetcher.js';
import { cacheImage, isCachedImageUrl } from '../services/imageStore.js';
import { extractArticle } from '../services/articleExtractor.js';
import { logger } from '../services/logger.js';

const MIN_ARTICLE_LENGTH = 500;
// If the bypass chain fails, accept any RSS-feed-provided HTML whose extracted text
// clears this lower bar. (Many feeds carry full article HTML; some carry only a
// short teaser, in which case the extracted text won't clear this bar and we'll
// keep the entry in `failed`.)
const FEED_FALLBACK_MIN_TEXT = 200;

// Copies a remote image into our S3/MinIO bucket and returns its URL. Failures are
// non-fatal: the card hotlinks the original instead. Already-cached URLs pass through
// so a retried entry doesn't re-upload the same bytes under a new key.
async function cacheOrKeep(sourceUrl: string, entryId: string): Promise<string> {
  if (isCachedImageUrl(sourceUrl)) return sourceUrl;
  try {
    return await cacheImage(sourceUrl, entryId);
  } catch (err) {
    logger.debug(
      { entryId, err: (err as Error).message, sourceUrl },
      'image-cache: falling back to source URL',
    );
    return sourceUrl;
  }
}

/**
 * Background pipeline: fetch the article via the paywall-bypass chain, settle the
 * illustration, store rawHtml. Summarization is deferred — we only call Claude when
 * a user actually expands the card (`POST /entries/:id/summarize`). This keeps
 * Anthropic spend bounded by reader interest rather than firehose volume.
 *
 * Fallback: when every bypass strategy fails, fall back to whatever RSS-feed HTML
 * pollSource saved on the entry (item.content / content:encoded / summary). The
 * entry transitions to `fetched` with its existing rawHtml intact, so summarize
 * and detail flows work unchanged.
 */
export async function processEntry(entryId: string): Promise<void> {
  const entry = await Entry.findById(entryId);
  if (!entry) return;
  if (entry.processingState === 'fetched' || entry.processingState === 'summarized') return;

  const source = await Source.findById(entry.sourceId);
  if (!source) {
    entry.processingState = 'failed';
    entry.error = 'source not found';
    await entry.save();
    return;
  }

  try {
    const fetched = await fetchArticle(entry.url, {
      override: source.bypassStrategy as
        | 'default'
        | 'none'
        | 'ladder'
        | 'googlebot'
        | 'wayback'
        | 'archive_ph',
      minLength: MIN_ARTICLE_LENGTH,
    });

    entry.rawHtml = fetched.fetch.html.slice(0, 200_000); // bound storage
    // The page's og:image is the editorially chosen hero, so it replaces the `inline`
    // image pollSource lifted from the feed body. When the page has none, the feed's
    // image stays rather than being dropped. Either way the winner gets cached.
    if (fetched.article.imageUrl) {
      entry.image = { url: await cacheOrKeep(fetched.article.imageUrl, entry.id), source: 'og' };
    } else if (entry.image?.source === 'inline') {
      entry.image = { url: await cacheOrKeep(entry.image.url, entry.id), source: 'inline' };
    }
    entry.processingState = 'fetched';
    entry.error = null;
    await entry.save();
  } catch (err) {
    const attemptSummary =
      err instanceof FetcherError
        ? err.attempts.map((a) => `${a.strategy}:${a.error}`).join(' | ')
        : err instanceof Error
          ? err.message
          : String(err);

    // Fallback: if pollSource captured RSS-feed HTML on the entry's rawHtml field,
    // try using it. We require the extracted text to clear FEED_FALLBACK_MIN_TEXT
    // so we don't transition to `fetched` for empty/teaser-only RSS bodies.
    if (entry.rawHtml) {
      try {
        const article = extractArticle(entry.rawHtml, entry.url);
        if (article.textContent && article.textContent.length >= FEED_FALLBACK_MIN_TEXT) {
          if (!entry.image && article.imageUrl) {
            // Lifted from feed HTML, not the article page, so it's `inline` too.
            entry.image = { url: article.imageUrl, source: 'inline' };
          }
          entry.processingState = 'fetched';
          entry.error = `feed_fallback: ${attemptSummary}`.slice(0, 500);
          await entry.save();
          logger.info(
            { entryId: entry.id, textLength: article.textContent.length },
            'fetch failed; using RSS feed content fallback',
          );
          return;
        }
      } catch (extractErr) {
        logger.debug(
          { entryId: entry.id, err: (extractErr as Error).message },
          'feed-fallback extraction failed',
        );
      }
    }

    // No usable fallback — record a real failure.
    entry.processingState = 'failed';
    entry.error = (err instanceof FetcherError
      ? `fetch_failed: ${attemptSummary}`
      : `process_failed: ${attemptSummary}`).slice(0, 500);
    await entry.save();
    throw err;
  }
}
