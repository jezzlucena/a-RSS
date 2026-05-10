import * as jose from 'jose';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/errors.js';

const APPLE_KEYS_URL = new URL('https://appleid.apple.com/auth/keys');
const APPLE_ISSUER = 'https://appleid.apple.com';

const jwks = jose.createRemoteJWKSet(APPLE_KEYS_URL);

export interface AppleIdentity {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  isPrivateEmail: boolean;
}

export async function verifyAppleIdentityToken(idToken: string): Promise<AppleIdentity> {
  if (!env.APPLE_CLIENT_ID) {
    throw new HttpError(503, 'apple_unconfigured', 'Apple sign-in is not configured');
  }
  let payload: jose.JWTPayload;
  try {
    const result = await jose.jwtVerify(idToken, jwks, {
      issuer: APPLE_ISSUER,
      audience: env.APPLE_CLIENT_ID,
    });
    payload = result.payload;
  } catch {
    throw new HttpError(401, 'invalid_apple_token', 'Could not verify Apple identity');
  }
  if (typeof payload.sub !== 'string') {
    throw new HttpError(401, 'invalid_apple_token', 'Apple token missing subject');
  }
  const email = typeof payload.email === 'string' ? payload.email : null;
  // Apple sends email_verified as either boolean or "true"/"false" string.
  const verifiedRaw = (payload as Record<string, unknown>).email_verified;
  const emailVerified = verifiedRaw === true || verifiedRaw === 'true';
  const privateRaw = (payload as Record<string, unknown>).is_private_email;
  const isPrivateEmail = privateRaw === true || privateRaw === 'true';
  return { sub: payload.sub, email, emailVerified, isPrivateEmail };
}
