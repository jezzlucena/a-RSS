import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Entry } from '../models/entry.js';
import { Source } from '../models/source.js';
import { ReadReceipt } from '../models/readReceipt.js';
import { User } from '../models/user.js';
import { getUserId } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { processEntryNow } from '../services/agendaService.js';
import { extractArticle } from '../services/articleExtractor.js';
import { summarize } from '../services/summarizer.js';
import { decryptSecret } from '../services/userSecrets.js';
import { serializeEntry } from '../services/serializers.js';
import type { EntryDetail, EntrySummary } from '@a-rss/shared';

// When marking from a detail page (no specific feed context), use the broadest one.
// Other contexts still rely on the bulk mark-read flow.
const DETAIL_FEED_CONTEXT = 'all';
const setReadRequest = z.object({ read: z.boolean() });

interface FailedEntrySummary {
  id: string;
  sourceId: string;
  sourceTitle: string;
  url: string;
  title: string;
  publishedAt: string;
  updatedAt: string;
  error: string | null;
}

export const listFailures: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const docs = await Entry.find({ userId, processingState: 'failed' })
    .sort({ updatedAt: -1 })
    .limit(limit);

  const sourceIds = [...new Set(docs.map((d) => String(d.sourceId)))];
  const sources = await Source.find({ _id: { $in: sourceIds } }).select('title');
  const sourceTitles = new Map(sources.map((s) => [s.id, s.title]));

  const items: FailedEntrySummary[] = docs.map((d) => ({
    id: d.id,
    sourceId: String(d.sourceId),
    sourceTitle: sourceTitles.get(String(d.sourceId)) ?? 'Unknown',
    url: d.url,
    title: d.title,
    publishedAt: d.publishedAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    error: d.error ?? null,
  }));
  res.json({ items });
};

export const getEntry: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'not_found');
  const entry = await Entry.findOne({ _id: id, userId });
  if (!entry) throw new HttpError(404, 'not_found');

  const [source, anyReceipt] = await Promise.all([
    Source.findById(entry.sourceId).select('title categoryId'),
    ReadReceipt.findOne({ userId, entryId: entry._id }).select('_id'),
  ]);

  let articleText: string | null = null;
  let byline: string | null = null;
  if (entry.rawHtml) {
    try {
      const article = extractArticle(entry.rawHtml, entry.url);
      articleText = article.textContent || null;
      byline = article.byline;
    } catch {
      // leave both null on failure
    }
  }

  const base = serializeEntry(entry, {
    sourceTitle: source?.title ?? 'Unknown',
    categoryId: source?.categoryId ? String(source.categoryId) : null,
    isRead: !!anyReceipt,
  });
  const response: EntryDetail = { ...base, articleText, byline };
  res.json(response);
};

export const retryEntry: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'not_found');
  const entry = await Entry.findOne({ _id: id, userId });
  if (!entry) throw new HttpError(404, 'not_found');

  entry.processingState = 'pending';
  entry.error = null;
  await entry.save();
  await processEntryNow(entry.id);
  res.status(202).json({ enqueued: true });
};

export const summarizeEntry: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'not_found');
  const entry = await Entry.findOne({ _id: id, userId });
  if (!entry) throw new HttpError(404, 'not_found');

  // Already summarized — return the cached one without calling Claude.
  if (entry.summary) {
    const cached: EntrySummary = {
      intro: entry.summary.intro ?? null,
      bullets: entry.summary.bullets as [string, string, string],
      model: entry.summary.model,
      generatedAt: entry.summary.generatedAt.toISOString(),
    };
    res.json({ summary: cached, processingState: entry.processingState });
    return;
  }

  if (entry.processingState === 'pending') {
    throw new HttpError(409, 'not_ready', "Article hasn't been fetched yet — try again shortly");
  }
  if (entry.processingState === 'failed') {
    throw new HttpError(409, 'fetch_failed', 'The article could not be fetched');
  }
  if (!entry.rawHtml) {
    throw new HttpError(409, 'no_article_body', 'No article body available to summarize');
  }

  const article = extractArticle(entry.rawHtml, entry.url);
  if (!article.textContent || article.textContent.length < 200) {
    throw new HttpError(422, 'article_too_short', 'Extracted article body is too short to summarize');
  }

  const user = await User.findById(userId).select('anthropicApiKeyEnc');
  if (!user?.anthropicApiKeyEnc) {
    throw new HttpError(
      412,
      'anthropic_api_key_missing',
      'Set your Anthropic API key in Settings to summarize articles',
    );
  }
  const apiKey = decryptSecret(user.anthropicApiKeyEnc);

  const result = await summarize({
    title: entry.title,
    byline: article.byline,
    publishedAt: entry.publishedAt,
    articleText: article.textContent,
    apiKey,
  });

  entry.summary = {
    intro: result.intro,
    bullets: result.bullets,
    model: result.model,
    generatedAt: new Date(),
  };
  entry.processingState = 'summarized';
  entry.error = null;
  await entry.save();

  const response: EntrySummary = {
    intro: entry.summary.intro ?? null,
    bullets: entry.summary.bullets as [string, string, string],
    model: entry.summary.model,
    generatedAt: entry.summary.generatedAt.toISOString(),
  };
  res.json({ summary: response, processingState: 'summarized' });
};

export const setEntryRead: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'not_found');
  const entry = await Entry.findOne({ _id: id, userId }).select('_id');
  if (!entry) throw new HttpError(404, 'not_found');

  const { read } = setReadRequest.parse(req.body);
  if (read) {
    await ReadReceipt.updateOne(
      { userId, entryId: entry._id, feedContext: DETAIL_FEED_CONTEXT },
      {
        $setOnInsert: {
          userId,
          entryId: entry._id,
          feedContext: DETAIL_FEED_CONTEXT,
          readAt: new Date(),
        },
      },
      { upsert: true },
    );
  } else {
    // Unmark across all feed contexts so the entry reads as truly unread again.
    await ReadReceipt.deleteMany({ userId, entryId: entry._id });
  }
  res.json({ isRead: read });
};
