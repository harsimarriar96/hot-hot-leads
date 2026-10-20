# @hothotleads/db

Postgres schema + MikroORM entities + repositories for HotHotLeads.

## Commands

All commands run from this directory and require `DATABASE_URL` in the environment.

```bash
# Apply all pending migrations
npm run db:migrate

# Create a new migration from current entity diff
npm run db:migrate:create

# Revert the last migration
npm run db:migrate:down

# Drop the schema and re-apply every migration
npm run db:fresh
```

The CLI reads `packages/db/.env` (see `mikro-orm.config.ts`), so put `DATABASE_URL` there or export it in your shell, then from the repo root:

```bash
npm --workspace @hothotleads/db run db:migrate
```

## Local dev

```bash
docker compose up -d postgres         # starts Postgres 16 on localhost:5434
npm --workspace @hothotleads/db run db:migrate
```

## Patterns

The five repositories wrap a MikroORM `EntityManager`. Apps register them via their own Nest module (`apps/api/src/db/db.module.ts`). Five things to know:

1. **Fork before querying.** Every repository method calls `this.em.fork()` before reading or mutating. This gives each operation its own Unit of Work. Do not use the global `EntityManager` directly from request handlers.
2. **Populate related entities explicitly.** Reads that need related data (e.g., a product with its ICP + sales channels) must pass `populate: [...]`. No implicit lazy loading.
3. **Persist + flush in one call.** Use `em.persistAndFlush(entity)` for single-entity writes. For multi-entity transactions, call `em.transactional(async (em) => ...)`.
4. **Upsert is `findOne` + update-in-place OR `create` + persist.** There's no generic upsert helper; each repository implements upsert for its own domain where needed.
5. **Enums are Postgres native.** TypeScript enum values must exactly match Postgres enum values. Adding a value requires a migration plus an update to the TS enum in `src/enums/`.

## Schema

All tables use `uuid` primary keys with `gen_random_uuid()` from `pgcrypto`. Product-owned tables cascade on delete. `leads` enforces `(product_id, domain)` uniqueness via a partial index (only when `domain IS NOT NULL`).

See [src/entities/](src/entities/) for the canonical schema definitions.
