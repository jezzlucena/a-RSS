import RssParser from 'rss-parser';

const parser = new RssParser({ timeout: 10_000 });

export interface FeedMetadata {
  title: string;
  siteUrl: string | null;
}

export async function fetchFeedMetadata(feedUrl: string): Promise<FeedMetadata> {
  const feed = await parser.parseURL(feedUrl);
  let fallbackTitle: string;
  try {
    fallbackTitle = new URL(feedUrl).hostname;
  } catch {
    fallbackTitle = feedUrl;
  }
  return {
    title: (feed.title?.trim() || fallbackTitle).slice(0, 200),
    siteUrl: feed.link ?? null,
  };
}
