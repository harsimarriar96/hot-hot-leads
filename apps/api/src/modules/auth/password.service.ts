import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function derive(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N, r, p, maxmem: 128 * N * r * 2 }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

/** scrypt password hashing via node:crypto. Stored as `scrypt$N$r$p$<salt b64>$<hash b64>`. */
@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const key = await derive(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
    return ['scrypt', SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString('base64'), key.toString('base64')].join('$');
  }

  async verify(password: string, stored: string | null | undefined): Promise<boolean> {
    if (!stored) return false;
    const [scheme, n, r, p, saltB64, hashB64] = stored.split('$');
    if (scheme !== 'scrypt' || !n || !r || !p || !saltB64 || !hashB64) return false;
    const N = Number(n);
    const R = Number(r);
    const P = Number(p);
    if (![N, R, P].every((v) => Number.isInteger(v) && v > 0)) return false;
    try {
      const expected = Buffer.from(hashB64, 'base64');
      const actual = await derive(password, Buffer.from(saltB64, 'base64'), N, R, P);
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }
}
