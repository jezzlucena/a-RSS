import type { Request, RequestHandler } from 'express';
import {
  LLM_PROVIDER_BY_ID,
  llmProviderId,
  selectLlmProviderRequest,
  upsertLlmCredentialRequest,
  updateSpeechSettingsRequest,
  type LlmProviderId,
  type MeResponse,
} from '@a-rss/shared';
import { User, type UserDoc } from '../models/user.js';
import { getUserId } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { encryptSecret } from '../services/userSecrets.js';
import { buildLlmSettings, normalizeBaseUrl } from '../services/llm/index.js';
import { buildSpeechSettings } from '../services/speech.js';

async function loadUser(req: Request): Promise<UserDoc> {
  const user = await User.findById(getUserId(req));
  if (!user) throw new HttpError(404, 'user_not_found');
  return user;
}

function parseProviderParam(req: Request): LlmProviderId {
  const parsed = llmProviderId.safeParse(req.params.provider);
  if (!parsed.success) throw new HttpError(404, 'not_found');
  return parsed.data;
}

export const getMe: RequestHandler = async (req, res) => {
  const user = await loadUser(req);

  const authMethods: MeResponse['authMethods'] = [];
  if (user.passwordHash) authMethods.push('password');
  if (user.googleSub) authMethods.push('google');
  if (user.appleSub) authMethods.push('apple');
  authMethods.push('magic'); // magic link is always available since it only requires email

  const response: MeResponse = {
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? null,
    authMethods,
    llm: buildLlmSettings(user),
    speech: buildSpeechSettings(user),
  };
  res.json(response);
};

/** Selecting an unconfigured provider is allowed; the UI shows it as "Not set" until a key is saved. */
export const selectLlmProvider: RequestHandler = async (req, res) => {
  const { provider } = selectLlmProviderRequest.parse(req.body);
  const user = await loadUser(req);
  user.llm.provider = provider;
  await user.save();
  res.status(204).end();
};

/**
 * Partial upsert of one provider's credential. Omitted fields are kept, `null` resets an
 * override. A first save needs a key unless the provider doesn't require one; custom
 * endpoints must end up with both a base URL and a model.
 */
export const upsertLlmCredential: RequestHandler = async (req, res) => {
  const provider = parseProviderParam(req);
  const body = upsertLlmCredentialRequest.parse(req.body);
  const def = LLM_PROVIDER_BY_ID[provider];
  const user = await loadUser(req);
  const existing = user.llm.credentials.get(provider);

  const apiKeyEnc = body.apiKey !== undefined ? encryptSecret(body.apiKey) : existing?.apiKeyEnc ?? null;
  if (!apiKeyEnc && def.requiresKey) {
    throw new HttpError(400, 'api_key_required', `Enter an API key for ${def.label}`);
  }

  const model = body.model === undefined ? existing?.model ?? null : body.model;
  if (provider === 'custom' && !model) {
    throw new HttpError(400, 'model_required', 'Enter the model name your endpoint serves');
  }

  let baseUrl: string | null = existing?.baseUrl ?? null;
  if (body.baseUrl !== undefined) {
    if (provider !== 'custom') {
      throw new HttpError(400, 'base_url_not_allowed', `${def.label} uses a fixed endpoint`);
    }
    if (body.baseUrl === null) {
      baseUrl = null;
    } else {
      try {
        baseUrl = normalizeBaseUrl(body.baseUrl);
      } catch (err) {
        throw new HttpError(400, 'invalid_base_url', (err as Error).message);
      }
    }
  }
  if (provider === 'custom' && !baseUrl) {
    throw new HttpError(400, 'base_url_required', 'Enter the base URL of your OpenAI-compatible endpoint');
  }

  user.llm.credentials.set(provider, { apiKeyEnc, model, baseUrl });
  await user.save();
  res.status(204).end();
};

/** Forgets one provider's key and overrides. The selection is left alone. */
export const removeLlmCredential: RequestHandler = async (req, res) => {
  const provider = parseProviderParam(req);
  const user = await loadUser(req);
  user.llm.credentials.delete(provider);
  await user.save();
  res.status(204).end();
};

export const updateSpeechSettings: RequestHandler = async (req, res) => {
  const body = updateSpeechSettingsRequest.parse(req.body);
  const user = await loadUser(req);
  if (body.apiKey !== undefined) user.speech.apiKeyEnc = encryptSecret(body.apiKey);
  if (body.provider !== undefined) user.speech.provider = body.provider;
  if (body.voiceId !== undefined) user.speech.voiceId = body.voiceId;
  if (body.modelId !== undefined) user.speech.modelId = body.modelId;
  if (user.speech.provider === 'elevenlabs' && !user.speech.apiKeyEnc) {
    throw new HttpError(400, 'speech_not_configured', 'Enter an ElevenLabs API key before selecting ElevenLabs.');
  }
  await user.save();
  res.json(buildSpeechSettings(user));
};

export const removeSpeechCredential: RequestHandler = async (req, res) => {
  const user = await loadUser(req);
  user.speech.apiKeyEnc = null;
  user.speech.provider = 'system';
  await user.save();
  res.json(buildSpeechSettings(user));
};
