import { Module } from '@nestjs/common';

import { DbModule } from '../../db/db.module';
import { AuthModule } from '../auth/auth.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { OrganizationService } from './organization.service';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [MembersController],
  providers: [OrganizationService, MembersService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
