import type { RequestHandler } from 'express';
import {
  signupRequest,
  loginRequest,
  magicRequest,
  magicConsumeRequest,
  googleAuthRequest,
  appleAuthRequest,
  changePasswordRequest,
  type AuthTokensResponse,
} from '@a-rss/shared';
import { getUserId } from '../middleware/auth.js';
import { User } from '../models/user.js';
import { AuthToken } from '../models/authToken.js';
import { hashPassword, verifyPassword } from '../services/passwords.js';
import {
  signAccessToken,
  generateOpaqueToken,
  hashOpaqueToken,
  setRefreshCookie,
  clearRefreshCookie,
  ttlToMs,
  REFRESH_COOKIE,
} from '../services/tokens.js';
import { sendMagicLinkEmail } from '../services/mailer.js';
import { verifyGoogleIdToken } from '../services/googleAuth.js';
import { verifyAppleIdentityToken } from '../services/appleAuth.js';
import { HttpError } from '../middleware/errors.js';
import { env } from '../config/env.js';

async function issueTokens(userId: string): Promise<{
  access: AuthTokensResponse;
  refreshToken: string;
  refreshExpiresAt: Date;
}> {
  const access = signAccessToken(userId);
  const { token: refreshToken, hash } = generateOpaqueToken();
  const refreshExpiresAt = new Date(Date.now() + ttlToMs(env.JWT_REFRESH_TTL));
  await AuthToken.create({
    userId,
    kind: 'refresh',
    tokenHash: hash,
    expiresAt: refreshExpiresAt,
  });
  return {
    access: { accessToken: access.token, expiresIn: access.expiresInSec },
    refreshToken,
    refreshExpiresAt,
  };
}

export const signup: RequestHandler = async (req, res) => {
  const { email, password, displayName } = signupRequest.parse(req.body);
  const existing = await User.findOne({ email });
  if (existing) throw new HttpError(409, 'email_taken', 'That email is already registered');

  const passwordHash = await hashPassword(password);
  const user = await User.create({ email, passwordHash, displayName: displayName ?? null });

  const tokens = await issueTokens(user.id);
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
  res.status(201).json(tokens.access);
};

export const login: RequestHandler = async (req, res) => {
  const { email, password } = loginRequest.parse(req.body);
  const user = await User.findOne({ email });
  if (!user?.passwordHash) {
    throw new HttpError(401, 'invalid_credentials', 'Email or password is incorrect');
  }
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) throw new HttpError(401, 'invalid_credentials', 'Email or password is incorrect');

  const tokens = await issueTokens(user.id);
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
  res.json(tokens.access);
};

export const refresh: RequestHandler = async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE];
  if (!presented || typeof presented !== 'string') {
    throw new HttpError(401, 'no_refresh', 'No refresh cookie present');
  }
  const hash = hashOpaqueToken(presented);
  const record = await AuthToken.findOne({ kind: 'refresh', tokenHash: hash });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    clearRefreshCookie(res);
    throw new HttpError(401, 'invalid_refresh', 'Refresh token is invalid or expired');
  }
  // Rotate: mark old used, issue new pair.
  record.usedAt = new Date();
  await record.save();
  const tokens = await issueTokens(String(record.userId));
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
  res.json(tokens.access);
};

export const logout: RequestHandler = async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE];
  if (typeof presented === 'string' && presented.length > 0) {
    const hash = hashOpaqueToken(presented);
    await AuthToken.updateOne({ tokenHash: hash, kind: 'refresh' }, { $set: { usedAt: new Date() } });
  }
  clearRefreshCookie(res);
  res.status(204).end();
};

export const magicRequestHandler: RequestHandler = async (req, res) => {
  const { email } = magicRequest.parse(req.body);

  // Find or create user — magic-link signup is allowed (passwordHash stays null).
  let user = await User.findOne({ email });
  if (!user) user = await User.create({ email });

  const { token, hash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + 15 * 60_000);
  await AuthToken.create({ userId: user.id, kind: 'magic', tokenHash: hash, expiresAt });

  const url = `${env.WEB_BASE_URL}/auth/magic?t=${token}`;
  await sendMagicLinkEmail(email, url);

  // Don't leak whether a user pre-existed.
  res.status(202).json({ ok: true });
};

export const magicConsumeHandler: RequestHandler = async (req, res) => {
  const { token } = magicConsumeRequest.parse(req.body);
  const hash = hashOpaqueToken(token);
  const record = await AuthToken.findOne({ kind: 'magic', tokenHash: hash });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new HttpError(401, 'invalid_magic', 'Magic link is invalid, expired, or already used');
  }
  record.usedAt = new Date();
  await record.save();

  const tokens = await issueTokens(String(record.userId));
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
  res.json(tokens.access);
};

export const googleAuthHandler: RequestHandler = async (req, res) => {
  const { idToken } = googleAuthRequest.parse(req.body);
  const identity = await verifyGoogleIdToken(idToken);
  if (!identity.emailVerified) {
    throw new HttpError(401, 'email_not_verified', 'Google account email is not verified');
  }

  let user = await User.findOne({ googleSub: identity.sub });
  if (!user) {
    // Match by email if there's already a user (linking).
    user = await User.findOne({ email: identity.email });
    if (user) {
      user.googleSub = identity.sub;
      if (!user.displayName && identity.name) user.displayName = identity.name;
      await user.save();
    } else {
      user = await User.create({
        email: identity.email,
        googleSub: identity.sub,
        displayName: identity.name,
      });
    }
  }

  const tokens = await issueTokens(user.id);
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
  res.json(tokens.access);
};

export const changePassword: RequestHandler = async (req, res) => {
  const { currentPassword, newPassword } = changePasswordRequest.parse(req.body);
  const userId = getUserId(req);
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'user_not_found');

  if (user.passwordHash) {
    if (!currentPassword) {
      throw new HttpError(400, 'current_password_required', 'Current password is required');
    }
    const ok = await verifyPassword(user.passwordHash, currentPassword);
    if (!ok) throw new HttpError(401, 'invalid_credentials', 'Current password is incorrect');
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  // Invalidate all outstanding refresh tokens so other sessions can't keep refreshing.
  await AuthToken.updateMany(
    { userId: user.id, kind: 'refresh', usedAt: null },
    { $set: { usedAt: new Date() } },
  );

  const tokens = await issueTokens(user.id);
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
  res.json(tokens.access);
};

export const appleAuthHandler: RequestHandler = async (req, res) => {
  const body = appleAuthRequest.parse(req.body);
  const identity = await verifyAppleIdentityToken(body.identityToken);

  const desiredDisplayName = body.fullName
    ? [body.fullName.givenName, body.fullName.familyName].filter(Boolean).join(' ').trim() || null
    : null;

  let user = await User.findOne({ appleSub: identity.sub });
  if (!user) {
    // Try linking via verified email (only when Apple says it's verified and not the relay).
    if (identity.email && identity.emailVerified && !identity.isPrivateEmail) {
      user = await User.findOne({ email: identity.email });
      if (user) {
        user.appleSub = identity.sub;
        if (!user.displayName && desiredDisplayName) user.displayName = desiredDisplayName;
        await user.save();
      }
    }
    if (!user) {
      // Apple may withhold email on subsequent sign-ins; mint a stable placeholder.
      const email = identity.email ?? `${identity.sub}@privaterelay.appleid.com`;
      user = await User.create({
        email,
        appleSub: identity.sub,
        displayName: desiredDisplayName,
      });
    }
  } else if (!user.displayName && desiredDisplayName) {
    user.displayName = desiredDisplayName;
    await user.save();
  }

  const tokens = await issueTokens(user.id);
  setRefreshCookie(res, tokens.refreshToken, tokens.refreshExpiresAt);
  res.json(tokens.access);
};
