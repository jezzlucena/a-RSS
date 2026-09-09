import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSpeechRequest, splitSpeechText, updateSpeechSettingsRequest } from '@a-rss/shared';
import { buildSpeechSettings, classifySpeechError, createSpeech } from '../src/services/speech.js';
import { encryptSecret } from '../src/services/userSecrets.js';

const user = () => ({ speech: { provider: 'elevenlabs', apiKeyEnc: encryptSecret('private-key'), voiceId: 'voice-123', modelId: 'eleven_multilingual_v2' } });
afterEach(() => vi.unstubAllGlobals());

describe('speech settings and input', () => {
  it('defaults old accounts to system speech and never serializes keys', () => {
    expect(buildSpeechSettings({})).toMatchObject({ provider: 'system', configured: false });
    const settings = buildSpeechSettings(user());
    expect(settings).toMatchObject({ provider: 'elevenlabs', configured: true, voiceId: 'voice-123' });
    expect(JSON.stringify(settings)).not.toMatch(/private-key|apiKey|v1:/);
  });
  it('rejects blank, oversized and invalid settings input', () => {
    for (const text of ['', '  ', 'a'.repeat(4_001)]) expect(createSpeechRequest.safeParse({ text }).success).toBe(false);
    expect(updateSpeechSettingsRequest.safeParse({ voiceId: '../voices', apiKey: '' }).success).toBe(false);
    expect(updateSpeechSettingsRequest.parse({ provider: 'system' })).toEqual({ provider: 'system' });
  });
  it('splits long articles, unbroken words and emoji without losing text or exceeding the wire limit', () => {
    for (const text of ['hello world '.repeat(3_000).trim(), 'x'.repeat(9_001), '😀'.repeat(4_501)]) {
      const chunks = splitSpeechText(text);
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) expect(createSpeechRequest.safeParse({ text: chunk }).success).toBe(true);
      expect(chunks.join('').replace(/\s/g, '')).toBe(text.replace(/\s/g, ''));
      expect(chunks.every((part) => !/[\uD800-\uDBFF]$/.test(part))).toBe(true);
    }
  });
});

describe('ElevenLabs proxy', () => {
  it('sends the decrypted key only upstream, requests MP3 and returns raw audio', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/mpeg' } }));
    vi.stubGlobal('fetch', fetcher);
    expect(await createSpeech(user(), 'Title. Summary.')).toEqual(Buffer.from([1, 2, 3]));
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/voice-123?output_format=mp3_44100_128');
    expect(options.headers['xi-api-key']).toBe('private-key');
    expect(JSON.parse(options.body)).toEqual({ text: 'Title. Summary.', model_id: 'eleven_multilingual_v2' });
  });
  it('refuses unconfigured accounts before making a paid request', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(createSpeech({}, 'text')).rejects.toMatchObject({ code: 'speech_not_configured', retryable: false });
    await expect(createSpeech({ speech: { ...user().speech, provider: 'system' } }, 'text')).rejects.toMatchObject({ code: 'speech_not_configured' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    [401, undefined, 'speech_auth_failed', false],
    [403, undefined, 'speech_auth_failed', false],
    [401, 'quota_exceeded', 'speech_quota_exceeded', false],
    [402, undefined, 'speech_quota_exceeded', false],
    [404, undefined, 'speech_invalid_voice', false],
    [429, undefined, 'speech_rate_limited', true],
    [503, undefined, 'speech_unavailable', true],
    [422, undefined, 'speech_invalid_request', false],
  ])('classifies status %s / %s', (status, vendorCode, code, retryable) => {
    expect(classifySpeechError(status as number, vendorCode as string | undefined)).toMatchObject({ code, retryable });
  });
  it('does not leak upstream error bodies or automatically retry paid requests', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: { status: 'quota_exceeded', message: 'private article and key' } }), { status: 401 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(createSpeech(user(), 'article')).rejects.toMatchObject({ code: 'speech_quota_exceeded' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects non-audio and empty successful responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { headers: { 'content-type': 'application/json' } })));
    await expect(createSpeech(user(), 'text')).rejects.toMatchObject({ code: 'speech_invalid_audio' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { headers: { 'content-type': 'audio/mpeg' } })));
    await expect(createSpeech(user(), 'text')).rejects.toMatchObject({ code: 'speech_invalid_audio' });
  });
  it('preserves request cancellation', async () => {
    const controller = new AbortController(); controller.abort();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(controller.signal.reason));
    await expect(createSpeech(user(), 'text', controller.signal)).rejects.toBe(controller.signal.reason);
  });
});
