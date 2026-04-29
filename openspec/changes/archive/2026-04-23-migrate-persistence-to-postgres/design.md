## Context

The current system persists everything in a user-owned Notion workspace. `ProductsRepository` walks a Knowledge page tree by page title, finds child databases, and reads rows by property name. Writes go to Notion databases mapped per product via runtime lookups. The data shape depends on the user not renaming pages and on property names remaining consistent.

This is slow (every operation is a network round-trip at ~300–800ms), brittle (string-keyed schemas), and inherently non-relational — we can't join leads to signals, enforce uniqueness, or page through results efficiently. The upcoming onboarding flow and product-chat feature assume sub-100ms reads and transactional writes. Postgres is the obvious answer.

The user chose **MikroORM** (not Prisma/Drizzle/TypeORM). MikroORM fits NestJS well via `@mikro-orm/nestjs`, gives us Unit of Work semantics, first-class migrations via `@mikro-orm/migrations`, and a typed EntityManager that the existing repository pattern can wrap cleanly.

## Goals / Non-Goals

**Goals:**
- Replace every Notion repository with a MikroORM-backed repository while keeping the public method signatures agents depend on stable.
- Define the full relational schema in `packages/db` with migrations that can recreate the database from scratch.
- Remove `@notionhq/client`, all four `NOTION_*` env vars, and every reference to `notionPageId` from domain types.
- Fail fast at boot if Postgres is unreachable.
- Provide a one-command local dev setup via `docker-compose`.

**Non-Goals:**
- Data migration from Notion to Postgres. The system is pre-production; we start from an empty database. If migration becomes necessary later it is a follow-up change.
- Multi-tenancy. Single-tenant per deployment was confirmed — no `workspace_id` column on any table. There will be a `workspace` singleton row (introduced by the onboarding change) but it is not an FK target for GTM data.
- Read replicas, connection poolers (PgBouncer), or any scaling concern.
- Changing agent prompts or behavior.

## Decisions

### 1. MikroORM + `@mikro-orm/postgresql` + `@mikro-orm/nestjs`

Config lives in `packages/db/src/mikro-orm.config.ts` and is consumed by both the runtime (`MikroOrmModule.forRoot`) and the CLI (`npx mikro-orm migration:*`). Entities are declared with decorators; relations use `@OneToMany`, `@ManyToOne`, `@OneToOne`, `@Enum`.

**Alternatives considered:** Prisma (rejected by user), Drizzle (rejected), raw `pg` with hand-written SQL (too much boilerplate for this many entities).

### 2. UUID primary keys generated in Postgres

Every table uses `id uuid primary key default gen_random_uuid()` (requires the `pgcrypto` extension, enabled by the first migration). MikroORM declares these as `@PrimaryKey({ type: 'uuid' })` with `defaultRaw: 'gen_random_uuid()'`. This lets the database own identity and keeps inserts simple.

### 3. Enum-as-Postgres-enum, not varchar + check constraint

Native enum types (`lead_status`, `signal_type`, etc.) give us referential integrity at the column level and small index footprint. Adding values requires a migration (`ALTER TYPE ... ADD VALUE`). We explicitly keep the TypeScript unions in `packages/types` as the source of truth for code, and the Postgres enums as the source of truth for the database — the schema test ensures they match.

### 4. Repository pattern inside `packages/db`

Each entity has a thin repository class in `packages/db/src/repositories/<entity>.repository.ts` that wraps the `EntityManager`. Repositories expose the same method names as the former Notion repositories (`getProduct`, `saveLead`, `updateLead`, `getRecent`, etc.). The API's NestJS modules inject these repositories via `@InjectRepository(Entity)` + a provider that returns the custom class.

### 5. Migrations are committed SQL

`mikro-orm migration:create` emits TypeScript migration files (up/down with `ctx.execute()`), which we keep under `packages/db/src/migrations/`. Migrations are checked into git and applied via `turbo run db:migrate`. We do not run schema-sync at boot — diff between entities and DB is a developer concern, caught by a `mikro-orm migration:check` command in CI (added later).

### 6. Soft FK cascades where product is the root

All product-owned tables declare `ON DELETE CASCADE` at the DB level AND `cascade: [Cascade.REMOVE]` at the ORM level. Deleting a product is an explicit admin action — there is no current UI for it, but the contract is clean in case one appears.

### 7. JSONB for open-ended fields

`enrichment_data` on `leads` and `task_payload` on `schedules` and `buyer_personas` on `product_icp` are `jsonb`. MikroORM maps these to `Record<string, unknown>`. We do not try to schematize them at the DB layer — enrichment payloads vary and schedules may pass arbitrary agent arguments.

### 8. Local dev uses docker-compose; prod uses external managed Postgres

`docker-compose.yml` defines a `postgres:16-alpine` service with a named volume `hothotleads-pgdata` and port 5432 bound to localhost. Production is whatever managed Postgres the operator chooses (Railway, Neon, RDS, Supabase); we only require a valid `DATABASE_URL`.

### 9. `ProductContextAgent` now loads a `Product` entity

Instead of walking Notion pages, it calls `ProductsRepository.getProduct(name)` which returns the full aggregate (product + ICP + channels + sources + predefined prospects) in one query via `populate`. The tool schema stays the same; only the implementation changes.

## Risks / Trade-offs

- **Notion content lost** → Mitigation: not applicable; the user confirmed "move away from Notion completely" and there is no production data. Document in `proposal.md` that no automatic migration is provided.
- **Boot-time dependency on Postgres** → Mitigation: document the `docker-compose up` prerequisite loudly in README and CLAUDE.md; keep the error message clear when startup fails.
- **Enum drift between TS and Postgres** → Mitigation: the `/feedback-review`-style scripts that insert arbitrary enum values will fail loudly. Add a small test in `packages/db` that asserts every TS union value round-trips through the DB. (Deferred to a follow-up if time-boxed.)
- **MikroORM unfamiliarity on the team** → Mitigation: confine ORM knowledge to `packages/db`. Agent code consumes narrow repository methods, not the EntityManager. Add an internal `packages/db/README.md` with the 5 patterns we use (findOne with populate, persist+flush, Unit of Work per request, transactions via `em.transactional`, migrations).
- **Connection exhaustion under load** → Mitigation: pool max 10 is sufficient for a single API process at expected load; revisit only if latency problems appear.
- **N+1 on related loads** → Mitigation: repositories explicitly `populate` the relations they return. Forbid ad-hoc `find()` without populate in the code review checklist for `packages/db`.

## Migration Plan

1. Add `@mikro-orm/*` dependencies to `packages/db`.
2. Write `mikro-orm.config.ts` consuming `DATABASE_URL`.
3. Author entities (Product, ProductIcp, ProductSalesChannel, ProductSource, PredefinedProspect, Lead, OutreachDraft, Signal, Schedule, FeedbackEntry).
4. Generate initial migration: `npx mikro-orm migration:create --initial`.
5. Enable `pgcrypto` in the first migration's `up()`.
6. Add `docker-compose.yml` with the Postgres service.
7. Write repositories matching the Notion repositories' public API.
8. Update `packages/types` to export Notion-free domain types; re-export from entities where it makes sense.
9. Rewire every `BaseAgent` tool implementation import from `src/integrations/notion/...` to `@hothotleads/db`.
10. Delete `src/integrations/notion/` and its module wiring.
11. Remove `NOTION_*` entries from `src/config/configuration.ts` and `.env.example`; add `DATABASE_URL`.
12. Remove `@notionhq/client` from `apps/api/package.json`.
13. Update `CLAUDE.md`: rewrite "Notion Workspace Structure" section and "Environment Variables" section.
14. Manually smoke-test each slash command (`/generate-leads`, `/check-signals`, `/draft-outreach`, `/feedback-review`, `/setup-schedule`) end-to-end against a clean Postgres.

**Rollback:** revert the PR. Since Postgres is additive (no production Notion data is touched), rollback is safe. Document that any data created in Postgres during testing is discarded on rollback.

## Open Questions

- Do we want `pg_trgm` for fuzzy product/company search? **Proposed:** enable the extension in the initial migration but don't add indexes yet — defer until the onboarding or chat feature shows it's needed.
- Should `OutreachDraft` have a `sent_at` field for tracking what's been sent? **Proposed:** not in this change. The outreach queue concept currently means "drafted"; "sent" tracking is a separate feature.
- Audit log for agent writes? **Proposed:** defer. Feedback entries partially serve this purpose.
