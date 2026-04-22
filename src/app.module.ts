import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import configuration from './config/configuration';
import { AgentsModule } from './agents/agents.module';
import { ChannelsModule } from './channels/channels.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { AppSchedulerModule } from './scheduler/scheduler.module';
import { HealthController } from './health.controller';
import { ChatController } from './chat.controller';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'web', 'dist'),
      exclude: ['/api/(.*)', '/chat', '/chat/(.*)', '/health', '/webhooks/(.*)'],
    }),
    IntegrationsModule,
    AgentsModule,
    ChannelsModule,
    AppSchedulerModule,
  ],
  controllers: [HealthController, ChatController, ReportsController],
})
export class AppModule {}
