import { EntityManager } from '@mikro-orm/postgresql';

import { Membership } from '../entities/membership.entity';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import { MembershipRole } from '../enums';

export class MembershipsRepository {
  constructor(private readonly em: EntityManager) {}

  async find(userId: string, orgId: string): Promise<Membership | null> {
    return this.em.fork().findOne(
      Membership,
      { user: userId, organization: orgId },
      { populate: ['user', 'organization'] },
    );
  }

  /** All memberships of a user with their organizations populated. */
  async listForUser(userId: string): Promise<Membership[]> {
    return this.em.fork().find(
      Membership,
      { user: userId },
      { populate: ['organization'], orderBy: { createdAt: 'ASC' } },
    );
  }

  /** All members of an organization with their users populated. */
  async listForOrg(orgId: string): Promise<Membership[]> {
    return this.em.fork().find(
      Membership,
      { organization: orgId },
      { populate: ['user'], orderBy: { createdAt: 'ASC' } },
    );
  }

  async create(userId: string, orgId: string, role: MembershipRole): Promise<Membership> {
    const em = this.em.fork();
    const membership = em.create(
      Membership,
      {
        user: em.getReference(User, userId),
        organization: em.getReference(Organization, orgId),
        role,
      },
      { partial: true },
    );
    await em.persistAndFlush(membership);
    return membership;
  }

  async updateRole(userId: string, orgId: string, role: MembershipRole): Promise<Membership> {
    const em = this.em.fork();
    const membership = await em.findOneOrFail(Membership, { user: userId, organization: orgId });
    membership.role = role;
    await em.flush();
    return membership;
  }

  async remove(userId: string, orgId: string): Promise<void> {
    const em = this.em.fork();
    const membership = await em.findOne(Membership, { user: userId, organization: orgId });
    if (!membership) return;
    em.remove(membership);
    await em.flush();
  }

  async countOwners(orgId: string): Promise<number> {
    return this.em.fork().count(Membership, { organization: orgId, role: MembershipRole.OWNER });
  }

  async countForOrg(orgId: string): Promise<number> {
    return this.em.fork().count(Membership, { organization: orgId });
  }

  /** Earliest owner of an organization; used as the acting user for channel-originated messages. */
  async firstOwner(orgId: string): Promise<Membership | null> {
    const rows = await this.em.fork().find(
      Membership,
      { organization: orgId, role: MembershipRole.OWNER },
      { populate: ['user'], orderBy: { createdAt: 'ASC' }, limit: 1 },
    );
    return rows[0] ?? null;
  }
}
