import { z } from 'zod';

/**
 * LLM providers a user can summarize with. Everything except Anthropic speaks the OpenAI
 * Chat Completions format at the vendor's compatible base URL; "custom" is any such endpoint
 * (Ollama, LM Studio, OpenRouter, …). This catalog is the single source of truth — the API
 * decorates it with per-user state in `GET /me`, so clients never hardcode defaults.
 */
export const llmProviderId = z.enum(['anthropic', 'openai', 'gemini', 'deepseek', 'qwen', 'kimi', 'custom']);
export type LlmProviderId = z.infer<typeof llmProviderId>;

export const llmProtocol = z.enum(['anthropic', 'openai-compatible']);
export type LlmProtocol = z.infer<typeof llmProtocol>;

export interface LlmProviderDef {
  id: LlmProviderId;
  /** Picker label. */
  label: string;
  /** For status copy and error messages ("OpenAI is reading the article"). */
  shortLabel: string;
  protocol: LlmProtocol;
  defaultBaseUrl: string | null;
  /** null for custom endpoints — the user must name a model. */
  defaultModel: string | null;
  keyPlaceholder: string | null;
  consoleUrl: string | null;
  /** false only for custom endpoints, which may be unauthenticated (local servers). */
  requiresKey: boolean;
}

// Default model ids and hosts are vendor facts that drift; the model is user-editable so a
// stale default is recoverable, but verify these when shipping.
export const LLM_PROVIDERS: readonly LlmProviderDef[] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    shortLabel: 'Claude',
    protocol: 'anthropic',
    defaultBaseUrl: null,
    defaultModel: 'claude-haiku-4-5',
    keyPlaceholder: 'sk-ant-…',
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    requiresKey: true,
  },
  {
    id: 'openai',
    label: 'OpenAI (ChatGPT)',
    shortLabel: 'OpenAI',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4.1-mini',
    keyPlaceholder: 'sk-…',
    consoleUrl: 'https://platform.openai.com/api-keys',
    requiresKey: true,
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    shortLabel: 'Gemini',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
    keyPlaceholder: 'AIza…',
    consoleUrl: 'https://aistudio.google.com/apikey',
    requiresKey: true,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    shortLabel: 'DeepSeek',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    keyPlaceholder: 'sk-…',
    consoleUrl: 'https://platform.deepseek.com/api_keys',
    requiresKey: true,
  },
  {
    id: 'qwen',
    label: 'Qwen (Alibaba Cloud)',
    shortLabel: 'Qwen',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    keyPlaceholder: 'sk-…',
    consoleUrl: 'https://bailian.console.alibabacloud.com/?apiKey=1',
    requiresKey: true,
  },
  {
    id: 'kimi',
    label: 'Kimi (Moonshot)',
    shortLabel: 'Kimi',
    protocol: 'openai-compatible',
    defaultBaseUrl: 'https://api.moonshot.ai/v1',
    defaultModel: 'kimi-k2-turbo-preview',
    keyPlaceholder: 'sk-…',
    consoleUrl: 'https://platform.moonshot.ai/console/api-keys',
    requiresKey: true,
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    shortLabel: 'your model',
    protocol: 'openai-compatible',
    defaultBaseUrl: null,
    defaultModel: null,
    keyPlaceholder: null,
    consoleUrl: null,
    requiresKey: false,
  },
];

export const LLM_PROVIDER_BY_ID: Record<LlmProviderId, LlmProviderDef> = Object.fromEntries(
  LLM_PROVIDERS.map((p) => [p.id, p]),
) as Record<LlmProviderId, LlmProviderDef>;

export const selectLlmProviderRequest = z.object({
  provider: llmProviderId,
});
export type SelectLlmProviderRequest = z.infer<typeof selectLlmProviderRequest>;

/** Partial upsert: omit a field to keep it, send null to reset `model`/`baseUrl`. */
export const upsertLlmCredentialRequest = z.object({
  apiKey: z.string().trim().min(8).max(512).optional(),
  model: z.string().trim().min(1).max(120).nullable().optional(),
  baseUrl: z.string().trim().url().max(512).nullable().optional(),
});
export type UpsertLlmCredentialRequest = z.infer<typeof upsertLlmCredentialRequest>;

/** One provider as seen by a user: catalog facts plus whether they've configured it. */
export const llmProviderState = z.object({
  id: llmProviderId,
  label: z.string(),
  shortLabel: z.string(),
  protocol: llmProtocol,
  configured: z.boolean(),
  model: z.string().nullable(),
  defaultModel: z.string().nullable(),
  baseUrl: z.string().nullable(),
  defaultBaseUrl: z.string().nullable(),
  keyPlaceholder: z.string().nullable(),
  consoleUrl: z.string().nullable(),
  requiresKey: z.boolean(),
});
export type LlmProviderState = z.infer<typeof llmProviderState>;

export const llmSettings = z.object({
  provider: llmProviderId,
  providers: z.array(llmProviderState),
});
export type LlmSettings = z.infer<typeof llmSettings>;

/** A summary produced by a client (iOS on-device models) and stored via PUT /entries/:id/summary. */
export const clientSummaryRequest = z.object({
  intro: z.string().trim().min(1).max(1000).nullable().optional(),
  bullets: z.tuple([
    z.string().trim().min(1).max(600),
    z.string().trim().min(1).max(600),
    z.string().trim().min(1).max(600),
  ]),
  model: z.string().trim().min(1).max(120),
});
export type ClientSummaryRequest = z.infer<typeof clientSummaryRequest>;
