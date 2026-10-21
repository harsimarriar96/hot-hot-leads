import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Session, SessionsRepository } from '@hothotleads/db';

import { generateToken, hashToken } from './token.util';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** A session's expiry slides forward, but only once per hour to avoid a write per request. */
export const SESSION_TOUCH_INTERVAL_MS = 60 * 60 * 1000;
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface IssueSessionInput {
  activeOrganizationId?: string | null;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class SessionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionService.name);
  private purgeTimer?: NodeJS.Timeout;

  constructor(private readonly sessionsRepo: SessionsRepository) {}

  async onModuleInit(): Promise<void> {
    await this.purge();
    this.purgeTimer = setInterval(() => void this.purge(), PURGE_INTERVAL_MS);
    this.purgeTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.purgeTimer) clearInterval(this.purgeTimer);
  }

  async issue(userId: string, input: IssueSessionInput = {}): Promise<{ token: string; session: Session }> {
    const token = generateToken();
    const session = await this.sessionsRepo.create({
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      activeOrganizationId: input.activeOrganizationId ?? null,
      ip: input.ip,
      userAgent: input.userAgent,
    });
    return { token, session };
  }

  /** The live session for a bearer token, with user + active organization populated; null if unknown or expired. */
  async resolve(token: string, now = new Date()): Promise<Session | null> {
    const session = await this.sessionsRepo.findByTokenHash(hashToken(token));
    if (!session) return null;
    if (session.expiresAt.getTime() <= now.getTime()) {
      await this.sessionsRepo.remove(session.id);
      return null;
    }
    if (now.getTime() - session.lastSeenAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
      await this.sessionsRepo.touch(session.id, now, new Date(now.getTime() + SESSION_TTL_MS));
    }
    return session;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.sessionsRepo.remove(sessionId);
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<number> {
    return this.sessionsRepo.removeAllForUser(userId, exceptSessionId);
  }

  async setActiveOrganization(sessionId: string, orgId: string | null): Promise<void> {
    await this.sessionsRepo.setActiveOrganization(sessionId, orgId);
  }

  private async purge(): Promise<void> {
    try {
      const removed = await this.sessionsRepo.purgeExpired();
      if (removed > 0) this.logger.log(`Purged ${removed} expired session(s)`);
    } catch (err) {
      this.logger.warn(`Session purge failed: ${(err as Error).message}`);
    }
  }
}
