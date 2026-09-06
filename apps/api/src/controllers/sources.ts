import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { createSourceRequest, updateSourceRequest } from '@a-rss/shared';
import { Source } from '../models/source.js';
import { Category } from '../models/category.js';
import { Entry } from '../models/entry.js';
import { getUserId } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { serializeSource } from '../services/serializers.js';
import { fetchFeedMetadata } from '../services/feedMetadata.js';
import { schedulePoll, unschedulePoll, pollNow } from '../services/agendaService.js';
import { pollSource } from '../jobs/pollSource.js';

async function assertCategoryOwned(userId: string, categoryId?: string | null): Promise<void> {
  if (!categoryId) return;
  if (!mongoose.isValidObjectId(categoryId)) throw new HttpError(400, 'invalid_category');
  const cat = await Category.findOne({ _id: categoryId, userId });
  if (!cat) throw new HttpError(400, 'invalid_category', 'Category not found');
}

export const listSources: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const sources = await Source.find({ userId }).sort({ title: 1 });
  res.json(sources.map(serializeSource));
};

export const createSource: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const body = createSourceRequest.parse(req.body);
  await assertCategoryOwned(userId, body.categoryId);

  const existing = await Source.findOne({ userId, feedUrl: body.feedUrl });
  if (existing) throw new HttpError(409, 'source_exists', 'You already follow that feed');

  let metadata;
  try {
    metadata = await fetchFeedMetadata(body.feedUrl);
  } catch (err) {
    throw new HttpError(
      400,
      'invalid_feed',
      `Could not fetch or parse feed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const source = await Source.create({
    userId,
    feedUrl: body.feedUrl,
    siteUrl: metadata.siteUrl,
    title: metadata.title,
    categoryId: body.categoryId ?? null,
    bypassStrategy: body.bypassStrategy ?? 'default',
  });
  await schedulePoll(source.id, source.pollIntervalMs);
  // Kick off an immediate poll so entries appear without waiting for the first interval.
  await pollNow(source.id);
  res.status(201).json(serializeSource(source));
};

export const updateSource: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'not_found');
  const body = updateSourceRequest.parse(req.body);
  // null clears the category (no ownership to check); a string must be one of the user's.
  if (body.categoryId) await assertCategoryOwned(userId, body.categoryId);

  // Mark titleOverridden so subsequent polls don't clobber the user's custom title.
  const update: Record<string, unknown> = { ...body };
  if (typeof body.title === 'string') {
    update.titleOverridden = true;
  }

  const source = await Source.findOneAndUpdate({ _id: id, userId }, { $set: update }, { new: true });
  if (!source) throw new HttpError(404, 'not_found');
  res.json(serializeSource(source));
};

export const deleteSource: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'not_found');
  const source = await Source.findOneAndDelete({ _id: id, userId });
  if (!source) throw new HttpError(404, 'not_found');
  await unschedulePoll(id);
  await Entry.deleteMany({ sourceId: id });
  res.status(204).end();
};

/**
 * Enqueue a poll cycle for the user's sources, optionally filtered by a feed view
 * (`all`, `category:<id>`, or `source:<id>`). Returns immediately with the count of
 * sources queued; the agenda jobs run in the background.
 */
export const refreshSources: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const view = typeof req.body?.view === 'string' ? (req.body.view as string) : 'all';

  let filter: Record<string, unknown>;
  if (view === 'all') {
    filter = { userId };
  } else if (view.startsWith('category:')) {
    const categoryId = view.slice('category:'.length);
    if (!mongoose.isValidObjectId(categoryId)) throw new HttpError(400, 'invalid_view');
    filter = { userId, categoryId };
  } else if (view.startsWith('source:')) {
    const sourceId = view.slice('source:'.length);
    if (!mongoose.isValidObjectId(sourceId)) throw new HttpError(400, 'invalid_view');
    const owned = await Source.findOne({ _id: sourceId, userId }).select('_id');
    if (!owned) throw new HttpError(404, 'source_not_found');
    filter = { _id: owned._id };
  } else {
    throw new HttpError(400, 'invalid_view');
  }

  const sources = await Source.find(filter).select('_id');
  for (const s of sources) {
    await pollNow(s.id);
  }
  res.status(202).json({ enqueued: sources.length });
};

export const refreshSource: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'not_found');
  const source = await Source.findOne({ _id: id, userId });
  if (!source) throw new HttpError(404, 'not_found');

  try {
    await pollSource(source.id);
  } catch (err) {
    throw new HttpError(
      502,
      'refresh_failed',
      `Could not refresh feed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const updated = await Source.findById(source.id);
  res.json(serializeSource(updated!));
};
