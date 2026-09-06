import type { LlmProtocol, LlmProviderId, SummarizeErrorCode } from '@a-rss/shared';

// Carries a user-safe message and a retryable hint alongside the machine code, so the
// entries controller can translate it into an HttpError without re-inspecting vendor errors.
export class SummarizeError extends Error {
  constructor(public code: SummarizeErrorCode, message: string, public retryable: boolean) {
    super(message);
  }
}

export interface SummarizeArticle {
  title: string;
  byline: string | null;
  publishedAt: Date;
  articleText: string;
}

/** The user's active provider with its credential decrypted and defaults applied. */
export interface ResolvedProvider {
  id: LlmProviderId;
  protocol: LlmProtocol;
  label: string;
  shortLabel: string;
  /** null only for custom endpoints that don't need one. */
  apiKey: string | null;
  model: string;
  /** null for the Anthropic SDK (it knows its own host). */
  baseUrl: string | null;
}

export type SummarizeInput = SummarizeArticle & { provider: ResolvedProvider };

export interface SummarizeResult {
  intro: string;
  bullets: [string, string, string];
  model: string;
}

/** One vendor transport. `summarize()` owns the retry policy and only asks these three things. */
export interface LlmAdapter {
  callOnce(input: SummarizeInput): Promise<SummarizeResult>;
  /** Upstream failures worth one more attempt (5xx). Parse failures are handled centrally. */
  shouldRetryOnce(err: unknown): boolean;
  classifyError(err: unknown, provider: ResolvedProvider): SummarizeError;
}
