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
  Organization,
  User,
  Membership,
  Session,
  AuthToken,
  ChannelCredential,
  Chat,
  ChatMessage,
  ProductsRepository,
  LeadsRepository,
  SignalsRepository,
  SchedulesRepository,
  FeedbackRepository,
  OrganizationsRepository,
  UsersRepository,
  MembershipsRepository,
  SessionsRepository,
  AuthTokensRepository,
  ChannelCredentialsRepository,
  ChatsRepository,
} from '@hothotleads/db';

const ENTITIES = [
  Organization,
  User,
  Membership,
  Session,
  AuthToken,
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
  ChannelCredential,
  Chat,
  ChatMessage,
];

// Every repository is a plain class over the EntityManager; provide them all here once.
const REPOSITORIES = [
  ProductsRepository,
  LeadsRepository,
  SignalsRepository,
  SchedulesRepository,
  FeedbackRepository,
  OrganizationsRepository,
  UsersRepository,
  MembershipsRepository,
  SessionsRepository,
  AuthTokensRepository,
  ChannelCredentialsRepository,
  ChatsRepository,
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
    ...REPOSITORIES.map((Repo) => ({
      provide: Repo,
      useFactory: (em: EntityManager) => new Repo(em),
      inject: [EntityManager],
    })),
  ],
  exports: [MikroOrmModule, ...REPOSITORIES],
})
export class DbModule {}
