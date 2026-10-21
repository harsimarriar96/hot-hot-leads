import { EntityManager } from '@mikro-orm/postgresql';
import type { EntitlementsPatch } from '@hothotleads/types';

import { Organization } from '../entities/organization.entity';
import { OnboardingStatus } from '../enums';

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  plan?: string;
  timezone?: string;
  defaultCurrency?: string;
  entitlements?: EntitlementsPatch;
  onboardingStatus?: OnboardingStatus;
}

export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  plan?: string;
  timezone?: string;
  defaultCurrency?: string;
  syncChannelChats?: boolean;
}

export class OrganizationsRepository {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<Organization | null> {
    return this.em.fork().findOne(Organization, { id });
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    return this.em.fork().findOne(Organization, { slug });
  }

  async list(): Promise<Organization[]> {
    return this.em.fork().find(Organization, {}, { orderBy: { createdAt: 'ASC' } });
  }

  async count(): Promise<number> {
    return this.em.fork().count(Organization, {});
  }

  async create(input: CreateOrganizationInput): Promise<Organization> {
    const em = this.em.fork();
    const org = em.create(
      Organization,
      {
        name: input.name,
        slug: input.slug,
        plan: input.plan ?? 'standard',
        timezone: input.timezone ?? 'UTC',
        defaultCurrency: input.defaultCurrency ?? 'USD',
        entitlements: input.entitlements ?? {},
        onboardingStatus: input.onboardingStatus ?? OnboardingStatus.PENDING,
      },
      { partial: true },
    );
    await em.persistAndFlush(org);
    return org;
  }

  async update(id: string, patch: UpdateOrganizationInput): Promise<Organization> {
    const em = this.em.fork();
    const org = await em.findOneOrFail(Organization, { id });
    if (patch.name !== undefined) org.name = patch.name;
    if (patch.slug !== undefined) org.slug = patch.slug;
    if (patch.plan !== undefined) org.plan = patch.plan;
    if (patch.timezone !== undefined) org.timezone = patch.timezone;
    if (patch.defaultCurrency !== undefined) org.defaultCurrency = patch.defaultCurrency;
    if (patch.syncChannelChats !== undefined) org.syncChannelChats = patch.syncChannelChats;
    await em.flush();
    return org;
  }

  async updateEntitlements(id: string, patch: EntitlementsPatch): Promise<Organization> {
    const em = this.em.fork();
    const org = await em.findOneOrFail(Organization, { id });
    org.entitlements = patch;
    await em.flush();
    return org;
  }

  async advanceStatus(id: string, from: OnboardingStatus, to: OnboardingStatus): Promise<Organization> {
    const em = this.em.fork();
    const org = await em.findOneOrFail(Organization, { id });
    if (org.onboardingStatus !== from) {
      throw new Error(
        `Cannot advance onboarding from ${org.onboardingStatus} → ${to}; expected current state ${from}`,
      );
    }
    org.onboardingStatus = to;
    await em.flush();
    return org;
  }

  async setStatus(id: string, status: OnboardingStatus): Promise<Organization> {
    const em = this.em.fork();
    const org = await em.findOneOrFail(Organization, { id });
    org.onboardingStatus = status;
    await em.flush();
    return org;
  }

  /** Deletes the organization; products, memberships, sessions and tokens cascade at the DB level. */
  async remove(id: string): Promise<void> {
    const em = this.em.fork();
    const org = await em.findOne(Organization, { id });
    if (!org) return;
    em.remove(org);
    await em.flush();
  }
}
