import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export interface ExtractedArticle {
  title: string;
  textContent: string;
  excerpt: string;
  byline: string | null;
  length: number;
  imageUrl: string | null;
}

function absoluteUrl(maybeRelative: string, baseUrl: string): string | null {
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return null;
  }
}

function pickImage(doc: Document, baseUrl: string): string | null {
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
  if (ogImage) return absoluteUrl(ogImage, baseUrl);
  const twitterImage = doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
  if (twitterImage) return absoluteUrl(twitterImage, baseUrl);
  const firstFigureImg = doc.querySelector('article img, figure img');
  const src = firstFigureImg?.getAttribute('src');
  if (src) return absoluteUrl(src, baseUrl);
  return null;
}

export function extractArticle(html: string, baseUrl: string): ExtractedArticle {
  const dom = new JSDOM(html, { url: baseUrl });
  const doc = dom.window.document;
  const imageUrl = pickImage(doc, baseUrl);

  const reader = new Readability(doc);
  const parsed = reader.parse();
  if (!parsed) {
    return { title: '', textContent: '', excerpt: '', byline: null, length: 0, imageUrl };
  }
  return {
    title: parsed.title ?? '',
    textContent: parsed.textContent?.trim() ?? '',
    excerpt: parsed.excerpt ?? '',
    byline: parsed.byline ?? null,
    length: parsed.length ?? (parsed.textContent?.trim().length ?? 0),
    imageUrl,
  };
}
