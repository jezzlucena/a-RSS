import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { apiBlob } = vi.hoisted(() => ({ apiBlob: vi.fn() }));
vi.mock('@/lib/api', () => ({ apiBlob }));

class FakeSource {
  buffer: unknown;
  onended: (() => void) | null = null;
  connect = vi.fn(); disconnect = vi.fn(); start = vi.fn(); stop = vi.fn();
}
class FakeContext {
  static all: FakeContext[] = [];
  destination = {};
  sources: FakeSource[] = [];
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  decodeAudioData = vi.fn().mockResolvedValue({});
  constructor() { FakeContext.all.push(this); }
  createBufferSource() { const source = new FakeSource(); this.sources.push(source); return source; }
}

beforeEach(() => {
  vi.resetModules(); apiBlob.mockReset(); FakeContext.all = [];
  vi.stubGlobal('window', {});
  vi.stubGlobal('AudioContext', FakeContext);
});
afterEach(() => vi.unstubAllGlobals());

it('cancels generation before its response can start audio', async () => {
  let resolve!: (blob: Blob) => void;
  apiBlob.mockImplementation(() => new Promise<Blob>((done) => { resolve = done; }));
  const reader = await import('@/lib/readAloud');
  reader.toggleReadAloud('a', 'Article.', 'elevenlabs');
  // The audio context is resumed synchronously inside the click handler.
  expect(FakeContext.all[0].resume).toHaveBeenCalledTimes(1);
  await vi.waitFor(() => expect(apiBlob).toHaveBeenCalledTimes(1));
  const signal = apiBlob.mock.calls[0][1].signal as AbortSignal;
  reader.stopReadAloud('a');
  expect(signal.aborted).toBe(true);
  resolve(new Blob(['mp3']));
  await Promise.resolve(); await Promise.resolve();
  expect(FakeContext.all[0].sources).toHaveLength(0);
});

it('a stale response or error cannot stop replacement playback', async () => {
  let reject!: (error: Error) => void;
  apiBlob.mockImplementationOnce(() => new Promise<Blob>((_, fail) => { reject = fail; }))
    .mockResolvedValue(new Blob(['mp3']));
  const reader = await import('@/lib/readAloud');
  const error = vi.fn();
  reader.toggleReadAloud('a', 'Old.', 'elevenlabs', error);
  await vi.waitFor(() => expect(apiBlob).toHaveBeenCalledTimes(1));
  reader.toggleReadAloud('b', 'New.', 'elevenlabs', error);
  await vi.waitFor(() => expect(FakeContext.all[1].sources).toHaveLength(1));
  reject(new Error('Late response'));
  await Promise.resolve(); await Promise.resolve();
  expect(error).not.toHaveBeenCalled();
  expect(FakeContext.all[1].close).not.toHaveBeenCalled();
  reader.stopReadAloud('a');
  expect(FakeContext.all[1].close).not.toHaveBeenCalled();
  reader.stopReadAloud('b');
});

it('requests the next segment only after audio ends and releases it on Stop', async () => {
  apiBlob.mockResolvedValue(new Blob(['mp3']));
  const reader = await import('@/lib/readAloud');
  reader.toggleReadAloud('a', 'word '.repeat(1_200), 'elevenlabs');
  await vi.waitFor(() => expect(FakeContext.all[0].sources).toHaveLength(1));
  expect(apiBlob).toHaveBeenCalledTimes(1);
  expect(apiBlob.mock.calls[0][1].body.text.length).toBeLessThanOrEqual(4_000);
  FakeContext.all[0].sources[0].onended?.();
  await vi.waitFor(() => expect(FakeContext.all[0].sources).toHaveLength(2));
  reader.stopReadAloud();
  expect(FakeContext.all[0].sources[1].stop).toHaveBeenCalledTimes(1);
  expect(FakeContext.all[0].close).toHaveBeenCalledTimes(1);
});

it('surfaces provider failures once without switching voices silently', async () => {
  apiBlob.mockRejectedValue(new Error('Quota exhausted'));
  const reader = await import('@/lib/readAloud');
  const error = vi.fn();
  reader.toggleReadAloud('a', 'Article.', 'elevenlabs', error);
  await vi.waitFor(() => expect(error).toHaveBeenCalledTimes(1));
  expect(error.mock.calls[0][0].message).toBe('Quota exhausted');
  expect(FakeContext.all[0].close).toHaveBeenCalledTimes(1);
});
