import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { env } from '../config/env.js';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function loadKey(): Buffer {
  const raw = env.USER_SECRETS_KEY;
  // Accept either hex (64 chars) or base64 (44 chars w/ padding) — pick whichever yields 32 bytes.
  const tryHex = /^[0-9a-fA-F]+$/.test(raw) ? Buffer.from(raw, 'hex') : null;
  if (tryHex && tryHex.length === 32) return tryHex;
  const tryB64 = Buffer.from(raw, 'base64');
  if (tryB64.length === 32) return tryB64;
  throw new Error('USER_SECRETS_KEY must decode to 32 bytes (hex or base64)');
}

let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (!cachedKey) cachedKey = loadKey();
  return cachedKey;
}

/** Encrypts plaintext and returns `v1:<iv_b64>:<tag_b64>:<ct_b64>`. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

export function decryptSecret(encoded: string): string {
  const parts = encoded.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('encrypted secret has unexpected format');
  }
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const ct = Buffer.from(parts[3], 'base64');
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new Error('encrypted secret has bad iv/tag length');
  }
  const decipher = createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
