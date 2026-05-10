import { describe, it, expect } from 'vitest';
import { fetchArticle, FetcherError, type Strategy } from '../src/services/fetcher.js';

const ARTICLE_BODY = 'Lorem ipsum dolor sit amet. '.repeat(40); // ~1100 chars
const FULL_HTML = `
  <!doctype html><html><head><title>Real Article</title>
  <meta property="og:image" content="https://example.com/cover.jpg">
  </head><body>
    <article><h1>Real Article</h1><p>${ARTICLE_BODY}</p></article>
  </body></html>`;

const PAYWALL_HTML = `
  <!doctype html><html><body>
    <p>Subscribe to read this story.</p>
  </body></html>`;

function htmlResponse(html: string, finalUrl = 'https://news.example.com/story'): Response {
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
    // Response.url isn't writable from the constructor; we shadow it below.
  }) as Response & { url: string };
}

function makeResult(html: string, strategy: string, finalUrl = 'https://news.example.com/story') {
  return Promise.resolve({ html, finalUrl, strategy } as never);
}

describe('fetchArticle strategy chain', () => {
  it('falls through to the next strategy when extraction is too short', async () => {
    const calls: string[] = [];
    const googlebot: Strategy = async () => {
      calls.push('googlebot');
      return makeResult(PAYWALL_HTML, 'googlebot');
    };
    const wayback: Strategy = async () => {
      calls.push('wayback');
      return makeResult(FULL_HTML, 'wayback');
    };
    const result = await fetchArticle('https://news.example.com/story', {
      ladder: ['googlebot', 'wayback'],
      strategies: { googlebot, wayback },
      minLength: 500,
    });
    expect(calls).toEqual(['googlebot', 'wayback']);
    expect(result.fetch.strategy).toBe('wayback');
    expect(result.article.length).toBeGreaterThan(500);
    expect(result.article.imageUrl).toBe('https://example.com/cover.jpg');
  });

  it('returns the first strategy that yields enough content', async () => {
    const calls: string[] = [];
    const googlebot: Strategy = async () => {
      calls.push('googlebot');
      return makeResult(FULL_HTML, 'googlebot');
    };
    const wayback: Strategy = async () => {
      calls.push('wayback');
      return makeResult(FULL_HTML, 'wayback');
    };
    const result = await fetchArticle('https://news.example.com/story', {
      ladder: ['googlebot', 'wayback'],
      strategies: { googlebot, wayback },
    });
    expect(calls).toEqual(['googlebot']); // wayback never called
    expect(result.fetch.strategy).toBe('googlebot');
  });

  it('throws FetcherError with attempts when all strategies fail', async () => {
    const googlebot: Strategy = async () => {
      throw new Error('403 forbidden');
    };
    const wayback: Strategy = async () => {
      throw new Error('no snapshot');
    };
    await expect(
      fetchArticle('https://news.example.com/story', {
        ladder: ['googlebot', 'wayback'],
        strategies: { googlebot, wayback },
      }),
    ).rejects.toMatchObject({
      name: 'Error',
      attempts: [
        { strategy: 'googlebot', error: '403 forbidden' },
        { strategy: 'wayback', error: 'no snapshot' },
      ],
    } as Partial<FetcherError>);
  });

  it("respects an 'none' override by trying only the plain fetcher", async () => {
    let invoked = 0;
    const none: Strategy = async () => {
      invoked++;
      return makeResult(FULL_HTML, 'none');
    };
    const result = await fetchArticle('https://news.example.com/story', {
      override: 'none',
      strategies: { none },
    });
    expect(invoked).toBe(1);
    expect(result.fetch.strategy).toBe('none');
  });
});

// Touch the test helper so unused-warning doesn't trip strict mode.
void htmlResponse;
