import { describe, it, expect } from 'vitest';
import { decodeCursorParts } from '../src/services/feedQuery.js';
import mongoose from 'mongoose';
import { encodeCursor, decodeCursor } from '../src/services/feedQuery.js';

describe('feed cursor', () => {
  const sample = {
    publishedAt: new Date('2026-04-25T18:30:00.000Z'),
    id: new mongoose.Types.ObjectId('65fffa1a2c5b9f0001a1b2c3'),
  };

  it('encodes to a base64url string', () => {
    const cursor = encodeCursor(sample);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    // URL-safe: no '+', '/', or '=' padding.
    expect(cursor).not.toContain('+');
    expect(cursor).not.toContain('/');
    expect(cursor).not.toContain('=');
  });

  it('decodes to a "less than" filter on desc', () => {
    const cursor = encodeCursor(sample);
    const filter = decodeCursor(cursor, 'desc') as {
      $or: Array<Record<string, unknown>>;
    };
    expect(filter.$or).toHaveLength(2);
    expect(filter.$or[0]).toEqual({ publishedAt: { $lt: sample.publishedAt } });
    const tieBreaker = filter.$or[1] as {
      publishedAt: Date;
      _id: { $lt: mongoose.Types.ObjectId };
    };
    expect(tieBreaker.publishedAt.getTime()).toBe(sample.publishedAt.getTime());
    expect(tieBreaker._id.$lt.toHexString()).toBe(sample.id.toHexString());
  });

  it('decodes to a "greater than" filter on asc', () => {
    const cursor = encodeCursor(sample);
    const filter = decodeCursor(cursor, 'asc') as {
      $or: Array<Record<string, unknown>>;
    };
    expect(filter.$or[0]).toEqual({ publishedAt: { $gt: sample.publishedAt } });
  });

  it('rejects malformed cursors', () => {
    expect(() => decodeCursor('not-a-cursor', 'desc')).toThrow();
  });
});

describe('decodeCursorParts', () => {
  it('round-trips an encoded (date, id) pair and rejects garbage', () => {
    const id = new (require('mongoose').Types.ObjectId)();
    const date = new Date('2026-09-06T12:00:00.000Z');
    const cursor = Buffer.from(`${date.toISOString()}|${id.toHexString()}`).toString('base64url');
    const parts = decodeCursorParts(cursor);
    expect(parts.publishedAt.toISOString()).toBe(date.toISOString());
    expect(parts.id.equals(id)).toBe(true);
    expect(() => decodeCursorParts('not-a-cursor')).toThrow();
    expect(() => decodeCursorParts(Buffer.from('nope|abc').toString('base64url'))).toThrow();
  });
});
