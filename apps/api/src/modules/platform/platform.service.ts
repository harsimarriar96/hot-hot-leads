import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MembershipsRepository,
  Organization,
  OrganizationsRepository,
  ProductsRepository,
  UsersRepository,
} from '@hothotleads/db';
import {
  CHANNEL_KEYS,
  FEATURE_KEYS,
  resolveEntitlements,
  type EntitlementsPatch,
  type PlatformOrganization,
  type PlatformUser,
  type Role,
} from '@hothotleads/types';

import { OrganizationService, type NewOrganizationInput } from '../organization/organization.service';

/** Keep only known keys with the right types; the patch is stored as-is and resolved on read. */
export function sanitizeEntitlementsPatch(input: EntitlementsPatch | undefined): EntitlementsPatch {
  const out: EntitlementsPatch = {};
  if (input?.features) {
    const features: EntitlementsPatch['features'] = {};
    for (const key of FEATURE_KEYS) {
      const v = input.features[key];
      if (typeof v === 'boolean') features[key] = v;
    }
    out.features = features;
  }
  if (input?.limits) {
    const limits: EntitlementsPatch['limits'] = {};
    for (const key of ['maxProducts', 'maxMembers', 'maxLeadsPerMonth'] as const) {
      const v = input.limits[key];
      if (typeof v === 'number' && Number.isInteger(v) && v >= 0) limits[key] = v;
    }
    out.limits = limits;
  }
  if (Array.isArray(input?.channels)) {
    out.channels = CHANNEL_KEYS.filter((c) => input!.channels!.includes(c));
  }
  return out;
}

@Injectable()
export class PlatformService {
  constructor(
    private readonly orgsRepo: OrganizationsRepository,
    private readonly orgSvc: OrganizationService,
    private readonly usersRepo: UsersRepository,
    private readonly membershipsRepo: MembershipsRepository,
    private readonly productsRepo: ProductsRepository,
  ) {}

  async listOrganizations(): Promise<PlatformOrganization[]> {
    const orgs = await this.orgsRepo.list();
    return Promise.all(orgs.map((o) => this.toView(o)));
  }

  async getOrganization(id: string): Promise<PlatformOrganization> {
    return this.toView(await this.orgSvc.getRequired(id));
  }

  async createOrganization(input: NewOrganizationInput): Promise<PlatformOrganization> {
    const org = await this.orgSvc.create({ ...input, entitlements: sanitizeEntitlementsPatch(input.entitlements) });
    return this.toView(org);
  }

  async updateOrganization(id: string, patch: Parameters<OrganizationService['update']>[1]): Promise<PlatformOrganization> {
    return this.toView(await this.orgSvc.update(id, patch));
  }

  /** Merges into the stored patch: a body with only `features.chat` leaves limits and channels alone. */
  async updateEntitlements(id: string, patch: EntitlementsPatch): Promise<PlatformOrganization> {
    const org = await this.orgSvc.getRequired(id);
    const current = sanitizeEntitlementsPatch(org.entitlements);
    const next = sanitizeEntitlementsPatch(patch);
    const merged: EntitlementsPatch = {
      features: { ...current.features, ...next.features },
      limits: { ...current.limits, ...next.limits },
      channels: next.channels ?? current.channels,
    };
    if (!merged.channels) delete merged.channels;
    return this.toView(await this.orgsRepo.updateEntitlements(id, merged));
  }

  /** Permanently deletes an organization and everything it owns. The caller must retype its slug. */
  async deleteOrganization(id: string, confirmSlug: string): Promise<void> {
    const org = await this.orgSvc.getRequired(id);
    if (confirmSlug !== org.slug) {
      throw new BadRequestException(`Type the organization slug "${org.slug}" to confirm deletion`);
    }
    await this.orgsRepo.remove(id);
  }

  async listUsers(): Promise<PlatformUser[]> {
    const users = await this.usersRepo.list();
    return Promise.all(
      users.map(async (u) => {
        const memberships = await this.membershipsRepo.listForUser(u.id);
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          isPlatformAdmin: u.isPlatformAdmin,
          hasPassword: Boolean(u.passwordHash),
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
          createdAt: u.createdAt.toISOString(),
          memberships: memberships.map((m) => ({
            organizationId: m.organization.id,
            organizationName: m.organization.name,
            role: m.role as Role,
          })),
        };
      }),
    );
  }

  async requireUser(id: string): Promise<void> {
    if (!(await this.usersRepo.findById(id))) throw new NotFoundException('User not found');
  }

  private async toView(org: Organization): Promise<PlatformOrganization> {
    const [memberCount, productCount] = await Promise.all([
      this.membershipsRepo.countForOrg(org.id),
      this.productsRepo.countProducts(org.id),
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
      entitlementsPatch: org.entitlements ?? {},
      memberCount,
      productCount,
      createdAt: org.createdAt.toISOString(),
    };
  }
}
