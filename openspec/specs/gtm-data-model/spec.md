# gtm-data-model

## Purpose

The relational model for products, leads, outreach drafts, signals, schedules, and feedback — including the integrity rules (FKs, cascades, unique constraints, indexes) that the agents rely on.
## Requirements
### Requirement: Product aggregate

A `Product` SHALL be the root of the GTM domain. Every product-scoped row (lead, outreach draft, signal, schedule, feedback entry, predefined prospect, ICP, sales channel, source) MUST reference `products.id` via a foreign key. Deleting a product SHALL cascade to all of its owned rows (schedules may `SET NULL` since schedules are optionally product-scoped).

The `products` table MUST have: `id` (uuid, pk), `name` (text, unique, not null), `slug` (text, unique, not null — url-safe), `general_info` (text, nullable), `sales_strategy` (text, nullable), `pricing` (text, nullable), `agent_model_tier` (enum `agent_model_tier` with values `fast | default | heavy`, not null, default `'default'`), `agent_extra_instructions` (text, nullable), `icp_strictness` (smallint, not null, default `60`, check constraint `BETWEEN 0 AND 100`), `created_at` (timestamptz), `updated_at` (timestamptz).

The `agent_model_tier` Postgres enum MUST be created before the column (`CREATE TYPE agent_model_tier AS ENUM ('fast', 'default', 'heavy')`).

#### Scenario: Product name is unique
- **WHEN** two inserts attempt to create products with the same `name`
- **THEN** the second insert fails with a unique-violation error

#### Scenario: Deleting a product cascades
- **WHEN** a product with associated leads and signals is deleted
- **THEN** its leads and signals are deleted in the same transaction

#### Scenario: New columns default safely on legacy rows
- **WHEN** the migration adds the three columns to a populated `products` table
- **THEN** existing rows receive `agent_model_tier = 'default'`, `agent_extra_instructions = NULL`, `icp_strictness = 60` without manual data migration

#### Scenario: Strictness range enforced at the DB
- **WHEN** an insert sets `icp_strictness = 150`
- **THEN** the check constraint rejects the row

### Requirement: Product knowledge tables

Four tables SHALL store per-product knowledge:

- `product_icp` — 1:1 with product — fields for target industries (text[]), company sizes (text[]), funding stages (text[]), geographies (text[]), buyer personas (jsonb), and free-text `notes`.
- `product_sales_channels` — 1:N from product — `id`, `product_id`, `name`, `description`, `template` (text, nullable).
- `product_sources` — 1:N from product — `id`, `product_id`, `name`, `url`, `description`, `type` (enum: news | newsletter | database | social | other).
- `predefined_prospects` — 1:N from product — `id`, `product_id`, `company`, `domain`, `industry`, `company_size`, `funding_stage`, `icp_fit_notes`.

#### Scenario: ICP is 1:1 with product
- **WHEN** a second `product_icp` row is inserted for an existing `product_id`
- **THEN** the insert fails due to the `product_id` unique constraint

#### Scenario: Channels load with the product
- **WHEN** `ProductsRepository.getProduct(name)` is called
- **THEN** the returned object includes `salesChannels`, `sources`, `predefinedProspects`, and `icp` populated via ORM relations in a single query

### Requirement: Lead entity

The `leads` table SHALL have: `id` (uuid, pk), `product_id` (uuid, fk → products.id), `company` (text, not null), `domain` (text), `industry`, `company_size`, `funding_stage`, `location`, `tech_stack` (text[]), `contact_name`, `contact_title`, `contact_email`, `linkedin_url`, `score` (int, 0–100, nullable), `buying_intent` (int, 0–100, nullable), `icp_fit_reason` (text), `signal_summary` (text), `status` (enum matching `LeadStatus`), `signals` (text[]), `enrichment_data` (jsonb), `created_at`, `updated_at`.

A unique constraint MUST exist on `(product_id, domain)` when `domain IS NOT NULL` to prevent duplicate companies per product.

#### Scenario: Duplicate lead by domain per product is rejected
- **WHEN** two leads for the same `product_id` are inserted with the same non-null `domain`
- **THEN** the second insert fails

#### Scenario: Lead without domain is allowed
- **WHEN** two leads are inserted for the same product with the same `company` but `domain IS NULL` on both
- **THEN** both inserts succeed (the unique constraint is partial)

#### Scenario: Lead status defaults to 'new'
- **WHEN** a lead is inserted without specifying `status`
- **THEN** the database default sets `status = 'new'`

### Requirement: Outreach draft entity

The `outreach_drafts` table SHALL have: `id` (uuid, pk), `lead_id` (uuid, fk → leads.id), `channel` (text, not null), `subject` (text, nullable), `body` (text, not null), `tone` (enum: formal | casual | friendly), `generated_at` (timestamptz), `created_at`. Drafts MUST cascade on lead delete.

#### Scenario: Draft deleted when lead is deleted
- **WHEN** a lead with two outreach drafts is deleted
- **THEN** both drafts are removed in the same transaction

### Requirement: Signal entity

The `signals` table SHALL have: `id` (uuid, pk), `product_id` (uuid, fk → products.id), `type` (enum matching `SignalType`), `source` (enum matching `SignalSource`, nullable), `description` (text, not null), `company` (text, nullable), `source_url` (text, nullable), `relevance_score` (int, 0–10, nullable), `detected_at` (timestamptz, not null), `expires_at` (timestamptz, nullable), `created_at` (timestamptz).

An index MUST exist on `(product_id, detected_at)` to support "recent signals for product" queries.

#### Scenario: Signal expiry is respected in queries
- **WHEN** a repository method `findActiveSignals(productId)` is called
- **THEN** it returns only signals where `expires_at IS NULL OR expires_at > now()`

### Requirement: Schedule entity

The `schedules` table SHALL have: `id` (uuid, pk), `product_id` (uuid, fk → products.id, nullable — schedules MAY be workspace-wide), `name` (text, not null), `task_prompt` (text, not null), `frequency` (enum: hourly | daily | weekly | custom), `cron_expression` (text, nullable), `user_id` (text, not null), `chat_id` (text, not null), `channel` (enum: telegram | whatsapp), `task_payload` (jsonb, nullable), `enabled` (boolean, default true), `last_run_at` (timestamptz, nullable), `created_at`, `updated_at`.

`SchedulerService` MUST load all `enabled = true` schedules on boot and register them with `@nestjs/schedule`. Registering a new schedule via chat MUST persist to this table and register the cron job live.

#### Scenario: Disabled schedules are not registered
- **WHEN** the API boots and the schedules table contains a row with `enabled = false`
- **THEN** no cron job is registered for that row

#### Scenario: Schedule persists across restarts
- **WHEN** a user creates a schedule via Telegram, then the API restarts
- **THEN** the schedule is re-registered from the database on boot with no user action

### Requirement: Feedback entry entity

The `feedback_entries` table SHALL have: `id` (uuid, pk), `product_id` (uuid, fk → products.id), `agent_type` (enum matching `AgentType`), `input_summary` (text, nullable), `output_summary` (text, nullable), `quality_score` (int, 0–10), `issues` (text[]), `suggestions` (text[]), `overall_assessment` (text, nullable), `created_at`.

An index MUST exist on `(product_id, created_at)` to support the `/feedback-review` aggregation.

#### Scenario: Feedback scoped by product
- **WHEN** `FeedbackRepository.getRecentFeedback(productName, agentType?, limit)` is called
- **THEN** only feedback rows for that product are returned, ordered by `created_at` descending

### Requirement: Timestamps are managed by the database

Every table with `created_at` and `updated_at` columns SHALL use `DEFAULT now()` for inserts. `updated_at` MUST be maintained via MikroORM's `@Property({ onUpdate: () => new Date() })` hook (the canonical approach for this workspace). Application code MUST NOT set these fields manually.

#### Scenario: Updated_at advances on update
- **WHEN** a lead's `score` is updated via the repository
- **THEN** `updated_at` advances to the current timestamp without being set by the caller

### Requirement: Enum values match TypeScript unions

Postgres enum types for `lead_status`, `signal_type`, `signal_source`, `outreach_tone`, `agent_type`, `source_type`, `schedule_channel`, and `schedule_frequency` SHALL contain exactly the values declared in the corresponding TypeScript enums in `packages/db/src/enums/`. Adding a new value requires both a MikroORM migration and a type change in the same commit.

#### Scenario: Enum drift fails at runtime
- **WHEN** application code attempts to insert a value not present in the Postgres enum
- **THEN** Postgres rejects the insert with an invalid-input error

