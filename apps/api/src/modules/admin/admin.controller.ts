import { Controller, HttpCode, Post } from '@nestjs/common';

import { DemoSeedService } from './demo-seed.service';

/** Operator-only surface; protected by the global bearer-token guard. */
@Controller('admin')
export class AdminController {
  constructor(private readonly demoSeed: DemoSeedService) {}

  @Post('demo-seed')
  @HttpCode(200)
  async seed() {
    return this.demoSeed.seed();
  }
}
