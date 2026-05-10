import type { RequestHandler } from 'express';
import { opmlImportRequest, type OpmlImportResponse } from '@a-rss/shared';
import { Category } from '../models/category.js';
import { Source } from '../models/source.js';
import { getUserId } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { parseOpml, buildOpml, groupSourcesByCategory } from '../services/opml.js';

export const importOpml: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const { xml } = opmlImportRequest.parse(req.body);

  let parsed;
  try {
    parsed = parseOpml(xml);
  } catch (err) {
    throw new HttpError(
      400,
      'opml_parse_error',
      `Could not parse OPML: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Idempotent category creation by (userId, name).
  const categoryIdByName = new Map<string, string>();
  let importedCategories = 0;
  for (const cat of parsed.categories) {
    const existing = await Category.findOne({ userId, name: cat.name });
    if (existing) {
      categoryIdByName.set(cat.name, existing.id);
    } else {
      const created = await Category.create({ userId, name: cat.name });
      categoryIdByName.set(cat.name, created.id);
      importedCategories++;
    }
  }

  let importedSources = 0;
  let skippedSources = 0;
  const inserts: { feedUrl: string; siteUrl: string | null; title: string; categoryId: string | null }[] = [];
  for (const f of parsed.uncategorized) inserts.push({ ...f, categoryId: null });
  for (const cat of parsed.categories) {
    const categoryId = categoryIdByName.get(cat.name) ?? null;
    for (const f of cat.feeds) inserts.push({ ...f, categoryId });
  }

  for (const i of inserts) {
    const existing = await Source.findOne({ userId, feedUrl: i.feedUrl });
    if (existing) {
      skippedSources++;
      continue;
    }
    await Source.create({
      userId,
      feedUrl: i.feedUrl,
      siteUrl: i.siteUrl,
      title: i.title,
      categoryId: i.categoryId,
    });
    importedSources++;
  }

  const response: OpmlImportResponse = { importedCategories, importedSources, skippedSources };
  res.json(response);
};

export const exportOpml: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const [sources, categories] = await Promise.all([
    Source.find({ userId }).sort({ title: 1 }),
    Category.find({ userId }).sort({ name: 1 }),
  ]);

  const grouped = groupSourcesByCategory(sources, categories);
  const xml = buildOpml({
    title: 'a-RSS subscriptions',
    categories: grouped,
    uncategorized: grouped._uncategorized,
  });

  res.setHeader('Content-Type', 'text/x-opml; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="a-rss-subscriptions.opml"');
  res.send(xml);
};
