import { decodeHTML } from 'entities';
import type { EntryImage } from '@a-rss/shared';

/**
 * Picks an illustration from what the RSS item itself carries, so a new entry has an
 * image the moment pollSource inserts it instead of waiting for the paywall-bypass
 * chain in processEntry to reach the article page. processEntry later upgrades this
 * to the page's og:image when it finds one; see the comment there.
 *
 * Pure and synchronous on purpose: it runs for every item on every poll.
 */

/** xml2js shape for a Media RSS element — attributes live under `$`. */
export interface MediaRssNode {
  $?: { url?: string; type?: string; medium?: string; width?: string; height?: string };
}

/** The subset of an rss-parser item this looks at. `mediaContent`/`mediaThumbnail`
 *  exist only because pollSource maps `media:content`/`media:thumbnail` via
 *  `customFields`; plain rss-parser items don't expose them. */
export interface FeedImageItem {
  link?: string;
  enclosure?: { url?: string; type?: string };
  mediaContent?: MediaRssNode[];
  mediaThumbnail?: MediaRssNode[];
}

// An image that declares itself smaller than this is a beacon, an emoji, or an icon,
// not an illustration. Undeclared sizes are allowed through.
const MIN_DIMENSION_PX = 50;
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|avif)(?:[?#]|$)/i;
// Tracking beacons and feed-generator chrome that commonly appear as the first <img>
// in feed bodies. Keep this short and obvious; a wrong image is better than none.
const JUNK_URL =
  /(feedburner\.com\/~|feedsportal\.com|doubleclick\.net|stats\.wordpress\.com|pixel\.wp\.com|s\.w\.org\/images\/core\/emoji|\/pixel\b|\/tracking\b|\/1x1\b)/i;

function normalizeUrl(raw: string | undefined | null, baseUrl: string | undefined): string | null {
  if (!raw) return null;
  const candidate = decodeHTML(raw.trim());
  if (!candidate || candidate.startsWith('data:')) return null;
  let url: URL;
  try {
    url = new URL(candidate, baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (JUNK_URL.test(url.href)) return null;
  return url.href;
}

function declaresTooSmall(width: string | undefined, height: string | undefined): boolean {
  const w = Number(width);
  const h = Number(height);
  // Non-numeric ("100%") or zero/absent dimensions say nothing, so they don't disqualify.
  return (
    (Number.isFinite(w) && w > 0 && w < MIN_DIMENSION_PX) ||
    (Number.isFinite(h) && h > 0 && h < MIN_DIMENSION_PX)
  );
}

function looksLikeImage(url: string, type: string | undefined, medium: string | undefined): boolean {
  if (medium) return medium === 'image';
  if (type) return type.toLowerCase().startsWith('image/');
  return IMAGE_EXTENSION.test(url);
}

function fromMediaRss(nodes: MediaRssNode[] | undefined, baseUrl: string | undefined): string | null {
  for (const node of nodes ?? []) {
    const attrs = node.$;
    if (!attrs) continue;
    const url = normalizeUrl(attrs.url, baseUrl);
    if (!url) continue;
    if (!looksLikeImage(url, attrs.type, attrs.medium)) continue;
    if (declaresTooSmall(attrs.width, attrs.height)) continue;
    return url;
  }
  return null;
}

function fromEnclosure(item: FeedImageItem, baseUrl: string | undefined): string | null {
  const url = normalizeUrl(item.enclosure?.url, baseUrl);
  if (!url) return null;
  return looksLikeImage(url, item.enclosure?.type, undefined) ? url : null;
}

// A regex scan rather than jsdom: this runs on every item of every poll, and we only
// need the first plausible <img src>, not a DOM. Handles quoted and bare attribute
// values and lazy-load `data-src`.
const IMG_TAG = /<img\b[^>]*>/gi;
const IMG_ATTR = /\b(src|data-src|width|height)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;

function fromInlineImg(html: string | undefined | null, baseUrl: string | undefined): string | null {
  if (!html) return null;
  for (const [tag] of html.matchAll(IMG_TAG)) {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(IMG_ATTR)) {
      attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
    }
    if (declaresTooSmall(attrs.width, attrs.height)) continue;
    const url = normalizeUrl(attrs.src, baseUrl) ?? normalizeUrl(attrs['data-src'], baseUrl);
    if (url) return url;
  }
  return null;
}

/**
 * Returns the best illustration the feed item offers, or null. Preference order is
 * explicit media (media:content, enclosure) over media:thumbnail (often a small crop)
 * over the first <img> in the body HTML. Relative URLs resolve against the item link.
 * The result is tagged `inline` so processEntry knows it may be replaced by og:image.
 */
export function pickFeedImage(item: FeedImageItem, bodyHtml: string | null | undefined): EntryImage | null {
  const baseUrl = item.link;
  const url =
    fromMediaRss(item.mediaContent, baseUrl) ??
    fromEnclosure(item, baseUrl) ??
    fromMediaRss(item.mediaThumbnail, baseUrl) ??
    fromInlineImg(bodyHtml, baseUrl);
  return url ? { url, source: 'inline' } : null;
}
