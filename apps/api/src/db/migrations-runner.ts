import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MikroORM } from '@mikro-orm/core';

/**
 * Applies pending migrations at boot so a fresh container is usable without a
 * separate migrate step. Disable with DB_AUTO_MIGRATE=false when migrations are
 * run out-of-band (e.g. a release pipeline).
 */
@Injectable()
export class MigrationsRunner implements OnModuleInit {
  private readonly logger = new Logger(MigrationsRunner.name);

  constructor(
    private readonly orm: MikroORM,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<boolean>('database.autoMigrate') === false) {
      this.logger.log('DB_AUTO_MIGRATE=false: skipping migrations');
      return;
    }
    const migrator = this.orm.getMigrator();
    const pending = await migrator.getPendingMigrations();
    if (pending.length === 0) {
      this.logger.log('Database schema is up to date');
      return;
    }
    this.logger.log(`Applying ${pending.length} pending migration(s)…`);
    await migrator.up();
    this.logger.log('Migrations applied');
  }
}
