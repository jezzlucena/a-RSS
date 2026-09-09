import { DEFAULT_SPEECH_MODEL, DEFAULT_SPEECH_VOICE, type SpeechSettings, type SpeechErrorCode } from '@a-rss/shared';
import { decryptSecret } from './userSecrets.js';
import { HttpError } from '../middleware/errors.js';

interface UserSpeechState {
  speech?: { provider?: string; apiKeyEnc?: string | null; voiceId?: string; modelId?: string };
}

export function buildSpeechSettings(user: UserSpeechState): SpeechSettings {
  return {
    provider: user.speech?.provider === 'elevenlabs' ? 'elevenlabs' : 'system',
    configured: Boolean(user.speech?.apiKeyEnc),
    voiceId: user.speech?.voiceId ?? DEFAULT_SPEECH_VOICE,
    modelId: user.speech?.modelId ?? DEFAULT_SPEECH_MODEL,
  };
}

function speechError(status: number, code: SpeechErrorCode, message: string, retryable = false): HttpError {
  return new HttpError(status, code, message, retryable);
}

/** Vendor bodies can contain sensitive text. Only stable, curated errors leave this service. */
export function classifySpeechError(status: number, vendorCode?: string): HttpError {
  if (vendorCode === 'quota_exceeded' || status === 402) {
    return speechError(422, 'speech_quota_exceeded', 'Your ElevenLabs quota is exhausted. Check your plan or use the system voice.');
  }
  if (status === 401 || status === 403) {
    return speechError(422, 'speech_auth_failed', 'ElevenLabs rejected your API key. Check its permissions in Settings.');
  }
  if (status === 404 || vendorCode === 'voice_not_found') {
    return speechError(422, 'speech_invalid_voice', 'ElevenLabs could not find this voice. Check the voice ID in Settings.');
  }
  if (status === 429) return speechError(503, 'speech_rate_limited', 'ElevenLabs is busy. Try again shortly.', true);
  if (status >= 500) return speechError(503, 'speech_unavailable', 'ElevenLabs is unavailable. Try again shortly.', true);
  return speechError(422, 'speech_invalid_request', 'ElevenLabs could not generate speech. Check your voice and model in Settings.');
}

/** Authenticated server-side proxy: API keys never accompany audio back to either client. */
export async function createSpeech(user: UserSpeechState, text: string, signal?: AbortSignal): Promise<Buffer> {
  const settings = buildSpeechSettings(user);
  if (settings.provider !== 'elevenlabs' || !user.speech?.apiKeyEnc) {
    throw speechError(422, 'speech_not_configured', 'Set up ElevenLabs in Settings or select the system voice.');
  }
  let apiKey: string;
  try { apiKey = decryptSecret(user.speech.apiKeyEnc); } catch {
    throw speechError(422, 'speech_auth_failed', 'Save your ElevenLabs API key again in Settings.');
  }
  const timeout = AbortSignal.timeout(60_000);
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(settings.voiceId)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: settings.modelId }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { detail?: { status?: string } } | null;
      throw classifySpeechError(response.status, body?.detail?.status);
    }
    if (!response.headers.get('content-type')?.startsWith('audio/')) {
      await response.body?.cancel();
      throw speechError(502, 'speech_invalid_audio', 'ElevenLabs returned invalid audio. Try again.', true);
    }
    const audio = Buffer.from(await response.arrayBuffer());
    if (!audio.length) throw speechError(502, 'speech_invalid_audio', 'ElevenLabs returned empty audio. Try again.', true);
    return audio;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (signal?.aborted) throw error;
    if (timeout.aborted) throw speechError(503, 'speech_timeout', 'ElevenLabs took too long. Try again.', true);
    throw speechError(503, 'speech_unavailable', 'Could not connect to ElevenLabs. Try again.', true);
  }
}
