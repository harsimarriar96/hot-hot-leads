import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EntityManager, defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import { resolve } from 'node:path';

import { MigrationsRunner } from './migrations-runner';

import {
  Product,
  ProductIcp,
  ProductSalesChannel,
  ProductSource,
  PredefinedProspect,
  Lead,
  OutreachDraft,
  Signal,
  Schedule,
  FeedbackEntry,
  Workspace,
  Operator,
  ChannelCredential,
  ProductChat,
  ProductChatMessage,
  ProductsRepository,
  LeadsRepository,
  SignalsRepository,
  SchedulesRepository,
  FeedbackRepository,
} from '@hothotleads/db';

const ENTITIES = [
  Product,
  ProductIcp,
  ProductSalesChannel,
  ProductSource,
  PredefinedProspect,
  Lead,
  OutreachDraft,
  Signal,
  Schedule,
  FeedbackEntry,
  Workspace,
  Operator,
  ChannelCredential,
  ProductChat,
  ProductChatMessage,
];

@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const clientUrl = config.get<string>('database.url');
        if (!clientUrl) {
          throw new Error('DATABASE_URL is not set. The API cannot start without a database connection.');
        }
        // apps/api/dist/db -> <repo root>/packages/db
        const dbPackageRoot = resolve(__dirname, '..', '..', '..', '..', 'packages', 'db');
        const ssl = config.get<boolean>('database.ssl') === true;
        const rejectUnauthorized = config.get<boolean>('database.sslRejectUnauthorized') !== false;
        return defineConfig({
          entities: ENTITIES,
          clientUrl,
          pool: { min: 2, max: 10 },
          debug: config.get<string>('database.debug') === 'true',
          allowGlobalContext: true,
          extensions: [Migrator],
          driverOptions: ssl ? { connection: { ssl: { rejectUnauthorized } } } : {},
          migrations: {
            // Compiled migrations for runtime; TS sources only when running via ts-node.
            path: resolve(dbPackageRoot, 'dist', 'migrations'),
            pathTs: resolve(dbPackageRoot, 'src', 'migrations'),
            transactional: true,
            allOrNothing: true,
          },
        });
      },
    }),
    MikroOrmModule.forFeature(ENTITIES),
  ],
  providers: [
    MigrationsRunner,
    {
      provide: ProductsRepository,
      useFactory: (em: EntityManager) => new ProductsRepository(em),
      inject: [EntityManager],
    },
    {
      provide: LeadsRepository,
      useFactory: (em: EntityManager) => new LeadsRepository(em),
      inject: [EntityManager],
    },
    {
      provide: SignalsRepository,
      useFactory: (em: EntityManager) => new SignalsRepository(em),
      inject: [EntityManager],
    },
    {
      provide: SchedulesRepository,
      useFactory: (em: EntityManager) => new SchedulesRepository(em),
      inject: [EntityManager],
    },
    {
      provide: FeedbackRepository,
      useFactory: (em: EntityManager) => new FeedbackRepository(em),
      inject: [EntityManager],
    },
  ],
  exports: [
    MikroOrmModule,
    ProductsRepository,
    LeadsRepository,
    SignalsRepository,
    SchedulesRepository,
    FeedbackRepository,
  ],
})
export class DbModule {}
