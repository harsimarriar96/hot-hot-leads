import { Injectable } from '@nestjs/common';
import { LeadsRepository, ProductsRepository } from '@hothotleads/db';
import type { ChannelKey } from '@hothotleads/types';

import { denial, type OrgContext } from './tenant-context';

/** Start of the current month in UTC: monthly quotas are counted in UTC. */
export function startOfUtcMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Enforces the numeric and channel limits of an organization's entitlements. */
@Injectable()
export class EntitlementsService {
  constructor(
    private readonly productsRepo: ProductsRepository,
    private readonly leadsRepo: LeadsRepository,
  ) {}

  /** `extra` lets a caller account for a product it is about to replace. */
  async assertCanCreateProduct(ctx: OrgContext, extra = 0): Promise<void> {
    const max = ctx.entitlements.limits.maxProducts;
    const count = (await this.productsRepo.countProducts(ctx.org.id)) + extra;
    if (count >= max) {
      throw denial({
        code: 'limit_reached',
        message: `This organization is limited to ${max} product${max === 1 ? '' : 's'} (${count} of ${max} used)`,
        limit: 'maxProducts',
      });
    }
  }

  async assertLeadQuota(ctx: OrgContext): Promise<void> {
    const max = ctx.entitlements.limits.maxLeadsPerMonth;
    const count = await this.leadsRepo.countCreatedSince(ctx.org.id, startOfUtcMonth());
    if (count >= max) {
      throw denial({
        code: 'limit_reached',
        message: `This organization is limited to ${max} new leads per month (${count} of ${max} used)`,
        limit: 'maxLeadsPerMonth',
      });
    }
  }

  assertChannelAllowed(ctx: OrgContext, channel: ChannelKey): void {
    if (!ctx.entitlements.channels.includes(channel)) {
      throw denial({ code: 'feature_disabled', message: `The ${channel} channel is not enabled for this organization` });
    }
  }
}
