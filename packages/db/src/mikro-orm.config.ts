import { defineConfig } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import { resolve } from 'node:path';

import * as Entities from './entities';

const entities = Object.values(Entities);

export default defineConfig({
  entities,
  clientUrl: process.env.DATABASE_URL,
  driverOptions: process.env.DATABASE_SSL === 'true' ? { connection: { ssl: { rejectUnauthorized: false } } } : {},
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
