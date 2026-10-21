import { Controller, HttpCode, Post } from '@nestjs/common';

import { Auth } from '../auth/auth.decorator';
import { RequirePermission } from '../auth/access.decorators';
import { requireOrg, type TenantContext } from '../auth/tenant-context';
import { DemoSeedService } from './demo-seed.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly demoSeed: DemoSeedService) {}

  /** Loads the demo product into the caller's active organization. */
  @Post('demo-seed')
  @RequirePermission('products:write')
  @HttpCode(200)
  async seed(@Auth() auth: TenantContext) {
    return this.demoSeed.seed(requireOrg(auth));
  }
}
