import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DbModule } from '../../db/db.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { OperatorModule } from '../operator/operator.module';
import { ChannelCredentialsModule } from '../channels/channel-credentials.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [ConfigModule, DbModule, WorkspaceModule, OperatorModule, ChannelCredentialsModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
