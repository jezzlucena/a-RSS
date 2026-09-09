import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

it('downloads audio through the same refresh-and-replay path as JSON', async () => {
  vi.resetModules();
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response('{"error":"invalid_token"}', { status: 401 }))
    .mockResolvedValueOnce(new Response('{"accessToken":"fresh","expiresIn":900}'))
    .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'audio/mpeg' } }));
  vi.stubGlobal('fetch', fetcher);
  const { apiBlob, setAccessToken } = await import('@/lib/api');
  setAccessToken('expired');
  const blob = await apiBlob('/speech', { method: 'POST', body: { text: 'Summary.' } });
  expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3]);
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/api/v1/speech', '/api/v1/auth/refresh', '/api/v1/speech']);
  expect(fetcher.mock.calls[2][1].headers.Authorization).toBe('Bearer fresh');
});

it('parses the JSON error envelope even when expecting audio', async () => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"speech_quota_exceeded","message":"Quota exhausted","retryable":false}', { status: 422 })));
  const { apiBlob } = await import('@/lib/api');
  await expect(apiBlob('/speech')).rejects.toMatchObject({ code: 'speech_quota_exceeded', message: 'Quota exhausted', retryable: false });
});

it.each([
  ['/me/speech', 'PUT', 'read aloud settings'],
  ['/me/speech', 'DELETE', 'read aloud settings'],
  ['/speech', 'POST', 'ElevenLabs playback'],
])('explains missing speech route %s %s for JSON and proxy 404s', async (path, method, feature) => {
  for (const body of ['{"error":"not_found","message":"Not found","retryable":false}', '<html>Not Found</html>']) {
    vi.resetModules();
    const fetcher = vi.fn().mockResolvedValue(new Response(body, { status: 404 }));
    vi.stubGlobal('fetch', fetcher);
    const { api } = await import('@/lib/api');
    await expect(api(path, { method, body: { apiKey: 'private-test-key' } })).rejects.toMatchObject({
      status: 404,
      code: 'speech_endpoint_unavailable',
      message: `The ${feature} endpoint is unavailable on this a-RSS server (HTTP 404). Update the API server with ElevenLabs support, or check the app's server URL.`,
      retryable: false,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  }
});

it.each([
  ['/me/speech', 'user_not_found'],
  ['/speech', 'speech_invalid_voice'],
  ['/entries/missing', 'not_found'],
])('preserves specific errors and unrelated 404s for %s', async (path, code) => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: code, message: 'Specific cause', retryable: false }), { status: 404 })));
  const { api } = await import('@/lib/api');
  await expect(api(path, { method: path === '/me/speech' ? 'PUT' : 'POST' })).rejects.toMatchObject({ code, message: 'Specific cause' });
});
