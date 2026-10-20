import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

import * as Entities from './entities';

// CLI commands (migrations) run without the API's env loaded — read this package's .env if present.
loadEnv({ path: resolve(__dirname, '..', '.env') });

const entities = Object.values(Entities);

export default defineConfig({
  entities,
  clientUrl: process.env.DATABASE_URL,
  driverOptions:
    process.env.DATABASE_SSL === 'true'
      ? {
          connection: {
            // Verify the server certificate unless explicitly opted out (self-signed dev setups).
            ssl: { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' },
          },
        }
      : {},
  pool: { min: 2, max: 10 },
  debug: process.env.MIKROORM_DEBUG === 'true',
  extensions: [Migrator],
  migrations: {
    path: resolve(__dirname, 'migrations'),
    pathTs: resolve(__dirname, 'migrations'),
    transactional: true,
    disableForeignKeys: false,
    allOrNothing: true,
    emit: 'ts',
  },
});
