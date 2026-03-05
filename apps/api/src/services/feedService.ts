import Parser from 'rss-parser';
import { eq, and, desc } from 'drizzle-orm';
import { db, feeds, subscriptions, articles, NewFeed, NewArticle } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { normalizeFeedUrl, isValidUrl } from '@arss/utils';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'a-RSS/1.0 RSS Reader',
  },
});

export interface AddFeedInput {
  url: string;
  categoryId?: string;
}

export interface FeedInfo {
  url: string;
  title: string;
  description: string | null;
  siteUrl: string | null;
  iconUrl: string | null;
}

/**
 * Get favicon URL for a site using Google's favicon service
 */
function getFaviconUrl(siteUrl: string | null): string | null {
  if (!siteUrl) return null;

  try {
    const url = new URL(siteUrl);
    // Use Google's favicon service which reliably returns favicons
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
  } catch {
    return null;
  }
}

/**
 * Common feed URL paths to try when direct parsing and metatag discovery fail
 */
const COMMON_FEED_PATHS = [
  '/feed',
  '/rss',
  '/atom',
  '/feed.xml',
  '/rss.xml',
  '/atom.xml',
  '/index.xml',
  '/feed/rss',
  '/feed/atom',
  '/rss/feed',
  '/.rss',
  '/blog/feed',
  '/blog/rss',
  '/feeds/posts/default', // Blogger
];

/**
 * Try to parse a URL as an RSS/Atom feed, returning null on failure
 */
async function tryParseFeed(url: string): Promise<{ feed: Parser.Output<Record<string, unknown>>; url: string } | null> {
  try {
    const feed = await parser.parseURL(url);
    if (feed && (feed.title || (feed.items && feed.items.length > 0))) {
      return { feed, url };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Build a FeedInfo object from a parsed feed
 */
function buildFeedInfo(feed: Parser.Output<Record<string, unknown>>, feedUrl: string): FeedInfo {
  const siteUrl = feed.link || null;
  const iconUrl = getFaviconUrl(siteUrl) || feed.image?.url || null;

  return {
    url: feedUrl,
    title: feed.title || 'Untitled Feed',
    description: feed.description || null,
    siteUrl,
    iconUrl,
  };
}

/**
 * Fetch a URL and extract feed links from HTML metatags
 * Looks for <link rel="alternate" type="application/rss+xml"> and similar tags
 */
async function discoverFeedUrlsFromHtml(pageUrl: string): Promise<string[]> {
  try {
    const response = await fetch(pageUrl, {
      headers: { 'User-Agent': 'a-RSS/1.0 RSS Reader' },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });

    if (!response.ok) return [];

    const contentType = response.headers.get('content-type') || '';
    // If the response is already a feed, don't try to parse as HTML
    if (contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom')) {
      return [];
    }

    const html = await response.text();

    // Match <link> tags with rel="alternate" and RSS/Atom types
    const feedLinkRegex = /<link[^>]*\brel=["']alternate["'][^>]*>/gi;
    const matches = html.match(feedLinkRegex) || [];

    const feedUrls: string[] = [];

    for (const tag of matches) {
      const typeMatch = tag.match(/\btype=["']([^"']+)["']/i);
      const hrefMatch = tag.match(/\bhref=["']([^"']+)["']/i);

      if (!typeMatch || !hrefMatch) continue;

      const type = typeMatch[1].toLowerCase();
      if (
        type.includes('rss') ||
        type.includes('atom') ||
        type.includes('xml')
      ) {
        const href = hrefMatch[1];
        // Resolve relative URLs against the page URL
        try {
          const absoluteUrl = new URL(href, pageUrl).toString();
          feedUrls.push(absoluteUrl);
        } catch {
          // Skip invalid URLs
        }
      }
    }

    // Also check for links where type comes before rel
    const feedLinkRegex2 = /<link[^>]*\btype=["']application\/(rss|atom)\+xml["'][^>]*>/gi;
    const matches2 = html.match(feedLinkRegex2) || [];

    for (const tag of matches2) {
      const hrefMatch = tag.match(/\bhref=["']([^"']+)["']/i);
      if (!hrefMatch) continue;

      const href = hrefMatch[1];
      try {
        const absoluteUrl = new URL(href, pageUrl).toString();
        if (!feedUrls.includes(absoluteUrl)) {
          feedUrls.push(absoluteUrl);
        }
      } catch {
        // Skip invalid URLs
      }
    }

    return feedUrls;
  } catch {
    return [];
  }
}

/**
 * Generate common feed URL variations from a base URL
 */
function getCommonFeedUrls(baseUrl: string): string[] {
  try {
    const url = new URL(baseUrl);
    // Use the origin (scheme + host) as the base for common paths
    const origin = url.origin;

    return COMMON_FEED_PATHS.map(path => `${origin}${path}`);
  } catch {
    return [];
  }
}

export async function discoverFeed(url: string): Promise<FeedInfo> {
  const normalizedUrl = normalizeFeedUrl(url);

  if (!isValidUrl(normalizedUrl)) {
    throw new AppError(400, 'Invalid URL');
  }

  // Step 1: Try parsing the URL directly as a feed
  const directResult = await tryParseFeed(normalizedUrl);
  if (directResult) {
    return buildFeedInfo(directResult.feed, directResult.url);
  }

  // Step 2: Fetch the page and look for feed metatags in the HTML
  const discoveredUrls = await discoverFeedUrlsFromHtml(normalizedUrl);

  for (const feedUrl of discoveredUrls) {
    const result = await tryParseFeed(feedUrl);
    if (result) {
      return buildFeedInfo(result.feed, result.url);
    }
  }

  // Step 3: Try common feed URL path variations
  const commonUrls = getCommonFeedUrls(normalizedUrl);

  // Try them in parallel in small batches for speed
  const batchSize = 5;
  for (let i = 0; i < commonUrls.length; i += batchSize) {
    const batch = commonUrls.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(u => tryParseFeed(u)));
    const found = results.find(r => r !== null);
    if (found) {
      return buildFeedInfo(found.feed, found.url);
    }
  }

  throw new AppError(400, 'Unable to find a feed. Please check the URL and try again.');
}

export async function addFeed(userId: string, input: AddFeedInput) {
  const feedInfo = await discoverFeed(input.url);

  // Check if feed already exists
  let existingFeed = await db.query.feeds.findFirst({
    where: eq(feeds.url, feedInfo.url),
  });

  if (!existingFeed) {
    // Create new feed
    const [newFeed] = await db
      .insert(feeds)
      .values({
        url: feedInfo.url,
        title: feedInfo.title,
        description: feedInfo.description,
        siteUrl: feedInfo.siteUrl,
        iconUrl: feedInfo.iconUrl,
      })
      .returning();
    existingFeed = newFeed;
  }

  // Check if user already subscribed
  const existingSubscription = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.feedId, existingFeed.id)
    ),
  });

  if (existingSubscription) {
    throw new AppError(409, 'You are already subscribed to this feed');
  }

  // Create subscription
  const [subscription] = await db
    .insert(subscriptions)
    .values({
      userId,
      feedId: existingFeed.id,
      categoryId: input.categoryId || null,
    })
    .returning();

  // Fetch articles in background (we'll do immediate fetch for now)
  await fetchFeedArticles(existingFeed.id, feedInfo.url);

  return {
    ...subscription,
    feed: existingFeed,
  };
}

export async function getUserFeeds(userId: string) {
  const userSubscriptions = await db.query.subscriptions.findMany({
    where: eq(subscriptions.userId, userId),
    with: {
      feed: true,
      category: true,
    },
    orderBy: [subscriptions.order],
  });

  return userSubscriptions;
}

export async function getFeed(feedId: string) {
  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
  });

  if (!feed) {
    throw new AppError(404, 'Feed not found');
  }

  return feed;
}

export async function updateSubscription(
  userId: string,
  feedId: string,
  updates: { categoryId?: string | null; customTitle?: string | null; order?: number }
) {
  const subscription = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.feedId, feedId)
    ),
  });

  if (!subscription) {
    throw new AppError(404, 'Subscription not found');
  }

  const [updated] = await db
    .update(subscriptions)
    .set(updates)
    .where(eq(subscriptions.id, subscription.id))
    .returning();

  return updated;
}

export async function deleteFeed(userId: string, feedId: string) {
  const subscription = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.feedId, feedId)
    ),
  });

  if (!subscription) {
    throw new AppError(404, 'Subscription not found');
  }

  await db.delete(subscriptions).where(eq(subscriptions.id, subscription.id));
}

export async function refreshFeed(feedId: string) {
  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
  });

  if (!feed) {
    throw new AppError(404, 'Feed not found');
  }

  await fetchFeedArticles(feedId, feed.url);

  // Update icon if missing - use favicon from siteUrl
  if (!feed.iconUrl && feed.siteUrl) {
    const iconUrl = getFaviconUrl(feed.siteUrl);
    if (iconUrl) {
      await db
        .update(feeds)
        .set({ iconUrl })
        .where(eq(feeds.id, feedId));

      return { ...feed, iconUrl };
    }
  }

  return feed;
}

export async function fetchFeedArticles(feedId: string, feedUrl: string) {
  try {
    const feed = await parser.parseURL(feedUrl);

    const newArticles: NewArticle[] = [];

    for (const item of feed.items || []) {
      const guid = item.guid || item.link || item.title || '';

      // Check if article already exists
      const existing = await db.query.articles.findFirst({
        where: and(eq(articles.feedId, feedId), eq(articles.guid, guid)),
      });

      if (!existing) {
        const itemAny = item as Record<string, unknown>;
        newArticles.push({
          feedId,
          guid,
          url: item.link || '',
          title: item.title || 'Untitled',
          summary: item.contentSnippet || item.summary || null,
          content: (item.content || itemAny['content:encoded'] || null) as string | null,
          author: item.creator || item.author || null,
          imageUrl: extractImageUrl(item),
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        });
      }
    }

    if (newArticles.length > 0) {
      await db.insert(articles).values(newArticles);
    }

    // Update feed's last fetched timestamp
    await db
      .update(feeds)
      .set({
        lastFetchedAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(feeds.id, feedId));

    return newArticles.length;
  } catch (error) {
    // Update feed with error
    await db
      .update(feeds)
      .set({
        lastError: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date(),
      })
      .where(eq(feeds.id, feedId));

    throw error;
  }
}

function extractImageUrl(item: Parser.Item): string | null {
  // Try various common image locations
  if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
    return item.enclosure.url;
  }

  // Try media:content
  const mediaContent = (item as Record<string, unknown>)['media:content'];
  if (mediaContent && typeof mediaContent === 'object') {
    const media = mediaContent as { $?: { url?: string; medium?: string } };
    if (media.$?.url && media.$?.medium === 'image') {
      return media.$.url;
    }
  }

  // Try to extract from content
  const itemAny = item as Record<string, unknown>;
  const content = (item.content || itemAny['content:encoded'] || '') as string;
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) {
    return imgMatch[1];
  }

  return null;
}
