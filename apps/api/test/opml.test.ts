import { describe, it, expect } from 'vitest';
import { parseOpml, buildOpml } from '../src/services/opml.js';

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>my subs</title></head>
  <body>
    <outline title="Tech" text="Tech">
      <outline type="rss" title="The Verge"
               xmlUrl="https://www.theverge.com/rss/index.xml"
               htmlUrl="https://www.theverge.com"/>
      <outline type="rss" title="Hacker News"
               xmlUrl="https://news.ycombinator.com/rss"/>
    </outline>
    <outline type="rss" title="BBC News"
             xmlUrl="http://feeds.bbci.co.uk/news/rss.xml"
             htmlUrl="https://www.bbc.co.uk/news"/>
  </body>
</opml>`;

describe('OPML parse/build', () => {
  it('parses categories and feeds correctly', () => {
    const parsed = parseOpml(SAMPLE);
    expect(parsed.categories).toHaveLength(1);
    expect(parsed.categories[0].name).toBe('Tech');
    expect(parsed.categories[0].feeds.map((f) => f.title)).toEqual(['The Verge', 'Hacker News']);
    expect(parsed.uncategorized).toHaveLength(1);
    expect(parsed.uncategorized[0].title).toBe('BBC News');
    expect(parsed.uncategorized[0].siteUrl).toBe('https://www.bbc.co.uk/news');
  });

  it('round-trips: parse(build(...)) preserves structure', () => {
    type FakeSource = {
      id: string;
      title: string;
      feedUrl: string;
      siteUrl: string | null;
    };
    const verge: FakeSource = {
      id: 'a',
      title: 'The Verge',
      feedUrl: 'https://www.theverge.com/rss/index.xml',
      siteUrl: 'https://www.theverge.com',
    };
    const bbc: FakeSource = {
      id: 'b',
      title: 'BBC News',
      feedUrl: 'http://feeds.bbci.co.uk/news/rss.xml',
      siteUrl: null,
    };

    const xml = buildOpml({
      title: 'a-RSS subscriptions',
      // SourceDoc shape is wider than what we use here; cast just for the test.
      categories: [{ name: 'Tech', sources: [verge as never] }],
      uncategorized: [bbc as never],
    });
    const reparsed = parseOpml(xml);
    expect(reparsed.categories).toHaveLength(1);
    expect(reparsed.categories[0].name).toBe('Tech');
    expect(reparsed.categories[0].feeds[0].feedUrl).toBe(verge.feedUrl);
    expect(reparsed.uncategorized).toHaveLength(1);
    expect(reparsed.uncategorized[0].feedUrl).toBe(bbc.feedUrl);
  });
});
