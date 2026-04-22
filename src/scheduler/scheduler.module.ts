import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AgentsModule } from '../agents/agents.module';
import { ChannelsModule } from '../channels/channels.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [ScheduleModule.forRoot(), AgentsModule, ChannelsModule, IntegrationsModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class AppSchedulerModule {}
