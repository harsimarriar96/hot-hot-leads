import { EntityManager } from '@mikro-orm/postgresql';

import { Organization } from '../entities/organization.entity';
import { Session } from '../entities/session.entity';
import { User } from '../entities/user.entity';

export interface CreateSessionInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  activeOrganizationId?: string | null;
  ip?: string;
  userAgent?: string;
}

export class SessionsRepository {
  constructor(private readonly em: EntityManager) {}

  async create(input: CreateSessionInput): Promise<Session> {
    const em = this.em.fork();
    const session = em.create(
      Session,
      {
        user: em.getReference(User, input.userId),
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        activeOrganization: input.activeOrganizationId
          ? em.getReference(Organization, input.activeOrganizationId)
          : undefined,
        ip: input.ip,
        userAgent: input.userAgent,
      },
      { partial: true },
    );
    await em.persistAndFlush(session);
    return session;
  }

  /** The session with its user and active organization populated, or null when unknown. */
  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    return this.em.fork().findOne(
      Session,
      { tokenHash },
      { populate: ['user', 'activeOrganization'] },
    );
  }

  async touch(id: string, lastSeenAt: Date, expiresAt: Date): Promise<void> {
    const em = this.em.fork();
    const session = await em.findOne(Session, { id });
    if (!session) return;
    session.lastSeenAt = lastSeenAt;
    session.expiresAt = expiresAt;
    await em.flush();
  }

  async setActiveOrganization(id: string, orgId: string | null): Promise<void> {
    const em = this.em.fork();
    const session = await em.findOne(Session, { id });
    if (!session) return;
    session.activeOrganization = orgId ? em.getReference(Organization, orgId) : undefined;
    await em.flush();
  }

  async remove(id: string): Promise<void> {
    const em = this.em.fork();
    const session = await em.findOne(Session, { id });
    if (!session) return;
    em.remove(session);
    await em.flush();
  }

  async removeAllForUser(userId: string, exceptId?: string): Promise<number> {
    const em = this.em.fork();
    const where = exceptId ? { user: userId, id: { $ne: exceptId } } : { user: userId };
    return em.nativeDelete(Session, where);
  }

  async purgeExpired(now = new Date()): Promise<number> {
    return this.em.fork().nativeDelete(Session, { expiresAt: { $lt: now } });
  }
}
