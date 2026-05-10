import type { BypassStrategy } from '@a-rss/shared';
import { env } from '../config/env.js';
import { extractArticle, type ExtractedArticle } from './articleExtractor.js';

export interface FetchResult {
  html: string;
  finalUrl: string;
  strategy: StrategyName;
}

export interface FetchedArticle {
  fetch: FetchResult;
  article: ExtractedArticle;
}

export type StrategyName = 'ladder' | 'googlebot' | 'wayback' | 'archive_ph' | 'none';

export type Strategy = (url: string, opts: { signal?: AbortSignal }) => Promise<FetchResult>;

const GOOGLEBOT_UA =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const BROWSERY_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function readResponse(res: Response, strategy: StrategyName): Promise<FetchResult> {
  if (!res.ok) throw new Error(`${strategy}: HTTP ${res.status}`);
  return { html: await res.text(), finalUrl: res.url, strategy };
}

export const fetchPlain: Strategy = async (url, { signal }) => {
  const res = await fetch(url, { signal, headers: { 'User-Agent': BROWSERY_UA } });
  return readResponse(res, 'none');
};

export const fetchGooglebot: Strategy = async (url, { signal }) => {
  const res = await fetch(url, {
    signal,
    headers: {
      'User-Agent': GOOGLEBOT_UA,
      'Referer': 'https://news.google.com/',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  return readResponse(res, 'googlebot');
};

export const fetchWayback: Strategy = async (url, { signal }) => {
  const apiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
  const apiRes = await fetch(apiUrl, { signal, headers: { 'User-Agent': BROWSERY_UA } });
  if (!apiRes.ok) throw new Error(`wayback API HTTP ${apiRes.status}`);
  const apiData = (await apiRes.json()) as {
    archived_snapshots?: { closest?: { available?: boolean; url?: string; timestamp?: string } };
  };
  const closest = apiData.archived_snapshots?.closest;
  if (!closest?.available || !closest.url) throw new Error('wayback: no snapshot available');
  // Inject id_ flag so we get the raw page without Wayback chrome.
  const rawUrl = closest.url.replace(/(\/web\/\d+)(\/)/, '$1id_$2');
  const res = await fetch(rawUrl, { signal, headers: { 'User-Agent': BROWSERY_UA } });
  return readResponse(res, 'wayback');
};

export const fetchArchivePh: Strategy = async (url, { signal }) => {
  const res = await fetch(`https://archive.ph/newest/${url}`, {
    signal,
    redirect: 'follow',
    headers: { 'User-Agent': BROWSERY_UA },
  });
  return readResponse(res, 'archive_ph');
};

/**
 * Ladder is a self-hosted paywall-bypass proxy (https://github.com/everywall/ladder).
 * Calling `${LADDER_URL}/<original-url>` returns the article HTML without subscription
 * gating. The original URL is appended verbatim — Ladder's router parses it directly,
 * so we do NOT URL-encode it.
 */
export const fetchLadder: Strategy = async (url, { signal }) => {
  const base = env.LADDER_URL.replace(/\/$/, '');
  const res = await fetch(`${base}/${url}`, {
    signal,
    headers: { 'User-Agent': BROWSERY_UA },
  });
  return readResponse(res, 'ladder');
};

const STRATEGIES: Record<StrategyName, Strategy> = {
  ladder: fetchLadder,
  googlebot: fetchGooglebot,
  wayback: fetchWayback,
  archive_ph: fetchArchivePh,
  none: fetchPlain,
};

const STRATEGY_NAMES = new Set(Object.keys(STRATEGIES) as StrategyName[]);
function isStrategyName(s: string): s is StrategyName {
  return STRATEGY_NAMES.has(s as StrategyName);
}

export function resolveLadder(override?: BypassStrategy): StrategyName[] {
  if (override === 'none') return ['none'];
  if (override && override !== 'default') return [override];
  return env.PAYWALL_STRATEGIES.split(',')
    .map((s) => s.trim())
    .filter(isStrategyName);
}

export interface FetchArticleOptions {
  override?: BypassStrategy;
  minLength?: number;
  signal?: AbortSignal;
  // Test seam: inject custom strategies (and ladder) — defaults to env-configured chain.
  ladder?: StrategyName[];
  strategies?: Partial<Record<StrategyName, Strategy>>;
}

export interface FetchAttempt {
  strategy: StrategyName;
  error: string;
}

export class FetcherError extends Error {
  constructor(message: string, public attempts: FetchAttempt[]) {
    super(message);
  }
}

export async function fetchArticle(
  url: string,
  opts: FetchArticleOptions = {},
): Promise<FetchedArticle> {
  const ladder = opts.ladder ?? resolveLadder(opts.override);
  const minLength = opts.minLength ?? 500;
  const strategies = { ...STRATEGIES, ...(opts.strategies ?? {}) };
  const attempts: FetchAttempt[] = [];

  for (const name of ladder) {
    const strat = strategies[name];
    if (!strat) {
      attempts.push({ strategy: name, error: 'unknown strategy' });
      continue;
    }
    try {
      const result = await strat(url, { signal: opts.signal });
      const article = extractArticle(result.html, result.finalUrl);
      if (article.length >= minLength) {
        return { fetch: result, article };
      }
      attempts.push({
        strategy: name,
        error: `extraction too short (${article.length} chars, need ${minLength})`,
      });
    } catch (err) {
      attempts.push({ strategy: name, error: err instanceof Error ? err.message : String(err) });
    }
  }

  throw new FetcherError(
    `All ${attempts.length} fetch strategies failed for ${url}`,
    attempts,
  );
}
