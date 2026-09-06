import { LLM_PROVIDERS, LLM_PROVIDER_BY_ID, type LlmProviderId, type LlmSettings } from '@a-rss/shared';
import { env } from '../../config/env.js';

/** The credential subdocument as stored on the user (see models/user.ts). */
export interface StoredLlmCredential {
  apiKeyEnc?: string | null;
  model?: string | null;
  baseUrl?: string | null;
}

/** The slice of a user document the LLM layer reads. Tolerates never-resaved legacy users. */
export interface UserLlmState {
  llm?: {
    provider?: string | null;
    credentials?: { get(id: string): StoredLlmCredential | undefined } | null;
  } | null;
}

/** Anthropic's default comes from the environment so ops can pin it; the rest from the catalog. */
export function effectiveDefaultModel(id: LlmProviderId): string | null {
  if (id === 'anthropic') return env.SUMMARIZER_MODEL;
  return LLM_PROVIDER_BY_ID[id].defaultModel;
}

const BLOCKED_HOSTS = /^(169\.254\.\d+\.\d+|metadata\.google\.internal|fd00:ec2::254)$/i;

/**
 * Canonical form for a user-supplied base URL: trimmed, no trailing slashes, http(s) only.
 * The API will POST to this host, so link-local cloud metadata addresses are refused.
 */
export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  const url = new URL(trimmed);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Base URL must start with http:// or https://');
  }
  if (BLOCKED_HOSTS.test(url.hostname)) {
    throw new Error('That host is not allowed');
  }
  return trimmed;
}

export function credentialFor(user: UserLlmState, id: LlmProviderId): StoredLlmCredential | undefined {
  return user.llm?.credentials?.get(id) ?? undefined;
}

export function activeProviderId(user: UserLlmState): LlmProviderId {
  const stored = user.llm?.provider;
  return stored && stored in LLM_PROVIDER_BY_ID ? (stored as LlmProviderId) : 'anthropic';
}

/** Custom endpoints count as configured once they have somewhere to send requests. */
export function isConfigured(id: LlmProviderId, credential: StoredLlmCredential | undefined): boolean {
  const def = LLM_PROVIDER_BY_ID[id];
  if (def.requiresKey) return Boolean(credential?.apiKeyEnc);
  return Boolean(credential?.baseUrl && credential?.model);
}

/** The `llm` block of GET /me. Never includes key material. */
export function buildLlmSettings(user: UserLlmState): LlmSettings {
  return {
    provider: activeProviderId(user),
    providers: LLM_PROVIDERS.map((def) => {
      const credential = credentialFor(user, def.id);
      return {
        id: def.id,
        label: def.label,
        shortLabel: def.shortLabel,
        protocol: def.protocol,
        configured: isConfigured(def.id, credential),
        model: credential?.model ?? null,
        defaultModel: effectiveDefaultModel(def.id),
        baseUrl: def.id === 'custom' ? credential?.baseUrl ?? null : null,
        defaultBaseUrl: def.defaultBaseUrl,
        keyPlaceholder: def.keyPlaceholder,
        consoleUrl: def.consoleUrl,
        requiresKey: def.requiresKey,
      };
    }),
  };
}
