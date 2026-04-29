## 1. Datastore scaffolding in packages/db

- [x] 1.1 Add dependencies to `packages/db/package.json`: `@mikro-orm/core`, `@mikro-orm/postgresql`, `@mikro-orm/migrations`, `@mikro-orm/nestjs`, `@mikro-orm/cli`, `pg`
- [x] 1.2 Author `packages/db/src/mikro-orm.config.ts` reading `DATABASE_URL` with sane pool defaults (min 2, max 10), `migrations.path = ./src/migrations`, `entities` glob, `debug: false`
- [x] 1.3 Add `packages/db/scripts/` wrappers (or just npm scripts) for `db:migrate`, `db:migrate:create`, `db:fresh` using `@mikro-orm/cli`
- [x] 1.4 Export a `getOrm()` factory and `MikroOrmModule.forRootAsync(...)` configuration builder from `@hothotleads/db`

## 2. Entities and enums

- [x] 2.1 Create enum files in `packages/db/src/enums/` mirroring TypeScript unions: `lead-status`, `signal-type`, `signal-source`, `outreach-tone`, `agent-type`, `source-type`, `schedule-channel`
- [x] 2.2 Author `Product` entity (`packages/db/src/entities/product.entity.ts`) with fields per spec and relations to icp, channels, sources, predefinedProspects, leads, signals, schedules, feedbackEntries
- [x] 2.3 Author `ProductIcp` entity (1:1 with Product) with target industries, company sizes, funding stages, geographies, buyer personas (jsonb), notes
- [x] 2.4 Author `ProductSalesChannel` entity (N:1 to Product)
- [x] 2.5 Author `ProductSource` entity (N:1 to Product) with `type` enum
- [x] 2.6 Author `PredefinedProspect` entity (N:1 to Product)
- [x] 2.7 Author `Lead` entity with `status` enum default `'new'`, `signals` text[], `enrichmentData` jsonb, and the `(product_id, domain)` partial unique index
- [x] 2.8 Author `OutreachDraft` entity with `tone` enum, FK to Lead with cascade
- [x] 2.9 Author `Signal` entity with `type`/`source` enums and index on `(product_id, detected_at DESC)`
- [x] 2.10 Author `Schedule` entity with `channel` enum, `cron_expression`, `task_payload` jsonb, optional `product_id`
- [x] 2.11 Author `FeedbackEntry` entity with `agent_type` enum, `issues` and `suggestions` text[], index on `(product_id, created_at DESC)`
- [x] 2.12 Every entity uses UUID PK with `defaultRaw: 'gen_random_uuid()'` and has `createdAt`/`updatedAt` managed by the ORM
- [x] 2.13 Run `tsc --noEmit` on `packages/db` — zero errors

## 3. Migrations

- [x] 3.1 Generate initial migration: `npx mikro-orm migration:create --initial`
- [x] 3.2 Edit the initial migration's `up()` to `CREATE EXTENSION IF NOT EXISTS pgcrypto` before any `gen_random_uuid()` default
- [x] 3.3 Edit the initial migration's `up()` to `CREATE EXTENSION IF NOT EXISTS pg_trgm` (reserved for future fuzzy search; no indexes yet)
- [x] 3.4 Verify the migration creates every enum type with values matching the TS unions exactly
- [x] 3.5 Add the `(product_id, domain) WHERE domain IS NOT NULL` partial unique index on leads
- [x] 3.6 Add `updated_at` auto-update triggers OR rely on MikroORM `@Property({ onUpdate: () => new Date() })` — pick one and apply uniformly
- [x] 3.7 Smoke-test: against an empty Postgres, run migrations, then drop and re-run — both succeed

## 4. Repositories mirroring the Notion API

- [x] 4.1 `ProductsRepository` in `packages/db/src/repositories/products.repository.ts` with methods: `getProduct(name)` (populates all relations), `listProducts()`, `upsertProduct(input)`, `invalidateCache(productName)` (no-op kept for API compat — cache layer is optional)
- [x] 4.2 `LeadsRepository` with methods: `saveLead(lead)`, `updateLead(id, patch)`, `updateLeadScore(id, score, reason)`, `getLead(id)`, `listLeadsByProduct(productId, opts)`, `saveOutreachDraft(draft)`, `listOutreachByLead(leadId)`
- [x] 4.3 `SignalsRepository` with methods: `saveSignal(signal)`, `findActiveSignals(productId)`, `findRecentSignals(productId, sinceIso)`
- [x] 4.4 `SchedulesRepository` with methods: `listEnabled()`, `createSchedule(input)`, `disableSchedule(id)`, `touchLastRun(id)`
- [x] 4.5 `FeedbackRepository` with methods: `saveFeedback(entry)`, `getRecent(productId, limit)`, `getByAgentType(productId, agentType, limit)`
- [x] 4.6 Export all repositories from `packages/db/src/index.ts`
- [x] 4.7 Write smoke tests for each repository using a test Postgres instance (happy path + the FK cascade cases called out in specs)

## 5. Update shared types

- [x] 5.1 Move Notion-free versions of `Product`, `Lead`, `OutreachDraft`, `Signal`, `Schedule`, `FeedbackEntry`, `ProductKnowledge` and related unions into `packages/types/src/`
- [x] 5.2 Remove every `notionPageId`, `notionDatabaseId`, and similar field from shared types
- [x] 5.3 Re-export the types from `packages/db` where it makes sense (keep the source of truth in `packages/types` for UI consumers that don't take an ORM dep)
- [x] 5.4 Update consumers in `apps/api` to import from `@hothotleads/types` and `@hothotleads/db` as appropriate

## 6. Rewire the API

- [x] 6.1 Add `@hothotleads/db` to `apps/api/package.json` dependencies
- [x] 6.2 Register `MikroOrmModule.forRootAsync({ useFactory: ... })` in `apps/api/src/app.module.ts` with the config factory from `@hothotleads/db`
- [x] 6.3 For each NestJS feature module that owns agent code, import `MikroOrmModule.forFeature([...])` with the entities used by its tools; provide the corresponding custom repository class
- [x] 6.4 Update every `BaseAgent` subclass tool implementation to call the new repositories (method names match, imports change from `src/integrations/notion/...` to `@hothotleads/db`)
- [x] 6.5 Update `ProductContextAgent` to read a `Product` aggregate (with populated relations) instead of walking Notion
- [x] 6.6 Update `SchedulerService.onApplicationBootstrap` to load schedules via `SchedulesRepository.listEnabled()` and register CronJobs as before
- [x] 6.7 Update webhook controllers (Telegram, WhatsApp) and `chat.controller.ts` so any message-handling path that previously enriched with Notion context now uses the Postgres-backed product lookup

## 7. Remove Notion

- [x] 7.1 Delete `apps/api/src/integrations/notion/` in its entirety
- [x] 7.2 Remove `@notionhq/client` from `apps/api/package.json` and run `npm install`
- [x] 7.3 Remove `NOTION_API_KEY`, `NOTION_KNOWLEDGE_PAGE_ID`, `NOTION_OUTPUT_PAGE_ID`, `NOTION_SCHEDULES_DATABASE_ID` from `apps/api/src/config/configuration.ts`
- [x] 7.4 Add `DATABASE_URL` (required) to `apps/api/src/config/configuration.ts` with a fail-fast check at boot
- [x] 7.5 Update `.env.example` — remove the four `NOTION_*` vars, add `DATABASE_URL=postgresql://hothotleads:hothotleads@localhost:5432/hothotleads`
- [x] 7.6 Grep the whole repo for `notion`, `Notion`, `@notionhq` — zero runtime matches remain (docs/comments are fine only if historical)

## 8. Local dev and docs

- [x] 8.1 Add `docker-compose.yml` at the repo root with a `postgres:16-alpine` service, named volume `hothotleads-pgdata`, port 5432 on localhost, env for `POSTGRES_USER=hothotleads`, `POSTGRES_PASSWORD=hothotleads`, `POSTGRES_DB=hothotleads`
- [x] 8.2 Add a `packages/db/README.md` covering: running migrations, creating new migrations, and the five ORM patterns used in this repo
- [x] 8.3 Update `CLAUDE.md`: remove the "Notion Workspace Structure" section, replace with a "Data Model" section pointing to the entities; update "Environment Variables"; update "Key Design Decisions"
- [x] 8.4 Update root `README.md` quickstart: `docker-compose up -d postgres` → `turbo run db:migrate` → `turbo run dev`

## 9. Verify end-to-end

- [x] 9.1 Run `turbo run typecheck` — zero errors
- [x] 9.2 Run `turbo run build` — both apps build
- [x] 9.3 Manually exercise: create a Product row, run `/generate-leads` via Telegram — leads land in the `leads` table; `/check-signals` writes to `signals`; `/draft-outreach` writes to `outreach_drafts`; `/feedback-review` reads from `feedback_entries`
- [x] 9.4 Restart the API — scheduled jobs re-register from `schedules`
