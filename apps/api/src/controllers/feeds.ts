import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import {
  feedQuery as feedQuerySchema,
  bulkMarkReadRequest,
  type FeedResponse,
  type BulkMarkReadResponse,
} from '@a-rss/shared';
import { Entry } from '../models/entry.js';
import { Source } from '../models/source.js';
import { ReadReceipt } from '../models/readReceipt.js';
import { getUserId } from '../middleware/auth.js';
import { buildBaseFilter, encodeCursor, decodeCursor } from '../services/feedQuery.js';
import { serializeEntry } from '../services/serializers.js';

/**
 * Read-state semantics: an entry is "read" iff there exists ANY ReadReceipt for
 * (userId, entryId), regardless of `feedContext`. This keeps the sidebar's per-source
 * count, the masthead's "X unread" number, and per-card `isRead` consistent — once
 * read in any view, the entry is read everywhere. Bulk-mark-read still writes
 * receipts scoped to the active view (so the bulk-action's audit-trail of *where*
 * it was triggered is preserved), but the consume-side never filters on context.
 */

export const getFeed: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const { view, order, cursor, limit, unread } = feedQuerySchema.parse(req.query);

  const baseFilter = await buildBaseFilter(userId, view);
  const cursorFilter = cursor ? decodeCursor(cursor, order) : {};
  const sortDir = order === 'desc' ? -1 : 1;

  // All entry IDs the current user has any receipt for. Used both for the unread
  // filter (when ?unread=1) and for serializing per-card isRead. Distinct so we
  // don't multiply for entries with multiple receipts.
  const readEntryIds = (await ReadReceipt.distinct('entryId', {
    userId: new mongoose.Types.ObjectId(userId),
  })) as mongoose.Types.ObjectId[];
  const readIdSet = new Set(readEntryIds.map((id) => id.toHexString()));

  const docs = await Entry.find({
    ...baseFilter,
    ...cursorFilter,
    ...(unread && readEntryIds.length > 0 ? { _id: { $nin: readEntryIds } } : {}),
  })
    .sort({ publishedAt: sortDir, _id: sortDir })
    .limit(limit + 1);

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({ publishedAt: last.publishedAt, id: last._id as mongoose.Types.ObjectId })
      : null;

  // Source titles + categories for the entries on this page.
  const sourceIds = [...new Set(page.map((e) => String(e.sourceId)))];
  const sources = await Source.find({ _id: { $in: sourceIds } }).select('title categoryId');
  const sourceMap = new Map(
    sources.map((s) => [
      s.id,
      { title: s.title, categoryId: s.categoryId ? String(s.categoryId) : null },
    ]),
  );

  // Unread count over the whole view (ignoring pagination).
  // Cheap when readEntryIds is small; for large read sets, the in-memory diff
  // is still fine for personal-use scale.
  const allInViewIds = await Entry.find(baseFilter).select('_id');
  const unreadCount = allInViewIds.reduce((acc, e) => {
    return acc + (readIdSet.has(String(e._id)) ? 0 : 1);
  }, 0);

  const entries = page.map((doc) => {
    const meta = sourceMap.get(String(doc.sourceId)) ?? { title: 'Unknown', categoryId: null };
    return serializeEntry(doc, {
      sourceTitle: meta.title,
      categoryId: meta.categoryId,
      isRead: readIdSet.has(doc.id),
    });
  });

  const response: FeedResponse = { entries, nextCursor, unreadCount };
  res.json(response);
};

export const markRead: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const { view, scope } = bulkMarkReadRequest.parse(req.body);

  const baseFilter = await buildBaseFilter(userId, view);
  const ageFilter: { publishedAt?: { $lte: Date } } = {};
  if (scope === 'olderThan1d') {
    ageFilter.publishedAt = { $lte: new Date(Date.now() - 86_400_000) };
  } else if (scope === 'olderThan7d') {
    ageFilter.publishedAt = { $lte: new Date(Date.now() - 7 * 86_400_000) };
  }

  const entries = await Entry.find({ ...baseFilter, ...ageFilter }).select('_id');
  if (entries.length === 0) {
    const response: BulkMarkReadResponse = { marked: 0 };
    res.json(response);
    return;
  }

  const now = new Date();
  const ops = entries.map((e) => ({
    updateOne: {
      filter: { userId, entryId: e._id, feedContext: view },
      update: {
        $setOnInsert: {
          userId: new mongoose.Types.ObjectId(userId),
          entryId: e._id,
          feedContext: view,
          readAt: now,
        },
      },
      upsert: true,
    },
  }));
  const result = await ReadReceipt.bulkWrite(ops, { ordered: false });

  const response: BulkMarkReadResponse = {
    marked: (result.upsertedCount ?? 0) + (result.modifiedCount ?? 0),
  };
  res.json(response);
};

/**
 * Sidebar / nav unread counts. Returns the global unread count across the user's
 * entries, plus a per-source breakdown and a per-category aggregation derived from
 * each source's categoryId. Sources/categories with zero unread entries are omitted.
 */
export const getUnreadCounts: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const userObjId = new mongoose.Types.ObjectId(userId);

  const readEntryIds = (await ReadReceipt.distinct('entryId', {
    userId: userObjId,
  })) as mongoose.Types.ObjectId[];

  const perSource = await Entry.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    {
      $match: {
        userId: userObjId,
        ...(readEntryIds.length > 0 ? { _id: { $nin: readEntryIds } } : {}),
      },
    },
    { $group: { _id: '$sourceId', count: { $sum: 1 } } },
  ]);

  const sources: Record<string, number> = {};
  let total = 0;
  for (const row of perSource) {
    sources[row._id.toHexString()] = row.count;
    total += row.count;
  }

  // Map source unread counts onto their categories.
  const sourceList = await Source.find({ userId }).select('_id categoryId');
  const categories: Record<string, number> = {};
  for (const src of sourceList) {
    if (!src.categoryId) continue;
    const c = sources[src.id] ?? 0;
    if (c > 0) {
      const catKey = String(src.categoryId);
      categories[catKey] = (categories[catKey] ?? 0) + c;
    }
  }

  res.json({ all: total, categories, sources });
};
