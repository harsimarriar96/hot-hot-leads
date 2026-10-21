import { createHash, randomBytes } from 'node:crypto';

/** 256 bits of randomness, URL-safe. Never stored; only its hash is. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
