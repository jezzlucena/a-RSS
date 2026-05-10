import { describe, it, expect } from 'vitest';
import { adaptInterval, MIN_INTERVAL_MS, MAX_INTERVAL_MS } from '../src/jobs/pollSource.js';

describe('adaptInterval', () => {
  it('shrinks when new entries arrive', () => {
    const next = adaptInterval(30 * 60_000, true);
    expect(next).toBe(15 * 60_000);
  });

  it('grows when nothing changed', () => {
    const next = adaptInterval(20 * 60_000, false);
    expect(next).toBe(30 * 60_000);
  });

  it('clamps to the floor on shrink', () => {
    const next = adaptInterval(MIN_INTERVAL_MS, true);
    expect(next).toBe(MIN_INTERVAL_MS);
  });

  it('clamps to the ceiling on grow', () => {
    const next = adaptInterval(MAX_INTERVAL_MS, false);
    expect(next).toBe(MAX_INTERVAL_MS);
  });

  it('walks toward the floor while new entries keep arriving', () => {
    let current = MAX_INTERVAL_MS; // 60min
    current = adaptInterval(current, true); // 30
    expect(current).toBe(30 * 60_000);
    current = adaptInterval(current, true); // 15
    expect(current).toBe(15 * 60_000);
    current = adaptInterval(current, true); // 7.5 (above floor of 5)
    expect(current).toBe(7.5 * 60_000);
    current = adaptInterval(current, true); // 3.75 → clamped to 5
    expect(current).toBe(MIN_INTERVAL_MS);
  });
});
