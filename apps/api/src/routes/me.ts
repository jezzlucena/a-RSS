import { Router } from 'express';
import { requireAuth, getUserId } from '../middleware/auth.js';
import { User } from '../models/user.js';
import { HttpError } from '../middleware/errors.js';
import { encryptSecret } from '../services/userSecrets.js';
import { setAnthropicApiKeyRequest, type MeResponse } from '@a-rss/shared';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'user_not_found');

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
    hasAnthropicApiKey: Boolean(user.anthropicApiKeyEnc),
  };
  res.json(response);
});

router.put('/anthropic-api-key', requireAuth, async (req, res) => {
  const { apiKey } = setAnthropicApiKeyRequest.parse(req.body);
  const userId = getUserId(req);
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'user_not_found');
  user.anthropicApiKeyEnc = encryptSecret(apiKey);
  await user.save();
  res.status(204).end();
});

router.delete('/anthropic-api-key', requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'user_not_found');
  user.anthropicApiKeyEnc = null;
  await user.save();
  res.status(204).end();
});

export default router;
