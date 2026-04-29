## Context

The `leads` table already carries every column we need for a useful global view: `product_id`, `score`, `status`, `signals` (text[]), `signal_summary`, `updated_at`, plus the contact and firmographic fields. The `pg_trgm` extension was enabled in the very first migration, so trigram-similarity search is available without infra changes.

What's missing is a surface that aggregates across products and a query path that ranks results sensibly when the operator types a partial company name.

## Goals / Non-Goals

**Goals:**
- Sub-200 ms server-side response for `q`-prefixed searches across workspaces with up to ~50 k leads.
- One screen, one keyboard interaction (`/leads → focus input → type`) to find any lead the workspace knows about.
- Reuse the existing score-pill / status-badge / explain-Sheet primitives so the cross-product list looks identical to the per-product list.
- Saved views as a 90% solution to "I run the same triage every morning."

**Non-Goals:**
- Bulk write actions (delete, re-score, assign) — too many of those imply RBAC, which is explicitly out of scope.
- Search inside `enrichment_data` JSON or outreach `body` — opens up a much bigger relevance/ranking surface.
- A unified "everything search" (signals + leads + outreach in one box) — bigger UX project; defer.
- Server-side pagination beyond cursor-based: no offset, no count-everything.

## Decisions

### 1. Trigram + GIN, not Postgres FTS

`pg_trgm` is already enabled and the corpus is short strings (company names, domains, contact names) — exactly what trigrams are good at. Postgres FTS (tsvector / GIN) would require schema changes (a generated column or trigger) and the linguistic tokenization buys us nothing on company-name lookups. Trigram similarity also handles typos gracefully ("acme.io" matches "acmne.io").

**Alternatives:** Postgres FTS (rejected — overkill for short fields). External search (Meilisearch, Typesense — rejected, adds a service we don't need).

### 2. Ranking is a single SQL expression

When `q` is present, ranking uses `greatest(similarity(company, q), similarity(domain, q), similarity(contact_name, q), similarity(contact_email, q))` and orders DESC on the resulting score. Below a 0.2 threshold the row is excluded. When `q` is empty, the search becomes a filtered list ordered by `(score DESC, updated_at DESC)`.

**Why a single SQL expression:** keeps ranking logic on the database (where it can use the index), avoids hydration of all rows into memory.

### 3. Cursor pagination, not offset

`OFFSET 5000` is a foot-gun. The cursor encodes `(score, updated_at, id)` as a base64 JSON blob; the server decodes and applies `WHERE (score, updated_at, id) < (?, ?, ?)`. The `id` UUID tiebreaker guarantees stable ordering even when many rows share a score.

### 4. Saved views in localStorage, not the DB

Saved views are operator-personal. Storing them server-side requires a per-operator table and (eventually) sync — which lands us in RBAC territory. Local-first means saved views live on the device that created them. A future proposal can promote them to the DB when multi-operator becomes a real requirement.

The default seeded view is "All hot in last 7 days" — `score >= 80 AND updated_at >= now() - 7d`, which is the most common morning-triage filter.

### 5. Focused-row mode reuses the existing Leads tab

Rather than build a "view a single lead" page, the `Open in product` link goes to `/products/:id/leads?focus={leadId}`. The Leads tab reads `focus` from the query string, scrolls the matching row into view (or fetches a page that contains it if it's not in the first page), and opens the existing `LeadExplainSheet` for it. This keeps a single source of truth for "lead details" — no duplicate UI — and means the cross-product flow naturally hands off to the product context.

### 6. No new tooltip / chip primitives

Filter chips reuse the `Badge` variants and the `useCommandPalette` keyboard system. Status pill multi-select reuses the score-pill toggling pattern from the per-product Leads tab. The only new component is `<LeadSearchPage>` itself plus a tiny `<SavedViewsMenu>` which is a Dialog under the hood.

## Risks / Trade-offs

- **Trigram threshold of 0.2 may be too lenient on long names** → Mitigation: make it tunable via `LEAD_SEARCH_TRGM_THRESHOLD` env var; default 0.2 stays.
- **GIN index size on a large workspace** → A workspace with 50 k leads at ~80 bytes of indexable text per row is ~4 MB per index × 4 indexes = ~16 MB. Acceptable.
- **`CONCURRENTLY` index creation can't run inside a transaction** → The migration uses `await this.execute('...')` on a separate connection (MikroORM `addSql` runs in a transaction by default). Documented in tasks; the migration explicitly opts out of transactional execution.
- **Saved views in localStorage are per-device** → Operators who switch machines lose their views. Acceptable in v1; a future change can migrate them to a `saved_views` table when multi-operator lands.
- **`focus={leadId}` parameter could leak via shared URL** → Workspace is single-tenant; sharing a URL between operators is a non-issue today.

## Migration Plan

The new migration adds 4 GIN indexes:
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_company_trgm
  ON leads USING GIN (company gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_domain_trgm
  ON leads USING GIN (domain gin_trgm_ops) WHERE domain IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_contact_name_trgm
  ON leads USING GIN (contact_name gin_trgm_ops) WHERE contact_name IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_contact_email_trgm
  ON leads USING GIN (contact_email gin_trgm_ops) WHERE contact_email IS NOT NULL;
```

`pg_trgm` is already installed by `Migration20260422223031.up()` so no extension creation is needed.

**Rollback**: `DROP INDEX IF EXISTS …` for each. No data migration in either direction.

## Open Questions

- Should "Saved views" support keyboard shortcuts (1–9 to swap)? **Proposed:** add Cmd+1..9 if v1 sees real adoption; not in this change.
- Should the search endpoint accept multiple `q` tokens (e.g. `q=acme fintech`)? **Proposed:** v1 is single-token similarity; if operators ask, split on whitespace and AND the predicates.
