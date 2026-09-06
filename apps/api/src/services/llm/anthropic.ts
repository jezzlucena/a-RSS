import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, buildUserMessage, parseSummaryOutput, SummaryParseError } from './prompt.js';
import { SummarizeError, type LlmAdapter, type ResolvedProvider, type SummarizeInput, type SummarizeResult } from './types.js';

// The system prompt is sent as a cacheable block and the article in the user turn, so the
// long, stable prefix hits Anthropic prompt caching on every entry. Don't reorder this.
async function callOnce(input: SummarizeInput): Promise<SummarizeResult> {
  const client = new Anthropic({ apiKey: input.provider.apiKey ?? undefined });
  const response = await client.messages.create({
    model: input.provider.model,
    max_tokens: 600,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: buildUserMessage(input) }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new SummaryParseError('summarizer returned no text block');
  }
  const parsed = parseSummaryOutput(textBlock.text);
  return { ...parsed, model: input.provider.model };
}

function classifyError(err: unknown, provider: ResolvedProvider): SummarizeError {
  const name = provider.shortLabel;
  if (err instanceof Anthropic.RateLimitError) {
    return new SummarizeError('rate_limited', `${name} is handling too many requests right now. Wait a moment and try again.`, true);
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new SummarizeError('timeout', `The request to ${name} timed out. Try again.`, true);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new SummarizeError('connection_error', `Could not reach ${name}. Check your connection and try again.`, true);
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return new SummarizeError('invalid_api_key', `Your ${provider.label} API key was rejected. Check it in Settings.`, false);
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new SummarizeError('permission_denied', `Your ${provider.label} API key doesn't have access to this model.`, false);
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new SummarizeError('bad_request', `${name} rejected this article — it may be malformed or unusually long.`, false);
  }
  if (err instanceof Anthropic.APIError && (err.status ?? 0) >= 500) {
    return new SummarizeError('model_overloaded', `${name} is temporarily unavailable. Try again shortly.`, true);
  }
  if (err instanceof SummaryParseError) {
    return new SummarizeError('invalid_response', `${name} returned an unexpected response. Try again.`, true);
  }
  return new SummarizeError('unknown', `Something went wrong asking ${name} to summarize this article. Try again.`, true);
}

export const anthropicAdapter: LlmAdapter = {
  callOnce,
  shouldRetryOnce: (err) => err instanceof Anthropic.APIError && (err.status ?? 0) >= 500,
  classifyError,
};
