import { describe, it, expect, vi } from 'vitest';
import { createOpenAiCompatibleAdapter, UpstreamHttpError } from '../src/services/llm/openaiCompatible.js';
import { summarize, SummarizeError, type ResolvedProvider, type SummarizeInput } from '../src/services/llm/index.js';

const provider: ResolvedProvider = {
  id: 'openai', protocol: 'openai-compatible', label: 'OpenAI (ChatGPT)', shortLabel: 'OpenAI',
  apiKey: 'sk-test', model: 'gpt-4.1-mini', baseUrl: 'https://api.openai.com/v1/',
};
const input: SummarizeInput = {
  title: 'T', byline: null, publishedAt: new Date('2026-09-06T00:00:00Z'), articleText: 'Body '.repeat(50), provider,
};
const goodBody = { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '{"intro":"I.","bullets":["a","b","c"]}' } }] };

type Call = { url: string; init: RequestInit };
function fakeFetch(...responses: Array<Response | Error>) {
  const calls: Call[] = [];
  const impl = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift() ?? responses[responses.length - 1];
    if (next instanceof Error) throw next;
    return next;
  });
  return { impl, calls };
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const parsedBody = (call: Call) => JSON.parse(call.init.body as string) as Record<string, unknown>;

describe('openai-compatible adapter request', () => {
  it('posts to /chat/completions under a normalized base URL with the bearer key', async () => {
    const { impl, calls } = fakeFetch(json(200, goodBody));
    const result = await createOpenAiCompatibleAdapter(impl).callOnce(input);
    expect(result).toEqual({ intro: 'I.', bullets: ['a', 'b', 'c'], model: 'gpt-4.1-mini' });
    expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer sk-test');
    const body = parsedBody(calls[0]);
    expect(body.model).toBe('gpt-4.1-mini');
    expect(body.max_tokens).toBe(600);
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('response_format');
    const messages = body.messages as Array<{ role: string; content: string }>;
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('Title: T');
  });

  it('omits the authorization header for keyless custom endpoints', async () => {
    const { impl, calls } = fakeFetch(json(200, goodBody));
    await createOpenAiCompatibleAdapter(impl).callOnce({ ...input, provider: { ...provider, id: 'custom', apiKey: null, baseUrl: 'http://localhost:11434/v1' } });
    expect((calls[0].init.headers as Record<string, string>).authorization).toBeUndefined();
    expect(calls[0].url).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('retries once with max_completion_tokens when the vendor insists on it', async () => {
    const { impl, calls } = fakeFetch(
      json(400, { error: { message: "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead." } }),
      json(200, goodBody),
    );
    await createOpenAiCompatibleAdapter(impl).callOnce(input);
    expect(calls).toHaveLength(2);
    expect(parsedBody(calls[1])).not.toHaveProperty('max_tokens');
    expect(parsedBody(calls[1]).max_completion_tokens).toBe(600);
  });
});

describe('openai-compatible adapter response parsing', () => {
  it('accepts content as an array of text parts and fenced JSON', async () => {
    const parts = { choices: [{ message: { content: [{ type: 'text', text: '```json\n{"intro":"I.","bullets":["a","b","c"]}\n```' }] } }] };
    const { impl } = fakeFetch(json(200, parts));
    expect((await createOpenAiCompatibleAdapter(impl).callOnce(input)).intro).toBe('I.');
  });

  it('treats missing choices, empty content and length cut-offs as invalid_response', async () => {
    const adapter = createOpenAiCompatibleAdapter(fakeFetch(json(200, {})).impl);
    await expect(adapter.callOnce(input)).rejects.toMatchObject({ name: 'Error' });
    for (const body of [{ choices: [{ message: { content: '' } }] }, { choices: [{ finish_reason: 'length', message: { content: '{"intro"' } }] }]) {
      const a = createOpenAiCompatibleAdapter(fakeFetch(json(200, body)).impl);
      const err = await a.callOnce(input).catch((e) => e);
      expect(a.classifyError(err, provider)).toMatchObject({ code: 'invalid_response', retryable: true });
    }
  });
});

describe('openai-compatible error classification', () => {
  const adapter = createOpenAiCompatibleAdapter(fakeFetch().impl);
  const classify = (status: number, body: unknown) => adapter.classifyError(new UpstreamHttpError(status, body, typeof body === 'object' && body ? ((body as { error?: { message?: string } }).error?.message ?? null) : null), provider);

  it('maps auth, billing, permission, model and request errors', () => {
    expect(classify(401, {})).toMatchObject({ code: 'invalid_api_key', retryable: false });
    expect(classify(400, { error: { message: 'API key not valid. Please pass a valid API key.' } })).toMatchObject({ code: 'invalid_api_key' });
    expect(classify(402, { error: { message: 'Insufficient Balance' } })).toMatchObject({ code: 'permission_denied', retryable: false });
    expect(classify(403, {})).toMatchObject({ code: 'permission_denied' });
    const notFound = classify(404, { error: { message: "model 'llama9' not found, try pulling it first" } });
    expect(notFound.code).toBe('bad_request');
    expect(notFound.message).toContain('gpt-4.1-mini');
    expect(notFound.message).toContain('try pulling it first');
    expect(classify(400, { error: { message: 'unknown field foo' } })).toMatchObject({ code: 'bad_request', retryable: false });
    expect(classify(422, {})).toMatchObject({ code: 'bad_request' });
  });

  it('maps transient failures as retryable', () => {
    expect(classify(429, {})).toMatchObject({ code: 'rate_limited', retryable: true });
    expect(classify(500, {})).toMatchObject({ code: 'model_overloaded', retryable: true });
    expect(classify(503, 'upstream down')).toMatchObject({ code: 'model_overloaded', retryable: true });
    expect(adapter.classifyError(new DOMException('timed out', 'TimeoutError'), provider)).toMatchObject({ code: 'timeout', retryable: true });
    const connection = adapter.classifyError(new TypeError('fetch failed'), provider);
    expect(connection).toMatchObject({ code: 'connection_error', retryable: true });
    expect(connection.message).toContain('api.openai.com');
  });

  it('retries once on 5xx and not on 4xx through summarize()', async () => {
    const flaky = fakeFetch(json(500, {}), json(200, goodBody));
    expect((await summarize(input, createOpenAiCompatibleAdapter(flaky.impl))).intro).toBe('I.');
    expect(flaky.calls).toHaveLength(2);

    const unauthorized = fakeFetch(json(401, {}));
    await expect(summarize(input, createOpenAiCompatibleAdapter(unauthorized.impl))).rejects.toBeInstanceOf(SummarizeError);
    expect(unauthorized.calls).toHaveLength(1);

    const exhausted = fakeFetch(json(502, {}), json(502, {}));
    const err = await summarize(input, createOpenAiCompatibleAdapter(exhausted.impl)).catch((e) => e);
    expect(err).toMatchObject({ code: 'model_overloaded', retryable: true });
    expect(exhausted.calls).toHaveLength(2);
  });
});
