import {
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DemoSeedService } from './demo-seed.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly config: ConfigService,
    private readonly demoSeed: DemoSeedService,
  ) {}

  @Post('demo-seed')
  @HttpCode(200)
  async seed(@Headers('x-admin-token') token?: string) {
    const expected = this.config.get<string>('security.appSecretKey');
    if (!token || !expected || token !== expected) {
      throw new ForbiddenException('Invalid admin token');
    }
    return this.demoSeed.seed();
  }
}
