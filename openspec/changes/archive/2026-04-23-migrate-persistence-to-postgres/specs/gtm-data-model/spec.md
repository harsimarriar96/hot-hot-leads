## ADDED Requirements

### Requirement: Product aggregate

A `Product` SHALL be the root of the GTM domain. Every product-scoped row (lead, outreach draft, signal, schedule, feedback entry, predefined prospect, ICP, sales channel, source) MUST reference `products.id` via a non-nullable foreign key. Deleting a product SHALL cascade to all of its owned rows.

The `products` table MUST have: `id` (uuid, pk), `name` (text, unique, not null), `slug` (text, unique, not null — url-safe), `general_info` (text, nullable), `sales_strategy` (text, nullable), `pricing` (text, nullable), `created_at` (timestamptz), `updated_at` (timestamptz).

#### Scenario: Product name is unique
- **WHEN** two inserts attempt to create products with the same `name`
- **THEN** the second insert fails with a unique-violation error

#### Scenario: Deleting a product cascades
- **WHEN** a product with associated leads and signals is deleted
- **THEN** its leads and signals are deleted in the same transaction

### Requirement: Product knowledge tables

Four tables SHALL store the per-product knowledge formerly held in Notion sub-pages:

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

An index MUST exist on `(product_id, detected_at DESC)` to support "recent signals for product" queries.

#### Scenario: Signal expiry is respected in queries
- **WHEN** a repository method `findActiveSignals(productId)` is called
- **THEN** it returns only signals where `expires_at IS NULL OR expires_at > now()`

### Requirement: Schedule entity

The `schedules` table SHALL have: `id` (uuid, pk), `product_id` (uuid, fk → products.id, nullable — schedules MAY be workspace-wide), `name` (text, not null), `cron_expression` (text, not null), `task_type` (text, not null — e.g., `generate-leads`, `check-signals`), `task_payload` (jsonb), `channel` (enum: telegram | whatsapp), `chat_id` (text, not null), `enabled` (boolean, default true), `last_run_at` (timestamptz, nullable), `created_at`, `updated_at`.

`SchedulerService` MUST load all `enabled = true` schedules on boot and register them with `@nestjs/schedule`. Registering a new schedule via chat MUST persist to this table and register the cron job live.

#### Scenario: Disabled schedules are not registered
- **WHEN** the API boots and the schedules table contains a row with `enabled = false`
- **THEN** no cron job is registered for that row

#### Scenario: Schedule persists across restarts
- **WHEN** a user creates a schedule via Telegram, then the API restarts
- **THEN** the schedule is re-registered from the database on boot with no user action

### Requirement: Feedback entry entity

The `feedback_entries` table SHALL have: `id` (uuid, pk), `product_id` (uuid, fk → products.id), `agent_type` (enum matching `AgentType`), `input_summary` (text), `output_summary` (text), `quality_score` (int, 0–10), `issues` (text[]), `suggestions` (text[]), `created_at`.

An index MUST exist on `(product_id, created_at DESC)` to support the `/feedback-review` aggregation.

#### Scenario: Feedback scoped by product
- **WHEN** `FeedbackRepository.getRecent(productId, limit)` is called
- **THEN** only feedback rows with that `product_id` are returned, ordered by `created_at` descending

### Requirement: Timestamps are managed by the database

Every table with `created_at` and `updated_at` columns SHALL use `DEFAULT now()` for inserts and a trigger (or ORM hook) to maintain `updated_at` on update. Application code MUST NOT set these fields manually.

#### Scenario: Updated_at advances on update
- **WHEN** a lead's `score` is updated
- **THEN** `updated_at` advances to the current timestamp without being set by the caller

### Requirement: Enum values match TypeScript unions

Postgres enum types for `lead_status`, `signal_type`, `signal_source`, `outreach_tone`, `agent_type`, `source_type`, and `channel` SHALL contain exactly the values declared in the corresponding TypeScript unions in `packages/types`. Adding a new value requires both a MikroORM migration and a type change in the same commit.

#### Scenario: Enum drift is a build failure
- **WHEN** a TypeScript union adds a value that the Postgres enum does not contain
- **THEN** the ORM rejects inserts of that value at runtime, and CI (when added later) is expected to detect the drift
