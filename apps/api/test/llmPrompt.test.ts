import { describe, it, expect } from 'vitest';
import { SYSTEM_PROMPT, MAX_ARTICLE_CHARS, buildUserMessage, parseSummaryOutput, SummaryParseError } from '../src/services/llm/prompt.js';

describe('buildUserMessage', () => {
  const base = { title: 'Hello', byline: null, publishedAt: new Date('2026-09-06T12:00:00.000Z'), articleText: 'Body text' };

  it('lays out title, published date and body, omitting an absent byline', () => {
    // The blank separator line is filtered out by the existing `filter(Boolean)`; kept as-is so
    // the message every provider receives doesn't change.
    expect(buildUserMessage(base)).toBe('Title: Hello\nPublished: 2026-09-06T12:00:00.000Z\nBody:\nBody text');
  });

  it('includes the byline when present', () => {
    expect(buildUserMessage({ ...base, byline: 'By Ada' })).toContain('Byline: By Ada');
  });

  it('truncates long articles with a marker', () => {
    const message = buildUserMessage({ ...base, articleText: 'x'.repeat(MAX_ARTICLE_CHARS + 10) });
    expect(message).toContain('…[truncated for length]');
    expect(message.length).toBeLessThan(MAX_ARTICLE_CHARS + 200);
  });
});

describe('parseSummaryOutput', () => {
  const good = '{"intro":"Intro.","bullets":["a","b","c"]}';

  it('parses bare JSON', () => {
    expect(parseSummaryOutput(good)).toEqual({ intro: 'Intro.', bullets: ['a', 'b', 'c'] });
  });

  it('strips json and plain code fences and surrounding whitespace', () => {
    expect(parseSummaryOutput(`\n\`\`\`json\n${good}\n\`\`\`\n`).bullets).toHaveLength(3);
    expect(parseSummaryOutput(`\`\`\`\n${good}\n\`\`\``).intro).toBe('Intro.');
  });

  it('rejects the wrong number of bullets, an empty intro, and non-JSON with SummaryParseError', () => {
    expect(() => parseSummaryOutput('{"intro":"x","bullets":["a","b"]}')).toThrow(SummaryParseError);
    expect(() => parseSummaryOutput('{"intro":"x","bullets":["a","b","c","d"]}')).toThrow(SummaryParseError);
    expect(() => parseSummaryOutput('{"intro":"","bullets":["a","b","c"]}')).toThrow(SummaryParseError);
    expect(() => parseSummaryOutput('Sure! Here is the summary:')).toThrow(SummaryParseError);
  });
});

describe('SYSTEM_PROMPT', () => {
  it('still demands the strict JSON contract the parser expects', () => {
    expect(SYSTEM_PROMPT).toContain('{"intro":"…","bullets":["…","…","…"]}');
    expect(SYSTEM_PROMPT.endsWith('return only the JSON object.')).toBe(true);
  });
});
