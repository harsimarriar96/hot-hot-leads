import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MembershipsRepository,
  OrganizationsRepository,
  type Organization,
  type Schedule,
  type User,
} from '@hothotleads/db';

import { buildTenantContext, denial, type OrgContext, type TenantContext } from './tenant-context';

@Injectable()
export class TenantContextService {
  constructor(
    private readonly config: ConfigService,
    private readonly orgsRepo: OrganizationsRepository,
    private readonly membershipsRepo: MembershipsRepository,
  ) {}

  private get schedulesEnabled(): boolean {
    return this.config.get<boolean>('features.schedules') === true;
  }

  /**
   * Context for an HTTP request. `orgId` comes from the X-Organization-Id header or the
   * session default; with none, the user's only membership is used. A platform admin may
   * target any organization (support mode); anyone else must be a member.
   */
  async forRequest(user: User, orgId: string | null): Promise<TenantContext> {
    const opts = { actor: 'user' as const, schedulesEnabled: this.schedulesEnabled };
    if (!orgId) {
      const memberships = await this.membershipsRepo.listForUser(user.id);
      if (memberships.length === 1) {
        const m = memberships[0];
        return buildTenantContext(user, m.organization, m, opts);
      }
      return buildTenantContext(user, null, null, opts);
    }
    const membership = await this.membershipsRepo.find(user.id, orgId);
    if (membership) return buildTenantContext(user, membership.organization, membership, opts);
    if (user.isPlatformAdmin) {
      const org = await this.orgsRepo.findById(orgId);
      if (!org) throw denial({ code: 'no_organization', message: 'Organization not found' });
      return buildTenantContext(user, org, null, opts);
    }
    throw denial({ code: 'permission_denied', message: 'Not a member of that organization' });
  }

  /** Context for a cron-fired schedule: its organization and the user who created it. */
  async forSchedule(schedule: Schedule): Promise<OrgContext | null> {
    const org = schedule.organization;
    const creator = schedule.createdBy ?? (await this.membershipsRepo.firstOwner(org.id))?.user;
    if (!creator) return null;
    const membership = await this.membershipsRepo.find(creator.id, org.id);
    if (!membership && !creator.isPlatformAdmin) return null;
    const ctx = buildTenantContext(creator, org, membership, {
      actor: 'schedule',
      schedulesEnabled: this.schedulesEnabled,
    });
    return ctx.role ? (ctx as OrgContext) : null;
  }

  /** Context for a channel-originated message: the organization's earliest owner acts. */
  async forChannel(org: Organization): Promise<OrgContext | null> {
    const owner = await this.membershipsRepo.firstOwner(org.id);
    if (!owner) return null;
    return buildTenantContext(owner.user, org, owner, {
      actor: 'channel',
      schedulesEnabled: this.schedulesEnabled,
    }) as OrgContext;
  }
}
