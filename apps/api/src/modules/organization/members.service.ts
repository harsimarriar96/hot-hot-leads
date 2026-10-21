import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MembershipRole,
  MembershipsRepository,
  OrganizationsRepository,
  ProductsRepository,
} from '@hothotleads/db';
import { resolveEntitlements, type Member, type OrganizationView, type Role } from '@hothotleads/types';

import { denial, type OrgContext } from '../auth/tenant-context';

@Injectable()
export class MembersService {
  constructor(
    private readonly membershipsRepo: MembershipsRepository,
    private readonly orgsRepo: OrganizationsRepository,
    private readonly productsRepo: ProductsRepository,
  ) {}

  async organizationView(orgId: string): Promise<OrganizationView> {
    const org = await this.orgsRepo.findById(orgId);
    if (!org) throw new NotFoundException('Organization not found');
    const [memberCount, productCount] = await Promise.all([
      this.membershipsRepo.countForOrg(orgId),
      this.productsRepo.countProducts(orgId),
    ]);
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      timezone: org.timezone,
      defaultCurrency: org.defaultCurrency,
      onboardingStatus: org.onboardingStatus,
      entitlements: resolveEntitlements(org.entitlements),
      memberCount,
      productCount,
      createdAt: org.createdAt.toISOString(),
    };
  }

  async list(orgId: string): Promise<Member[]> {
    const rows = await this.membershipsRepo.listForOrg(orgId);
    return rows.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role as Role,
      joinedAt: m.createdAt.toISOString(),
    }));
  }

  /**
   * Invariants: you cannot change your own membership, only an owner may grant or revoke
   * `owner`, and an organization always keeps at least one owner.
   */
  async updateRole(ctx: OrgContext, userId: string, role: Role): Promise<Member> {
    const target = await this.requireTarget(ctx, userId);
    const touchesOwner = target.role === MembershipRole.OWNER || role === 'owner';
    if (touchesOwner && ctx.role !== 'owner') {
      throw denial({ code: 'permission_denied', message: 'Only an owner can grant or revoke the owner role' });
    }
    if (target.role === MembershipRole.OWNER && role !== 'owner') {
      await this.requireAnotherOwner(ctx.org.id);
    }
    const updated = await this.membershipsRepo.updateRole(userId, ctx.org.id, role as MembershipRole);
    return {
      userId: target.user.id,
      email: target.user.email,
      name: target.user.name,
      role: updated.role as Role,
      joinedAt: target.createdAt.toISOString(),
    };
  }

  async remove(ctx: OrgContext, userId: string): Promise<void> {
    const target = await this.requireTarget(ctx, userId);
    if (target.role === MembershipRole.OWNER) {
      if (ctx.role !== 'owner') {
        throw denial({ code: 'permission_denied', message: 'Only an owner can remove another owner' });
      }
      await this.requireAnotherOwner(ctx.org.id);
    }
    await this.membershipsRepo.remove(userId, ctx.org.id);
  }

  private async requireTarget(ctx: OrgContext, userId: string) {
    if (userId === ctx.user.id) {
      throw new BadRequestException('You cannot change your own membership; ask another owner');
    }
    const target = await this.membershipsRepo.find(userId, ctx.org.id);
    if (!target) throw new NotFoundException('Member not found');
    return target;
  }

  private async requireAnotherOwner(orgId: string): Promise<void> {
    if ((await this.membershipsRepo.countOwners(orgId)) <= 1) {
      throw new ConflictException('An organization needs at least one owner');
    }
  }
}
