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
import { AuthModule } from './modules/auth/auth.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ProductsModule } from './modules/products/products.module';
import { ChatModule } from './modules/chat/chat.module';
import { AdminModule } from './modules/admin/admin.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { PlatformModule } from './modules/platform/platform.module';
import { SchedulesApiModule } from './modules/schedules/schedules.module';
import { HealthController } from './health.controller';
import { ReportsController } from './reports.controller';

// Schedules are not production-ready (in-process cron, single instance only).
// Off by default; flip SCHEDULES_ENABLED=true to load the scheduler + its API.
const schedulesEnabled = configuration().features.schedules;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ServeStaticModule.forRoot({
      // apps/api/dist -> apps/web/dist
      rootPath: join(__dirname, '..', '..', 'web', 'dist'),
      exclude: ['/api/(.*)', '/health', '/webhooks/(.*)'],
    }),
    DbModule,
    CryptoModule,
    AuthModule,
    IntegrationsModule,
    AgentsModule,
    ChannelsModule,
    OnboardingModule,
    SettingsModule,
    ProductsModule,
    ChatModule,
    AdminModule,
    OrganizationModule,
    PlatformModule,
    ...(schedulesEnabled ? [AppSchedulerModule, SchedulesApiModule] : []),
  ],
  controllers: [HealthController, ReportsController],
})
export class AppModule {}
