import { z } from 'zod';

export const DEFAULT_SPEECH_VOICE = 'JBFqnCBsd6RMkjVDRZzb';
export const DEFAULT_SPEECH_MODEL = 'eleven_multilingual_v2';
// Both clients split long articles at whitespace before requesting the next segment.
export const SPEECH_CHUNK_LIMIT = 4_000;
export const speechProvider = z.enum(['system', 'elevenlabs']);
const identifier = z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);

export const speechSettings = z.object({
  provider: speechProvider,
  configured: z.boolean(),
  voiceId: z.string(),
  modelId: z.string(),
});
export type SpeechSettings = z.infer<typeof speechSettings>;

export const updateSpeechSettingsRequest = z.object({
  provider: speechProvider.optional(),
  apiKey: z.string().trim().min(1).max(512).optional(),
  voiceId: identifier.optional(),
  modelId: identifier.optional(),
});
export type UpdateSpeechSettingsRequest = z.infer<typeof updateSpeechSettingsRequest>;

export const createSpeechRequest = z.object({
  text: z.string().trim().min(1).max(SPEECH_CHUNK_LIMIT),
});
export type CreateSpeechRequest = z.infer<typeof createSpeechRequest>;

export const speechErrorCode = z.enum([
  'speech_not_configured', 'speech_auth_failed', 'speech_quota_exceeded',
  'speech_rate_limited', 'speech_invalid_voice', 'speech_invalid_request',
  'speech_unavailable', 'speech_timeout', 'speech_invalid_audio',
  // Client-side diagnosis for a generic 404 from an older API or misconfigured proxy.
  'speech_endpoint_unavailable',
]);
export type SpeechErrorCode = z.infer<typeof speechErrorCode>;

/** Keep every segment within the API limit, including text without spaces and emoji. */
export function splitSpeechText(text: string, max = SPEECH_CHUNK_LIMIT): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    let end = rest.lastIndexOf(' ', max);
    if (end < max / 2) end = max;
    // Never split a UTF-16 surrogate pair.
    if (/[\uD800-\uDBFF]/.test(rest[end - 1])) end--;
    chunks.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}
