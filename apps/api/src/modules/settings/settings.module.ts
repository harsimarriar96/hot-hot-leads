import { Module } from '@nestjs/common';

import { WorkspaceModule } from '../workspace/workspace.module';
import { OperatorModule } from '../operator/operator.module';
import { ChannelCredentialsModule } from '../channels/channel-credentials.module';
import { SettingsController } from './settings.controller';

@Module({
  imports: [WorkspaceModule, OperatorModule, ChannelCredentialsModule],
  controllers: [SettingsController],
})
export class SettingsModule {}
