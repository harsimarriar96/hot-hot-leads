import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DbModule } from '../../db/db.module';
import { AdminController } from './admin.controller';
import { DemoSeedService } from './demo-seed.service';

@Module({
  imports: [ConfigModule, DbModule],
  controllers: [AdminController],
  providers: [DemoSeedService],
})
export class AdminModule {}
