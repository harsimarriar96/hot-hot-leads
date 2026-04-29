import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import configuration from './config/configuration';
import { AgentsModule } from './agents/agents.module';
import { ChannelsModule } from './channels/channels.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { AppSchedulerModule } from './scheduler/scheduler.module';
import { DbModule } from './db/db.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ProductsModule } from './modules/products/products.module';
import { ProductChatModule } from './modules/chat/chat.module';
import { AdminModule } from './modules/admin/admin.module';
import { SchedulesApiModule } from './modules/schedules/schedules.module';
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
      exclude: [
        '/api/(.*)',
        '/chat',
        '/chat/(.*)',
        '/health',
        '/webhooks/(.*)',
        '/onboarding',
        '/onboarding/(.*)',
        '/settings',
        '/settings/(.*)',
        '/products/(.*)/chat',
        '/products/(.*)/chat/(.*)',
        '/admin/(.*)',
      ],
    }),
    DbModule,
    CryptoModule,
    IntegrationsModule,
    AgentsModule,
    ChannelsModule,
    AppSchedulerModule,
    OnboardingModule,
    SettingsModule,
    ProductsModule,
    ProductChatModule,
    AdminModule,
    SchedulesApiModule,
  ],
  controllers: [HealthController, ChatController, ReportsController],
})
export class AppModule {}
