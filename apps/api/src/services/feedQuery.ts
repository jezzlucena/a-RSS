import mongoose from 'mongoose';
import { parseFeedView, type FeedView, type FeedOrder } from '@a-rss/shared';
import { Source } from '../models/source.js';
import { HttpError } from '../middleware/errors.js';

export async function buildBaseFilter(userId: string, view: FeedView): Promise<{
  userId: mongoose.Types.ObjectId;
  sourceId?: mongoose.Types.ObjectId | { $in: mongoose.Types.ObjectId[] };
}> {
  const parsed = parseFeedView(view);
  const filter: {
    userId: mongoose.Types.ObjectId;
    sourceId?: mongoose.Types.ObjectId | { $in: mongoose.Types.ObjectId[] };
  } = { userId: new mongoose.Types.ObjectId(userId) };

  if (parsed.kind === 'source') {
    if (!mongoose.isValidObjectId(parsed.id)) throw new HttpError(400, 'invalid_view');
    // Make sure the user owns the source.
    const owned = await Source.findOne({ _id: parsed.id, userId }).select('_id');
    if (!owned) throw new HttpError(404, 'source_not_found');
    filter.sourceId = new mongoose.Types.ObjectId(parsed.id);
  } else if (parsed.kind === 'category') {
    if (!mongoose.isValidObjectId(parsed.id)) throw new HttpError(400, 'invalid_view');
    const sources = await Source.find({ userId, categoryId: parsed.id }).select('_id');
    filter.sourceId = { $in: sources.map((s) => s._id) };
  }
  return filter;
}

export interface CursorPart {
  publishedAt: Date;
  id: mongoose.Types.ObjectId;
}

export function encodeCursor(part: CursorPart): string {
  return Buffer.from(`${part.publishedAt.toISOString()}|${part.id.toHexString()}`).toString(
    'base64url',
  );
}

export function decodeCursor(cursor: string, order: FeedOrder): Record<string, unknown> {
  let raw: string;
  try {
    raw = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    throw new HttpError(400, 'invalid_cursor');
  }
  const [iso, idHex] = raw.split('|');
  if (!iso || !idHex || !mongoose.isValidObjectId(idHex)) {
    throw new HttpError(400, 'invalid_cursor');
  }
  const date = new Date(iso);
  const id = new mongoose.Types.ObjectId(idHex);
  if (order === 'desc') {
    return { $or: [{ publishedAt: { $lt: date } }, { publishedAt: date, _id: { $lt: id } }] };
  }
  return { $or: [{ publishedAt: { $gt: date } }, { publishedAt: date, _id: { $gt: id } }] };
}
