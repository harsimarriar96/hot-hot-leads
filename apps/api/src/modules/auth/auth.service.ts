import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

/** Constant-time string compare that never throws on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest();
  const hb = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Shared-password auth. The bearer token is derived from the two secrets, so it
 * is stateless, survives restarts, and is invalidated by rotating either one.
 */
@Injectable()
export class AuthService implements OnModuleInit {
  private password!: string;
  private token!: string;
  private readonly failures = new Map<string, { count: number; until: number }>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const secret = this.config.get<string>('security.appSecretKey');
    const password = this.config.get<string>('security.authPassword');
    if (!password) {
      throw new Error(
        'APP_AUTH_PASSWORD is required. It is the password operators use to sign in to the web UI.',
      );
    }
    this.password = password;
    this.token = createHmac('sha256', secret ?? '')
      .update(`hhl-auth-v1:${password}`)
      .digest('hex');
  }

  verifyPassword(candidate: string): boolean {
    return safeEqual(candidate, this.password);
  }

  verifyToken(candidate: string): boolean {
    return safeEqual(candidate, this.token);
  }

  issueToken(): string {
    return this.token;
  }

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
