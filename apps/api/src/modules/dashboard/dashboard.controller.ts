import { Controller, Get } from '@nestjs/common';
import type { DashboardOverview } from '@hothotleads/types';

import { Auth } from '../auth/auth.decorator';
import { RequirePermission } from '../auth/access.decorators';
import { requireOrg, type TenantContext } from '../auth/tenant-context';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** Cross-product "what needs attention" numbers. Signal data is skipped when the feature is off. */
  @Get('overview')
  @RequirePermission('leads:read')
  overview(@Auth() auth: TenantContext): Promise<DashboardOverview> {
    const { org, entitlements } = requireOrg(auth);
    return this.dashboard.overview(org.id, { signalsEnabled: entitlements.features.signals });
  }
}
