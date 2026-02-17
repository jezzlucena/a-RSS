import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { db } from '../db/index.js';
import { feeds, subscriptions, categories } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { addFeed } from './feedService.js';
import { createCategory } from './categoryService.js';

interface OPMLOutline {
  '@_text'?: string;
  '@_title'?: string;
  '@_type'?: string;
  '@_xmlUrl'?: string;
  '@_htmlUrl'?: string;
  '@_description'?: string;
  outline?: OPMLOutline | OPMLOutline[];
}

interface OPMLDocument {
  opml: {
    '@_version': string;
    head: {
      title?: string;
      dateCreated?: string;
      ownerName?: string;
    };
    body: {
      outline?: OPMLOutline | OPMLOutline[];
    };
  };
}

interface ParsedFeed {
  title: string;
  xmlUrl: string;
  htmlUrl?: string;
  description?: string;
  categoryPath: string[];
}

interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

function flattenOutlines(
  outlines: OPMLOutline | OPMLOutline[] | undefined,
  categoryPath: string[] = []
): ParsedFeed[] {
  if (!outlines) return [];

  const outlineArray = Array.isArray(outlines) ? outlines : [outlines];
  const result: ParsedFeed[] = [];

  for (const outline of outlineArray) {
    // Check if this is a feed (has xmlUrl) or a category
    if (outline['@_xmlUrl']) {
      result.push({
        title: outline['@_title'] || outline['@_text'] || 'Untitled',
        xmlUrl: outline['@_xmlUrl'],
        htmlUrl: outline['@_htmlUrl'],
        description: outline['@_description'],
        categoryPath,
      });
    }

    // Process nested outlines (categories or more feeds)
    if (outline.outline) {
      const categoryName = outline['@_title'] || outline['@_text'];
      const newPath = categoryName ? [...categoryPath, categoryName] : categoryPath;
      result.push(...flattenOutlines(outline.outline, newPath));
    }
  }

  return result;
}

export const opmlService = {
  async parseOPML(opmlContent: string): Promise<ParsedFeed[]> {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });

    try {
      const parsed = parser.parse(opmlContent) as OPMLDocument;

      if (!parsed.opml?.body) {
        throw new Error('Invalid OPML format: missing body element');
      }

      return flattenOutlines(parsed.opml.body.outline);
    } catch (error) {
      throw new Error(`Failed to parse OPML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  async importOPML(userId: string, opmlContent: string): Promise<ImportResult> {
    const parsedFeeds = await this.parseOPML(opmlContent);

    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    // Cache for created categories
    const categoryCache = new Map<string, string>();

    for (const parsedFeed of parsedFeeds) {
      try {
        // Check if user already has this feed
        const existingSubscription = await db
          .select()
          .from(subscriptions)
          .innerJoin(feeds, eq(feeds.id, subscriptions.feedId))
          .where(and(
            eq(subscriptions.userId, userId),
            eq(feeds.url, parsedFeed.xmlUrl)
          ))
          .limit(1);

        if (existingSubscription.length > 0) {
          result.skipped++;
          continue;
        }

        // Create or get category if categoryPath exists
        let categoryId: string | null = null;
        if (parsedFeed.categoryPath.length > 0) {
          categoryId = await this.getOrCreateCategoryPath(
            userId,
            parsedFeed.categoryPath,
            categoryCache
          );
        }

        // Subscribe to the feed
        await addFeed(userId, {
          url: parsedFeed.xmlUrl,
          categoryId: categoryId || undefined,
        });

        result.imported++;
      } catch (error) {
        result.failed++;
        result.errors.push(
          `Failed to import "${parsedFeed.title}" (${parsedFeed.xmlUrl}): ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    return result;
  },

  async getOrCreateCategoryPath(
    userId: string,
    path: string[],
    cache: Map<string, string>
  ): Promise<string> {
    const cacheKey = path.join('/');

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    let parentId: string | undefined = undefined;

    for (let i = 0; i < path.length; i++) {
      const segment = path[i];
      const segmentKey = path.slice(0, i + 1).join('/');

      if (cache.has(segmentKey)) {
        parentId = cache.get(segmentKey)!;
        continue;
      }

      // Check if category exists
      const existingCategories = await db
        .select()
        .from(categories)
        .where(eq(categories.userId, userId));

      // Filter for matching name and parentId
      const matchingCategory = existingCategories.find(
        (cat) => cat.name === segment && cat.parentId === (parentId || null)
      );

      if (matchingCategory) {
        parentId = matchingCategory.id;
        cache.set(segmentKey, parentId);
      } else {
        // Create new category using the categoryService
        const newCategory = await createCategory(userId, {
          name: segment,
          parentId,
        });

        parentId = newCategory.id;
        cache.set(segmentKey, parentId);
      }
    }

    return parentId as string;
  },

  async exportOPML(userId: string): Promise<string> {
    // Get all user's categories
    const userCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId));

    // Get all user's subscriptions with feeds
    const userSubscriptions = await db
      .select()
      .from(subscriptions)
      .innerJoin(feeds, eq(feeds.id, subscriptions.feedId))
      .where(eq(subscriptions.userId, userId));

    // Build category tree
    const categoryMap = new Map(userCategories.map((c) => [c.id, c]));
    const rootCategories = userCategories.filter((c) => !c.parentId);

    // Group feeds by category
    const feedsByCategory = new Map<string | null, typeof userSubscriptions>();
    for (const sub of userSubscriptions) {
      const catId = sub.subscriptions.categoryId;
      if (!feedsByCategory.has(catId)) {
        feedsByCategory.set(catId, []);
      }
      feedsByCategory.get(catId)!.push(sub);
    }

    // Build OPML structure
    const buildOutlines = (categoryId: string | null): OPMLOutline[] => {
      const outlines: OPMLOutline[] = [];

      // Add feeds in this category
      const categoryFeeds = feedsByCategory.get(categoryId) || [];
      for (const sub of categoryFeeds) {
        outlines.push({
          '@_type': 'rss',
          '@_text': sub.subscriptions.customTitle || sub.feeds.title,
          '@_title': sub.subscriptions.customTitle || sub.feeds.title,
          '@_xmlUrl': sub.feeds.url,
          '@_htmlUrl': sub.feeds.siteUrl || undefined,
          '@_description': sub.feeds.description || undefined,
        });
      }

      // Add child categories with their feeds
      const childCategories = userCategories.filter((c) => c.parentId === categoryId);
      for (const childCat of childCategories) {
        const childOutlines = buildOutlines(childCat.id);
        if (childOutlines.length > 0) {
          outlines.push({
            '@_text': childCat.name,
            '@_title': childCat.name,
            outline: childOutlines,
          });
        }
      }

      return outlines;
    };

    // Build root outlines
    const rootOutlines: OPMLOutline[] = [];

    // Add root category feeds
    for (const rootCat of rootCategories) {
      const catOutlines = buildOutlines(rootCat.id);
      if (catOutlines.length > 0) {
        rootOutlines.push({
          '@_text': rootCat.name,
          '@_title': rootCat.name,
          outline: catOutlines,
        });
      }
    }

    // Add uncategorized feeds
    const uncategorizedFeeds = feedsByCategory.get(null) || [];
    for (const sub of uncategorizedFeeds) {
      rootOutlines.push({
        '@_type': 'rss',
        '@_text': sub.subscriptions.customTitle || sub.feeds.title,
        '@_title': sub.subscriptions.customTitle || sub.feeds.title,
        '@_xmlUrl': sub.feeds.url,
        '@_htmlUrl': sub.feeds.siteUrl || undefined,
        '@_description': sub.feeds.description || undefined,
      });
    }

    // Build OPML document
    const opmlDoc: OPMLDocument = {
      opml: {
        '@_version': '2.0',
        head: {
          title: 'a-RSS Subscriptions',
          dateCreated: new Date().toISOString(),
        },
        body: {
          outline: rootOutlines,
        },
      },
    };

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      indentBy: '  ',
    });

    const xml = builder.build(opmlDoc);
    return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
  },
};
