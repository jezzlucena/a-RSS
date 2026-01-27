import Parser from 'rss-parser';
import { eq, and, desc } from 'drizzle-orm';
import { db, feeds, subscriptions, articles, NewFeed, NewArticle } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { normalizeFeedUrl, isValidUrl } from '@arss/utils';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'aRSS/1.0 RSS Reader',
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

export async function discoverFeed(url: string): Promise<FeedInfo> {
  const normalizedUrl = normalizeFeedUrl(url);

  if (!isValidUrl(normalizedUrl)) {
    throw new AppError(400, 'Invalid URL');
  }

  try {
    const feed = await parser.parseURL(normalizedUrl);
    const siteUrl = feed.link || null;

    // Prioritize favicon from the site's homepage, fall back to RSS feed image
    const iconUrl = getFaviconUrl(siteUrl) || feed.image?.url || null;

    return {
      url: normalizedUrl,
      title: feed.title || 'Untitled Feed',
      description: feed.description || null,
      siteUrl,
      iconUrl,
    };
  } catch (error) {
    throw new AppError(400, 'Unable to parse feed. Please check the URL and try again.');
  }
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
