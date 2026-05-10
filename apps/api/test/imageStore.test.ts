import { describe, it, expect } from 'vitest';
import { buildPublicUrl } from '../src/services/imageStore.js';

describe('buildPublicUrl', () => {
  it('returns a real-S3 virtual-hosted URL when no endpoint is set', () => {
    const url = buildPublicUrl({
      region: 'us-east-1',
      bucket: 'arss-images',
      forcePathStyle: false,
      key: 'entries/abc/cover.jpg',
    });
    expect(url).toBe('https://arss-images.s3.us-east-1.amazonaws.com/entries/abc/cover.jpg');
  });

  it('returns a path-style URL against a custom endpoint (MinIO in dev)', () => {
    const url = buildPublicUrl({
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      bucket: 'arss-images',
      forcePathStyle: true,
      key: 'entries/abc/cover.jpg',
    });
    expect(url).toBe('http://localhost:9000/arss-images/entries/abc/cover.jpg');
  });

  it('strips a trailing slash from the endpoint', () => {
    const url = buildPublicUrl({
      endpoint: 'http://localhost:9000/',
      region: 'us-east-1',
      bucket: 'arss-images',
      forcePathStyle: true,
      key: 'entries/x/y.png',
    });
    expect(url).toBe('http://localhost:9000/arss-images/entries/x/y.png');
  });

  it('returns a virtual-hosted URL on a custom endpoint when forcePathStyle is false', () => {
    const url = buildPublicUrl({
      endpoint: 'https://s3.example.com',
      region: 'us-east-1',
      bucket: 'arss-images',
      forcePathStyle: false,
      key: 'entries/abc/cover.jpg',
    });
    expect(url).toBe('https://arss-images.s3.example.com/entries/abc/cover.jpg');
  });
});
