import { describe, it, expect } from 'vitest';
import { pickFeedImage } from '../src/services/feedImage.js';

const link = 'https://example.com/posts/hello';

describe('pickFeedImage', () => {
  it('returns null when the item carries nothing usable', () => {
    expect(pickFeedImage({ link }, '<p>just text</p>')).toBeNull();
    expect(pickFeedImage({ link }, null)).toBeNull();
  });

  it('prefers media:content over an inline img and tags the result inline', () => {
    const item = {
      link,
      mediaContent: [{ $: { url: 'https://cdn.example.com/hero.jpg', medium: 'image' } }],
    };
    expect(pickFeedImage(item, '<img src="https://cdn.example.com/other.jpg">')).toEqual({
      url: 'https://cdn.example.com/hero.jpg',
      source: 'inline',
    });
  });

  it('skips media:content that is video and falls through', () => {
    const item = {
      link,
      mediaContent: [{ $: { url: 'https://cdn.example.com/clip.mp4', medium: 'video' } }],
      mediaThumbnail: [{ $: { url: 'https://cdn.example.com/thumb.jpg' } }],
    };
    expect(pickFeedImage(item, null)?.url).toBe('https://cdn.example.com/thumb.jpg');
  });

  it('accepts an image enclosure by MIME type and rejects audio', () => {
    expect(
      pickFeedImage({ link, enclosure: { url: 'https://cdn.example.com/a.bin', type: 'image/png' } }, null)?.url,
    ).toBe('https://cdn.example.com/a.bin');
    expect(
      pickFeedImage({ link, enclosure: { url: 'https://cdn.example.com/ep.mp3', type: 'audio/mpeg' } }, null),
    ).toBeNull();
  });

  it('falls back to an enclosure with an image extension when no type is given', () => {
    expect(pickFeedImage({ link, enclosure: { url: 'https://cdn.example.com/a.webp?w=800' } }, null)?.url).toBe(
      'https://cdn.example.com/a.webp?w=800',
    );
  });

  it('uses the first plausible inline img, resolving relative URLs against the link', () => {
    const html = '<p>Intro</p><img src="/img/photo.jpg" width="800" height="600" alt="">';
    expect(pickFeedImage({ link }, html)?.url).toBe('https://example.com/img/photo.jpg');
  });

  it('skips tracking pixels, tiny icons and data URIs in inline HTML', () => {
    const html = [
      '<img src="https://feeds.feedburner.com/~r/Foo/~4/abc" width="1" height="1">',
      "<img src='https://example.com/emoji.png' width='16' height='16'>",
      '<img src="data:image/gif;base64,R0lGODlh">',
      '<img data-src="https://cdn.example.com/lazy.jpg" src="https://s.w.org/images/core/emoji/x.svg">',
      '<img src=https://cdn.example.com/real.jpg>',
    ].join('');
    expect(pickFeedImage({ link }, html)?.url).toBe('https://cdn.example.com/lazy.jpg');
  });

  it('decodes HTML entities in URLs and rejects non-http schemes', () => {
    expect(pickFeedImage({ link }, '<img src="https://cdn.example.com/a.jpg?w=1&amp;h=2">')?.url).toBe(
      'https://cdn.example.com/a.jpg?w=1&h=2',
    );
    expect(pickFeedImage({ link }, '<img src="javascript:alert(1)">')).toBeNull();
  });

  it('drops media entries that declare a tiny size', () => {
    const item = {
      link,
      mediaContent: [{ $: { url: 'https://cdn.example.com/dot.png', medium: 'image', width: '1', height: '1' } }],
    };
    expect(pickFeedImage(item, null)).toBeNull();
  });
});
