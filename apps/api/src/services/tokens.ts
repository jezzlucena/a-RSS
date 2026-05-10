import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'node:crypto';
import type { Response } from 'express';
import { env } from '../config/env.js';

export const REFRESH_COOKIE = 'arss_refresh';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

interface AccessTokenPayload {
  sub: string;
}

export function signAccessToken(userId: string): { token: string; expiresInSec: number } {
  const expiresIn = env.JWT_ACCESS_TTL as SignOptions['expiresIn'];
  const token = jwt.sign({ sub: userId } satisfies AccessTokenPayload, env.JWT_ACCESS_SECRET, {
    expiresIn,
  });
  // jsonwebtoken doesn't expose expiresIn in seconds; decode the payload to get exp
  const decoded = jwt.decode(token) as { exp?: number } | null;
  const expiresInSec = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 900;
  return { token, expiresInSec };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function generateOpaqueToken(bytes = 32): { token: string; hash: string } {
  const token = crypto.randomBytes(bytes).toString('base64url');
  return { token, hash: hashOpaqueToken(token) };
}

export function hashOpaqueToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    expires: expiresAt,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
}

// Convert a TTL string like "30d", "15m", "12h" to milliseconds.
export function ttlToMs(ttl: string): number {
  const match = ttl.match(/^(\d+)([smhdw])$/);
  if (!match) throw new Error(`invalid ttl: ${ttl}`);
  const n = Number(match[1]);
  const unit = match[2];
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }[unit]!;
  return n * mult;
}
