import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import type { CategoryDoc } from '../models/category.js';
import type { SourceDoc } from '../models/source.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  // Keep arrays predictable: outline can be one or many; force array.
  isArray: (name) => name === 'outline',
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  indentBy: '  ',
});

export interface ParsedOpml {
  uncategorized: ParsedFeed[];
  categories: { name: string; feeds: ParsedFeed[] }[];
}

export interface ParsedFeed {
  feedUrl: string;
  siteUrl: string | null;
  title: string;
}

interface OutlineNode {
  '@_type'?: string;
  '@_text'?: string;
  '@_title'?: string;
  '@_xmlUrl'?: string;
  '@_htmlUrl'?: string;
  outline?: OutlineNode[];
}

function pickFeed(node: OutlineNode): ParsedFeed | null {
  const feedUrl = node['@_xmlUrl'];
  if (!feedUrl) return null;
  const title = (node['@_title'] ?? node['@_text'] ?? feedUrl).trim().slice(0, 200);
  return { feedUrl, siteUrl: node['@_htmlUrl'] ?? null, title };
}

export function parseOpml(xml: string): ParsedOpml {
  const tree = parser.parse(xml) as { opml?: { body?: { outline?: OutlineNode[] } } };
  const top = tree.opml?.body?.outline ?? [];
  const uncategorized: ParsedFeed[] = [];
  const categories: ParsedOpml['categories'] = [];

  for (const node of top) {
    const directFeed = pickFeed(node);
    if (directFeed) {
      uncategorized.push(directFeed);
      continue;
    }
    // Treat as category container.
    const name = (node['@_title'] ?? node['@_text'] ?? '').trim();
    if (!name) continue;
    const feeds: ParsedFeed[] = [];
    for (const child of node.outline ?? []) {
      const f = pickFeed(child);
      if (f) feeds.push(f);
    }
    if (feeds.length > 0) categories.push({ name, feeds });
  }

  return { uncategorized, categories };
}

export interface BuildOpmlInput {
  title: string;
  categories: { name: string; sources: SourceDoc[] }[];
  uncategorized: SourceDoc[];
}

function feedOutline(s: SourceDoc): OutlineNode {
  return {
    '@_type': 'rss',
    '@_text': s.title,
    '@_title': s.title,
    '@_xmlUrl': s.feedUrl,
    ...(s.siteUrl ? { '@_htmlUrl': s.siteUrl } : {}),
  };
}

export function buildOpml({ title, categories, uncategorized }: BuildOpmlInput): string {
  const outlines: OutlineNode[] = [];
  for (const c of categories) {
    outlines.push({
      '@_text': c.name,
      '@_title': c.name,
      outline: c.sources.map(feedOutline),
    });
  }
  for (const s of uncategorized) outlines.push(feedOutline(s));

  const doc = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    opml: {
      '@_version': '2.0',
      head: { title, dateCreated: new Date().toUTCString() },
      body: { outline: outlines },
    },
  };
  return builder.build(doc);
}

export function groupSourcesByCategory(
  sources: SourceDoc[],
  categories: CategoryDoc[],
): BuildOpmlInput['categories'] & { _uncategorized: SourceDoc[] } {
  const byId = new Map<string, CategoryDoc>();
  for (const c of categories) byId.set(c.id, c);
  const grouped = new Map<string, SourceDoc[]>();
  const uncategorized: SourceDoc[] = [];
  for (const s of sources) {
    if (!s.categoryId) {
      uncategorized.push(s);
      continue;
    }
    const key = String(s.categoryId);
    const arr = grouped.get(key) ?? [];
    arr.push(s);
    grouped.set(key, arr);
  }
  const out = [] as BuildOpmlInput['categories'];
  for (const [catId, list] of grouped) {
    const cat = byId.get(catId);
    if (!cat) {
      uncategorized.push(...list);
      continue;
    }
    out.push({ name: cat.name, sources: list });
  }
  // Stable order for consistent exports.
  out.sort((a, b) => a.name.localeCompare(b.name));
  // Hack: tack the uncategorized list onto the returned array so the caller can read both.
  Object.assign(out, { _uncategorized: uncategorized });
  return out as BuildOpmlInput['categories'] & { _uncategorized: SourceDoc[] };
}
