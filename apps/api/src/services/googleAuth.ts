import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/errors.js';

let client: OAuth2Client | null = null;

function getClient(): OAuth2Client {
  if (!env.GOOGLE_OAUTH_CLIENT_ID) {
    throw new HttpError(503, 'google_unconfigured', 'Google sign-in is not configured');
  }
  if (!client) client = new OAuth2Client(env.GOOGLE_OAUTH_CLIENT_ID);
  return client;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const c = getClient();
  const ticket = await c.verifyIdToken({ idToken, audience: env.GOOGLE_OAUTH_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new HttpError(401, 'invalid_google_token', 'Could not verify Google identity');
  }
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: !!payload.email_verified,
    name: payload.name ?? null,
  };
}
