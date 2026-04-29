## Why

Notion is the wrong primitive for this system's persistence layer. It is slow (every read is a network round-trip + rate-limited), the shape of the data is fragile (pages-as-databases, property-name-as-column), and we cannot run joins, indexes, or transactions. Every repository currently does string-keyed property lookups into Notion blocks, caches lazily in memory, and hopes the user doesn't rename a page. As we add onboarding and product chats, we need: transactional writes, relational integrity between products/leads/outreach, full-text search, and fast reads the UI can depend on. Postgres solves all of this and is a one-line dependency in every environment we care about.

## What Changes

- **BREAKING**: Drop `@notionhq/client` and remove `src/integrations/notion/` entirely — the service, all five repositories (`products`, `leads`, `signals`, `schedules`, `feedback`), and their consumers.
- **BREAKING**: Remove the `NOTION_API_KEY`, `NOTION_KNOWLEDGE_PAGE_ID`, `NOTION_OUTPUT_PAGE_ID`, and `NOTION_SCHEDULES_DATABASE_ID` environment variables. Add `DATABASE_URL`.
- Add Postgres as a first-class dependency with MikroORM as the data-access layer. All entities, migrations, and seed data live in `packages/db` (scaffolded by the Turborepo change).
- Model the GTM domain as normalized tables: `products`, `product_icp`, `product_sales_channels`, `product_sources`, `predefined_prospects`, `leads`, `outreach_drafts`, `signals`, `schedules`, `feedback_entries`. Product-owned resources (leads, signals, etc.) reference `products.id` via foreign key.
- Replace each Notion repository with an equivalent MikroORM-backed repository exposing the same method signatures so agents don't change. Drop the `notionPageId` field from every domain type.
- Add initial MikroORM migrations that create the schema from scratch. Add a `migrate` script at the root that runs via `turbo`.
- Update `BaseAgent`'s tool implementations that previously called Notion repositories to call the new Postgres repositories. The tool names and I/O shapes MUST NOT change.
- Add a Postgres container to `docker-compose.yml` for local dev (and document the alternative: local Postgres install or managed Postgres).

## Capabilities

### New Capabilities
- `postgres-datastore`: The Postgres connection, MikroORM configuration, migration lifecycle, and conventions for entities and repositories shared across the workspace.
- `gtm-data-model`: The normalized relational model for products, leads, outreach drafts, signals, schedules, and feedback — including the integrity rules (FKs, cascades, unique constraints) that replace Notion's implicit page-based structure.

### Modified Capabilities
<!-- None — no prior specs exist. The current Notion-backed code is documented in CLAUDE.md only. -->

## Impact

- **Code**: `src/integrations/notion/` deleted. `src/common/types/*.ts` edited to remove every `notionPageId` field and every Notion-specific hint. `BaseAgent` tool executors updated to use the new Postgres repos (same names, same inputs). `ProductContextAgent` no longer navigates a Notion hierarchy — it loads a `Product` entity with its relations.
- **Packages**: `packages/db` gains the MikroORM config, entity definitions, repositories, migrations, and a `getOrm()` factory. `packages/types` re-exports the domain types (now Notion-free).
- **Runtime**: the app gains a Postgres connection at boot. Startup fails fast if `DATABASE_URL` is missing or unreachable.
- **Env**: four `NOTION_*` variables removed; `DATABASE_URL` added. `.env.example` updated.
- **Dev workflow**: `docker-compose up -d postgres` is the new prerequisite for `turbo run dev`. Documented in `CLAUDE.md` and `README.md`.
- **Data**: existing Notion data is NOT migrated automatically. Since the user is moving away from Notion completely and the system is pre-production, we start from an empty Postgres. (If a migration becomes necessary, it becomes a follow-up change.)
- **Depends on**: `convert-to-turborepo` must land first (this change writes into `packages/db`).
- **Out of scope**: onboarding UI, product chat feature — separate changes.
