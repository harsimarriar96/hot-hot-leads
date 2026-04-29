import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EntityManager, defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import { resolve } from 'node:path';

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
        const migrationsPath = resolve(
          __dirname,
          '..',
          '..',
          '..',
          '..',
          'packages',
          'db',
          'src',
          'migrations',
        );
        return defineConfig({
          entities: ENTITIES,
          clientUrl,
          pool: { min: 2, max: 10 },
          debug: config.get<string>('database.debug') === 'true',
          allowGlobalContext: true,
          extensions: [Migrator],
          driverOptions:
            config.get<boolean>('database.ssl') === true
              ? { connection: { ssl: { rejectUnauthorized: false } } }
              : {},
          migrations: {
            path: migrationsPath,
            pathTs: migrationsPath,
            transactional: true,
            allOrNothing: true,
            emit: 'ts',
          },
        });
      },
    }),
    MikroOrmModule.forFeature(ENTITIES),
  ],
  providers: [
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
