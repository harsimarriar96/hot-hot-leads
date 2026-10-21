import { Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

/** Constant-time string compare that never throws on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest();
  const hb = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Sign-in throttling. Keys are opaque strings (`ip:<addr>` / `email:<addr>`), so a
 * single attacker address and a single targeted account are both limited.
 */
@Injectable()
export class AuthService {
  private readonly failures = new Map<string, { count: number; until: number }>();

  /** Returns true when the caller is currently locked out. */
  isLockedOut(key: string): boolean {
    const entry = this.failures.get(key);
    if (!entry) return false;
    if (entry.until <= Date.now()) {
      this.failures.delete(key);
      return false;
    }
    return entry.count >= MAX_FAILURES;
  }

  recordFailure(key: string): void {
    const now = Date.now();
    const entry = this.failures.get(key);
    if (!entry || entry.until <= now) {
      this.failures.set(key, { count: 1, until: now + LOCKOUT_MS });
      return;
    }
    entry.count += 1;
  }

  clearFailures(key: string): void {
    this.failures.delete(key);
  }
}
