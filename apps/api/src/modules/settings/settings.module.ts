import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { OrganizationModule } from '../organization/organization.module';
import { UsersModule } from '../users/users.module';
import { ChannelCredentialsModule } from '../channels/channel-credentials.module';
import { SettingsController } from './settings.controller';

@Module({
  imports: [AuthModule, OrganizationModule, UsersModule, ChannelCredentialsModule],
  controllers: [SettingsController],
})
export class SettingsModule {}
