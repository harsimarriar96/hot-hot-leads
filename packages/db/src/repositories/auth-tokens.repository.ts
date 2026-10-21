import { EntityManager } from '@mikro-orm/postgresql';

import { AuthToken } from '../entities/auth-token.entity';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import { AuthTokenKind, MembershipRole } from '../enums';

export interface CreateAuthTokenInput {
  kind: AuthTokenKind;
  tokenHash: string;
  email: string;
  expiresAt: Date;
  userId?: string;
  organizationId?: string;
  role?: MembershipRole;
  invitedByUserId?: string;
}

export class AuthTokensRepository {
  constructor(private readonly em: EntityManager) {}

  async create(input: CreateAuthTokenInput): Promise<AuthToken> {
    const em = this.em.fork();
    const token = em.create(
      AuthToken,
      {
        kind: input.kind,
        tokenHash: input.tokenHash,
        email: input.email.trim().toLowerCase(),
        expiresAt: input.expiresAt,
        user: input.userId ? em.getReference(User, input.userId) : undefined,
        organization: input.organizationId
          ? em.getReference(Organization, input.organizationId)
          : undefined,
        role: input.role,
        invitedBy: input.invitedByUserId ? em.getReference(User, input.invitedByUserId) : undefined,
      },
      { partial: true },
    );
    await em.persistAndFlush(token);
    return token;
  }

  /** An unused, unexpired token of the given kind, with its relations populated. */
  async findValidByHash(kind: AuthTokenKind, tokenHash: string): Promise<AuthToken | null> {
    return this.em.fork().findOne(
      AuthToken,
      { kind, tokenHash, usedAt: null, expiresAt: { $gt: new Date() } },
      { populate: ['user', 'organization', 'invitedBy'] },
    );
  }

  async findById(id: string): Promise<AuthToken | null> {
    return this.em.fork().findOne(AuthToken, { id }, { populate: ['organization'] });
  }

  async markUsed(id: string): Promise<void> {
    const em = this.em.fork();
    const token = await em.findOne(AuthToken, { id });
    if (!token) return;
    token.usedAt = new Date();
    await em.flush();
  }

  /** Expire every pending token of a kind for an email (and organization, for invites). */
  async supersedePending(kind: AuthTokenKind, email: string, organizationId?: string): Promise<number> {
    const em = this.em.fork();
    const where: Record<string, unknown> = {
      kind,
      email: email.trim().toLowerCase(),
      usedAt: null,
      expiresAt: { $gt: new Date() },
    };
    if (organizationId) where.organization = organizationId;
    return em.nativeUpdate(AuthToken, where, { expiresAt: new Date() });
  }

  async countPending(kind: AuthTokenKind, email: string): Promise<number> {
    return this.em.fork().count(AuthToken, {
      kind,
      email: email.trim().toLowerCase(),
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });
  }

  async listPendingInvites(organizationId: string): Promise<AuthToken[]> {
    return this.em.fork().find(
      AuthToken,
      {
        kind: AuthTokenKind.INVITE,
        organization: organizationId,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { populate: ['invitedBy'], orderBy: { createdAt: 'DESC' } },
    );
  }

  async revokeInvite(organizationId: string, id: string): Promise<boolean> {
    const em = this.em.fork();
    const token = await em.findOne(AuthToken, {
      id,
      kind: AuthTokenKind.INVITE,
      organization: organizationId,
    });
    if (!token) return false;
    em.remove(token);
    await em.flush();
    return true;
  }
}
