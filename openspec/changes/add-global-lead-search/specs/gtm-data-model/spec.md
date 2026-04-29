## MODIFIED Requirements

### Requirement: Lead entity

The `leads` table SHALL have: `id` (uuid, pk), `product_id` (uuid, fk → products.id), `company` (text, not null), `domain` (text), `industry`, `company_size`, `funding_stage`, `location`, `tech_stack` (text[]), `contact_name`, `contact_title`, `contact_email`, `linkedin_url`, `score` (int, 0–100, nullable), `buying_intent` (int, 0–100, nullable), `icp_fit_reason` (text), `signal_summary` (text), `status` (enum matching `LeadStatus`), `signals` (text[]), `enrichment_data` (jsonb), `created_at`, `updated_at`.

A unique constraint MUST exist on `(product_id, domain)` when `domain IS NOT NULL` to prevent duplicate companies per product.

The table MUST additionally carry GIN trigram indexes (`gin_trgm_ops`) on `company`, `domain`, `contact_name`, `contact_email` to support workspace-wide fuzzy search. Indexes on nullable columns MUST be partial (`WHERE col IS NOT NULL`). The migration creating these indexes MUST run outside a transaction so `CREATE INDEX CONCURRENTLY` works on a populated table.

#### Scenario: Duplicate lead by domain per product is rejected
- **WHEN** two leads for the same `product_id` are inserted with the same non-null `domain`
- **THEN** the second insert fails

#### Scenario: Lead without domain is allowed
- **WHEN** two leads are inserted for the same product with the same `company` but `domain IS NULL` on both
- **THEN** both inserts succeed (the unique constraint is partial)

#### Scenario: Lead status defaults to 'new'
- **WHEN** a lead is inserted without specifying `status`
- **THEN** the database default sets `status = 'new'`

#### Scenario: Trigram index used for fuzzy search
- **WHEN** the global lead-search query runs `EXPLAIN` with a trigram-similarity predicate on `company`
- **THEN** the plan shows a Bitmap Index Scan on `idx_leads_company_trgm`
