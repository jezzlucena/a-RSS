import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/errors.js';

let client: OAuth2Client | null = null;

/**
 * Google mints ID tokens with `aud` = the OAuth client that requested them, and each client
 * type (web, iOS) has its own id. `GOOGLE_OAUTH_CLIENT_ID` therefore accepts a comma- or
 * whitespace-separated list so tokens from the web app and the iOS app both verify.
 */
export function parseGoogleAudiences(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function getClient(): OAuth2Client {
  const audiences = parseGoogleAudiences(env.GOOGLE_OAUTH_CLIENT_ID);
  if (audiences.length === 0) {
    throw new HttpError(503, 'google_unconfigured', 'Google sign-in is not configured');
  }
  if (!client) client = new OAuth2Client(audiences[0]);
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
  const ticket = await c.verifyIdToken({ idToken, audience: parseGoogleAudiences(env.GOOGLE_OAUTH_CLIENT_ID) });
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
