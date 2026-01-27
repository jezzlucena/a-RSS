import { eq, and, desc, asc, sql, inArray, or, ilike, gte, lte } from 'drizzle-orm';
import { db, articles, userArticles, subscriptions, feeds } from '../db/index.js';
import { AppError } from '../middleware/errorHandler.js';

export interface ArticleFilters {
  feedId?: string;
  categoryId?: string;
  isRead?: boolean;
  isSaved?: boolean;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface ArticleListParams extends ArticleFilters {
  page?: number;
  limit?: number;
  sortBy?: 'publishedAt' | 'createdAt' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

export async function getArticles(userId: string, params: ArticleListParams) {
  const {
    feedId,
    categoryId,
    isRead,
    isSaved,
    search,
    startDate,
    endDate,
    page = 1,
    limit = 20,
    sortBy = 'publishedAt',
    sortOrder = 'desc',
  } = params;

  // Get user's subscribed feed IDs
  let feedIds: string[] = [];

  if (feedId) {
    // Verify user is subscribed to this feed
    const subscription = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.feedId, feedId)
      ),
    });

    if (!subscription) {
      throw new AppError(404, 'Feed not found');
    }

    feedIds = [feedId];
  } else if (categoryId) {
    // Get all feeds in category
    const categorySubscriptions = await db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.categoryId, categoryId)
      ),
    });

    feedIds = categorySubscriptions.map((s) => s.feedId);
  } else {
    // Get all subscribed feeds
    const userSubscriptions = await db.query.subscriptions.findMany({
      where: eq(subscriptions.userId, userId),
    });

    feedIds = userSubscriptions.map((s) => s.feedId);
  }

  if (feedIds.length === 0) {
    return {
      articles: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  // Build query conditions
  const conditions = [inArray(articles.feedId, feedIds)];

  // Date range filtering
  if (startDate) {
    conditions.push(gte(articles.publishedAt, new Date(startDate)));
  }
  if (endDate) {
    conditions.push(lte(articles.publishedAt, new Date(endDate)));
  }

  // Full-text search using PostgreSQL tsvector
  let useFullTextSearch = false;
  let searchQuery = '';

  if (search && search.trim()) {
    searchQuery = search.trim();
    useFullTextSearch = true;

    // Convert search terms to tsquery format
    // Handle quoted phrases and multiple terms
    const tsQuery = searchQuery
      .replace(/"/g, '') // Remove quotes for now
      .split(/\s+/)
      .filter(Boolean)
      .join(' & '); // AND search terms together

    conditions.push(
      sql`search_tsvector @@ plainto_tsquery('english', ${searchQuery})`
    );
  }

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(articles)
    .where(and(...conditions));

  const total = countResult[0]?.count || 0;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;

  // Determine sort order
  let orderByClause;

  if (useFullTextSearch && sortBy === 'relevance') {
    // Sort by relevance score when searching
    orderByClause = sql`ts_rank(search_tsvector, plainto_tsquery('english', ${searchQuery})) DESC`;
  } else {
    const orderColumn = sortBy === 'publishedAt' || sortBy === 'relevance'
      ? articles.publishedAt
      : articles.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc : desc;
    orderByClause = orderDirection(orderColumn);
  }

  // Get articles with user state and subscription custom title
  const articleList = await db
    .select({
      article: articles,
      feed: feeds,
      userState: userArticles,
      subscription: subscriptions,
      ...(useFullTextSearch ? {
        relevance: sql<number>`ts_rank(search_tsvector, plainto_tsquery('english', ${searchQuery}))`,
      } : {}),
    })
    .from(articles)
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .innerJoin(
      subscriptions,
      and(
        eq(subscriptions.feedId, feeds.id),
        eq(subscriptions.userId, userId)
      )
    )
    .leftJoin(
      userArticles,
      and(
        eq(userArticles.articleId, articles.id),
        eq(userArticles.userId, userId)
      )
    )
    .where(and(...conditions))
    .orderBy(orderByClause)
    .limit(limit)
    .offset(offset);

  // Filter by read/saved state if needed
  let filteredArticles = articleList;

  if (isRead !== undefined) {
    filteredArticles = filteredArticles.filter((a) =>
      isRead
        ? a.userState?.isRead === true
        : !a.userState?.isRead
    );
  }

  if (isSaved !== undefined && isSaved) {
    filteredArticles = filteredArticles.filter((a) => a.userState?.isSaved === true);
  }

  // Map to response format
  const result = filteredArticles.map(({ article, feed, userState, subscription }) => ({
    ...article,
    feed: {
      id: feed.id,
      title: subscription?.customTitle || feed.title,
      iconUrl: feed.iconUrl,
      siteUrl: feed.siteUrl,
    },
    isRead: userState?.isRead ?? false,
    isSaved: userState?.isSaved ?? false,
  }));

  return {
    articles: result,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

export async function getArticle(userId: string, articleId: string) {
  const article = await db.query.articles.findFirst({
    where: eq(articles.id, articleId),
    with: {
      feed: true,
    },
  });

  if (!article) {
    throw new AppError(404, 'Article not found');
  }

  // Verify user has access to this article
  const subscription = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.feedId, article.feedId)
    ),
  });

  if (!subscription) {
    throw new AppError(404, 'Article not found');
  }

  // Get user state
  const userState = await db.query.userArticles.findFirst({
    where: and(
      eq(userArticles.userId, userId),
      eq(userArticles.articleId, articleId)
    ),
  });

  return {
    ...article,
    feed: {
      ...article.feed,
      title: subscription.customTitle || article.feed.title,
    },
    isRead: userState?.isRead ?? false,
    isSaved: userState?.isSaved ?? false,
  };
}

export async function markAsRead(userId: string, articleId: string) {
  await upsertUserArticle(userId, articleId, { isRead: true, readAt: new Date() });
}

export async function markAsUnread(userId: string, articleId: string) {
  await upsertUserArticle(userId, articleId, { isRead: false, readAt: null });
}

export async function toggleSaved(userId: string, articleId: string) {
  const existing = await db.query.userArticles.findFirst({
    where: and(
      eq(userArticles.userId, userId),
      eq(userArticles.articleId, articleId)
    ),
  });

  const isSaved = !existing?.isSaved;
  await upsertUserArticle(userId, articleId, {
    isSaved,
    savedAt: isSaved ? new Date() : null,
  });

  return { isSaved };
}

export async function markBulkAsRead(
  userId: string,
  articleIds?: string[],
  feedId?: string,
  categoryId?: string
) {
  let targetIds = articleIds;

  if (!targetIds) {
    // Get all articles from feed or category
    let feedIds: string[] = [];

    if (feedId) {
      feedIds = [feedId];
    } else if (categoryId) {
      const subs = await db.query.subscriptions.findMany({
        where: and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.categoryId, categoryId)
        ),
      });
      feedIds = subs.map((s) => s.feedId);
    } else {
      const subs = await db.query.subscriptions.findMany({
        where: eq(subscriptions.userId, userId),
      });
      feedIds = subs.map((s) => s.feedId);
    }

    if (feedIds.length === 0) return { count: 0 };

    const articlesList = await db.query.articles.findMany({
      where: inArray(articles.feedId, feedIds),
      columns: { id: true },
    });

    targetIds = articlesList.map((a) => a.id);
  }

  if (targetIds.length === 0) return { count: 0 };

  // Upsert all articles as read
  const now = new Date();
  const values = targetIds.map((articleId) => ({
    userId,
    articleId,
    isRead: true,
    isSaved: false,
    readAt: now,
    savedAt: null,
  }));

  await db
    .insert(userArticles)
    .values(values)
    .onConflictDoUpdate({
      target: [userArticles.userId, userArticles.articleId],
      set: {
        isRead: true,
        readAt: now,
      },
    });

  return { count: targetIds.length };
}

async function upsertUserArticle(
  userId: string,
  articleId: string,
  updates: {
    isRead?: boolean;
    isSaved?: boolean;
    readAt?: Date | null;
    savedAt?: Date | null;
  }
) {
  const existing = await db.query.userArticles.findFirst({
    where: and(
      eq(userArticles.userId, userId),
      eq(userArticles.articleId, articleId)
    ),
  });

  if (existing) {
    await db
      .update(userArticles)
      .set(updates)
      .where(
        and(
          eq(userArticles.userId, userId),
          eq(userArticles.articleId, articleId)
        )
      );
  } else {
    await db.insert(userArticles).values({
      userId,
      articleId,
      isRead: updates.isRead ?? false,
      isSaved: updates.isSaved ?? false,
      readAt: updates.readAt ?? null,
      savedAt: updates.savedAt ?? null,
    });
  }
}

export async function getSearchSuggestions(userId: string, query: string) {
  if (!query || query.length < 2) {
    return [];
  }

  // Get user's subscribed feed IDs
  const userSubscriptions = await db.query.subscriptions.findMany({
    where: eq(subscriptions.userId, userId),
  });

  const feedIds = userSubscriptions.map((s) => s.feedId);

  if (feedIds.length === 0) {
    return [];
  }

  // Search for matching article titles using ILIKE for partial matching
  // This is more forgiving than trigram similarity for autocomplete
  const suggestions = await db
    .select({
      title: articles.title,
    })
    .from(articles)
    .where(
      and(
        inArray(articles.feedId, feedIds),
        sql`title ILIKE ${'%' + query + '%'}`
      )
    )
    .orderBy(articles.publishedAt)
    .limit(10);

  // Extract unique search terms from titles
  const seen = new Set<string>();
  const results: Array<{ title: string; type: 'article' }> = [];

  for (const { title } of suggestions) {
    if (!seen.has(title.toLowerCase())) {
      seen.add(title.toLowerCase());
      results.push({ title, type: 'article' });
    }
    if (results.length >= 5) break;
  }

  return results;
}

export async function searchArticles(userId: string, query: string, page = 1, limit = 20) {
  if (!query || query.trim().length === 0) {
    return {
      articles: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  return getArticles(userId, {
    search: query,
    page,
    limit,
    sortBy: 'relevance',
    sortOrder: 'desc',
  });
}
