import { describe, it, expect } from 'vitest';
import { ttlToMs, hashOpaqueToken, generateOpaqueToken } from '../src/services/tokens.js';

describe('ttlToMs', () => {
  it('parses common unit suffixes', () => {
    expect(ttlToMs('15m')).toBe(15 * 60_000);
    expect(ttlToMs('30d')).toBe(30 * 86_400_000);
    expect(ttlToMs('12h')).toBe(12 * 3_600_000);
    expect(ttlToMs('45s')).toBe(45_000);
    expect(ttlToMs('2w')).toBe(2 * 604_800_000);
  });

  it('throws on malformed input', () => {
    expect(() => ttlToMs('15')).toThrow(/invalid ttl/);
    expect(() => ttlToMs('abc')).toThrow(/invalid ttl/);
    expect(() => ttlToMs('15min')).toThrow(/invalid ttl/);
    expect(() => ttlToMs('')).toThrow(/invalid ttl/);
  });
});

describe('hashOpaqueToken', () => {
  it('produces a stable SHA-256 hex digest', () => {
    const a = hashOpaqueToken('hello-world');
    const b = hashOpaqueToken('hello-world');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is sensitive to single-byte changes', () => {
    const a = hashOpaqueToken('hello-world');
    const b = hashOpaqueToken('hello-worlD');
    expect(a).not.toBe(b);
  });
});

describe('generateOpaqueToken', () => {
  it('returns a base64url string and its hex hash', () => {
    const { token, hash } = generateOpaqueToken();
    // 32 random bytes encoded as base64url ≈ 43 chars (no padding)
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,48}$/);
    expect(hash).toBe(hashOpaqueToken(token));
  });

  it('is non-deterministic', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a.token).not.toBe(b.token);
  });
});
