## MODIFIED Requirements

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
