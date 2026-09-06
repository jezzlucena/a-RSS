import { SYSTEM_PROMPT, buildUserMessage, parseSummaryOutput, SummaryParseError } from './prompt.js';
import { SummarizeError, type LlmAdapter, type ResolvedProvider, type SummarizeInput, type SummarizeResult } from './types.js';

/**
 * Transport for every provider that speaks the OpenAI Chat Completions format (OpenAI,
 * Gemini's compatibility endpoint, DeepSeek, Qwen, Kimi, Ollama, LM Studio, OpenRouter…).
 * Plain `fetch`, no SDK. The request is the lowest common denominator on purpose: no
 * `temperature` (reasoning-line models reject non-default values) and no `response_format`
 * (not universally supported; the system prompt already demands bare JSON).
 */

const REQUEST_TIMEOUT_MS = 60_000;
const MAX_TOKENS = 600;

export class UpstreamHttpError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    /** The vendor's own explanation, when it sent one — surfaced to the user for 4xx. */
    public upstreamMessage: string | null,
  ) {
    super(`upstream responded ${status}${upstreamMessage ? `: ${upstreamMessage}` : ''}`);
  }
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

function extractUpstreamMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return typeof body === 'string' && body ? clip(body) : null;
  const record = body as Record<string, unknown>;
  const error = record.error;
  if (error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string') {
    return clip((error as Record<string, string>).message);
  }
  if (typeof error === 'string') return clip(error);
  if (typeof record.message === 'string') return clip(record.message);
  return null;
}

function clip(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > 200 ? `${oneLine.slice(0, 197)}…` : oneLine;
}

/** `choices[0].message.content` is a string, or an array of `{type:'text', text}` parts on some proxies. */
function extractContent(json: unknown): string {
  const choice = (json as { choices?: Array<Record<string, unknown>> })?.choices?.[0];
  if (!choice) throw new SummaryParseError('response had no choices');
  if (choice.finish_reason === 'length') {
    throw new SummaryParseError('response was cut off by the token limit');
  }
  const message = choice.message as { content?: unknown } | undefined;
  const content = message?.content;
  if (typeof content === 'string' && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content
      .filter((part): part is { type: string; text: string } => !!part && typeof part === 'object' && (part as { type?: unknown }).type === 'text')
      .map((part) => part.text)
      .join('');
    if (text.trim()) return text;
  }
  throw new SummaryParseError('response had no message content');
}

export function createOpenAiCompatibleAdapter(fetchImpl: FetchLike = (input, init) => fetch(input, init)): LlmAdapter {
  async function post(url: string, provider: ResolvedProvider, body: Record<string, unknown>): Promise<Response> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (provider.apiKey) headers.authorization = `Bearer ${provider.apiKey}`;
    return fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }

  async function callOnce(input: SummarizeInput): Promise<SummarizeResult> {
    const { provider } = input;
    if (!provider.baseUrl) throw new SummarizeError('llm_not_configured', 'This provider has no base URL configured.', false);
    const url = `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const body: Record<string, unknown> = {
      model: provider.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserMessage(input) },
      ],
      max_tokens: MAX_TOKENS,
    };

    let response = await post(url, provider, body);
    if (!response.ok) {
      const errorBody = await readBody(response);
      const upstreamMessage = extractUpstreamMessage(errorBody);
      // Newer OpenAI models only accept `max_completion_tokens`; re-issue once with that key.
      if (response.status === 400 && upstreamMessage && /max_completion_tokens/i.test(upstreamMessage) && 'max_tokens' in body) {
        const { max_tokens, ...rest } = body;
        response = await post(url, provider, { ...rest, max_completion_tokens: max_tokens });
        if (!response.ok) {
          const retryBody = await readBody(response);
          throw new UpstreamHttpError(response.status, retryBody, extractUpstreamMessage(retryBody));
        }
      } else {
        throw new UpstreamHttpError(response.status, errorBody, upstreamMessage);
      }
    }

    const json = await response.json();
    const parsed = parseSummaryOutput(extractContent(json));
    return { ...parsed, model: provider.model };
  }

  function classifyError(err: unknown, provider: ResolvedProvider): SummarizeError {
    const name = provider.shortLabel;
    if (err instanceof UpstreamHttpError) {
      const detail = err.upstreamMessage ? ` (${err.upstreamMessage})` : '';
      const looksLikeKeyProblem = err.upstreamMessage ? /api[ _-]?key|API_KEY_INVALID|invalid.*key|unauthorized/i.test(err.upstreamMessage) : false;
      if (err.status === 401 || ((err.status === 400 || err.status === 403) && looksLikeKeyProblem)) {
        return new SummarizeError('invalid_api_key', `Your ${provider.label} API key was rejected. Check it in Settings.`, false);
      }
      if (err.status === 402) {
        return new SummarizeError('permission_denied', `Your ${provider.label} account has no remaining balance or credits.`, false);
      }
      if (err.status === 403) {
        return new SummarizeError('permission_denied', `Your ${provider.label} API key doesn't have access to this model.`, false);
      }
      if (err.status === 404) {
        return new SummarizeError('bad_request', `${name} couldn't find the model "${provider.model}". Check the model name in Settings.${detail}`, false);
      }
      if (err.status === 429) {
        return new SummarizeError('rate_limited', `${name} is handling too many requests right now. Wait a moment and try again.`, true);
      }
      if (err.status === 400 || err.status === 422) {
        return new SummarizeError('bad_request', `${name} rejected this request${detail}.`, false);
      }
      if (err.status === 408 || err.status >= 500) {
        return new SummarizeError('model_overloaded', `${name} is temporarily unavailable. Try again shortly.`, true);
      }
      return new SummarizeError('unknown', `Something went wrong asking ${name} to summarize this article${detail}. Try again.`, true);
    }
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      return new SummarizeError('timeout', `The request to ${name} timed out. Try again.`, true);
    }
    if (err instanceof TypeError) {
      // Node's fetch wraps DNS, TLS and connection-refused failures in a TypeError.
      const host = provider.baseUrl ? safeHost(provider.baseUrl) : 'the endpoint';
      return new SummarizeError('connection_error', `Could not reach ${name} at ${host}. Check the base URL and your connection.`, true);
    }
    if (err instanceof SummaryParseError) {
      return new SummarizeError('invalid_response', `${name} returned an unexpected response. Try again.`, true);
    }
    return new SummarizeError('unknown', `Something went wrong asking ${name} to summarize this article. Try again.`, true);
  }

  return {
    callOnce,
    shouldRetryOnce: (err) => err instanceof UpstreamHttpError && err.status >= 500,
    classifyError,
  };
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => '');
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
