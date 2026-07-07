/** Machine-readable failure reasons the API can report for a summarize request. */
export type SummarizeErrorCode =
  | 'not_ready'
  | 'fetch_failed'
  | 'no_article_body'
  | 'article_too_short'
  | 'anthropic_api_key_missing'
  | 'rate_limited'
  | 'timeout'
  | 'connection_error'
  | 'invalid_api_key'
  | 'permission_denied'
  | 'bad_request'
  | 'model_overloaded'
  | 'invalid_response'
  | 'unknown';

/** Standard shape for API error responses: a machine code, a message safe to show
 *  the user verbatim, and whether retrying the same request might succeed. */
export interface ApiErrorBody {
  error: string;
  message: string;
  retryable: boolean;
}
