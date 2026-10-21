import { Module } from '@nestjs/common';

import { DbModule } from '../../db/db.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationModule } from '../organization/organization.module';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
  imports: [DbModule, AuthModule, OrganizationModule],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
