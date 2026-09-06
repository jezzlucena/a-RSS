import { LLM_PROVIDER_BY_ID } from '@a-rss/shared';
import { decryptSecret } from '../userSecrets.js';
import { anthropicAdapter } from './anthropic.js';
import { createOpenAiCompatibleAdapter } from './openaiCompatible.js';
import { SummaryParseError } from './prompt.js';
import { activeProviderId, credentialFor, effectiveDefaultModel, type UserLlmState } from './catalog.js';
import { SummarizeError, type LlmAdapter, type ResolvedProvider, type SummarizeInput, type SummarizeResult } from './types.js';

export { SummarizeError } from './types.js';
export type { ResolvedProvider, SummarizeInput, SummarizeResult, SummarizeArticle } from './types.js';
export { buildLlmSettings, normalizeBaseUrl, isConfigured, activeProviderId, credentialFor, effectiveDefaultModel } from './catalog.js';
export type { UserLlmState, StoredLlmCredential } from './catalog.js';

export const NOT_CONFIGURED_MESSAGE = 'Choose an AI provider and add its API key in Settings to summarize articles';
const CUSTOM_INCOMPLETE_MESSAGE = 'Finish setting up your custom endpoint in Settings (base URL and model) to summarize articles';

const openAiCompatibleAdapter = createOpenAiCompatibleAdapter();

function adapterFor(provider: ResolvedProvider): LlmAdapter {
  return provider.protocol === 'anthropic' ? anthropicAdapter : openAiCompatibleAdapter;
}

/**
 * Turns the user's stored settings into something an adapter can call: the active provider,
 * its decrypted key, and the model/base URL with defaults applied. Throws a non-retryable
 * `llm_not_configured` when anything required is missing.
 */
export function resolveProvider(user: UserLlmState): ResolvedProvider {
  const id = activeProviderId(user);
  const def = LLM_PROVIDER_BY_ID[id];
  const credential = credentialFor(user, id);

  const apiKey = credential?.apiKeyEnc ? decryptSecret(credential.apiKeyEnc) : null;
  if (!apiKey && def.requiresKey) {
    throw new SummarizeError('llm_not_configured', NOT_CONFIGURED_MESSAGE, false);
  }
  const model = credential?.model ?? effectiveDefaultModel(id);
  const baseUrl = id === 'custom' ? credential?.baseUrl ?? null : def.defaultBaseUrl;
  if (!model || (def.protocol === 'openai-compatible' && !baseUrl)) {
    throw new SummarizeError('llm_not_configured', CUSTOM_INCOMPLETE_MESSAGE, false);
  }
  return { id, protocol: def.protocol, label: def.label, shortLabel: def.shortLabel, apiKey, model, baseUrl };
}

/** One call, one retry for upstream 5xx or an unparseable answer, then a classified error. */
export async function summarize(input: SummarizeInput, adapter: LlmAdapter = adapterFor(input.provider)): Promise<SummarizeResult> {
  try {
    return await adapter.callOnce(input);
  } catch (err) {
    const retry = adapter.shouldRetryOnce(err) || err instanceof SummaryParseError;
    if (!retry) throw adapter.classifyError(err, input.provider);
    try {
      return await adapter.callOnce(input);
    } catch (retryErr) {
      throw adapter.classifyError(retryErr, input.provider);
    }
  }
}
