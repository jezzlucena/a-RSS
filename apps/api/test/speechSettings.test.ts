import { afterEach, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { User } from '../src/models/user.js';
import { updateSpeechSettings, removeSpeechCredential } from '../src/controllers/me.js';
import { decryptSecret, encryptSecret } from '../src/services/userSecrets.js';

afterEach(() => vi.restoreAllMocks());
const response = () => ({ json: vi.fn() }) as unknown as Response;
const next = vi.fn() as NextFunction;

it('saves encrypted credentials for the authenticated user and keeps an omitted key', async () => {
  const user = new User({ email: 'test@example.com' });
  const find = vi.spyOn(User, 'findById').mockResolvedValue(user);
  const save = vi.spyOn(user, 'save').mockResolvedValue(user);
  const res = response();
  await updateSpeechSettings({ userId: 'owner', body: { provider: 'elevenlabs', apiKey: 'secret-key', voiceId: 'voice1' } } as Request, res, next);
  expect(find).toHaveBeenCalledWith('owner');
  expect(user.speech.apiKeyEnc).not.toBe('secret-key');
  expect(decryptSecret(user.speech.apiKeyEnc!)).toBe('secret-key');
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ provider: 'elevenlabs', configured: true, voiceId: 'voice1' }));
  expect(JSON.stringify(vi.mocked(res.json).mock.calls)).not.toContain('secret-key');
  const encrypted = user.speech.apiKeyEnc;
  await updateSpeechSettings({ userId: 'owner', body: { modelId: 'eleven_turbo_v2_5' } } as Request, res, next);
  expect(user.speech.apiKeyEnc).toBe(encrypted);
  expect(save).toHaveBeenCalledTimes(2);
});

it('does not persist an ElevenLabs selection without a key', async () => {
  const user = new User({ email: 'test@example.com' });
  vi.spyOn(User, 'findById').mockResolvedValue(user);
  const save = vi.spyOn(user, 'save').mockResolvedValue(user);
  await expect(updateSpeechSettings({ userId: 'owner', body: { provider: 'elevenlabs' } } as Request, response(), next)).rejects.toMatchObject({ code: 'speech_not_configured' });
  expect(save).not.toHaveBeenCalled();
});

it('removes a key and restores system speech idempotently', async () => {
  const user = new User({ email: 'test@example.com', speech: { provider: 'elevenlabs', apiKeyEnc: encryptSecret('secret') } });
  vi.spyOn(User, 'findById').mockResolvedValue(user);
  vi.spyOn(user, 'save').mockResolvedValue(user);
  const res = response();
  for (let i = 0; i < 2; i++) await removeSpeechCredential({ userId: 'owner' } as Request, res, next);
  expect(user.speech.apiKeyEnc).toBeNull();
  expect(user.speech.provider).toBe('system');
});
