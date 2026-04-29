## Why

Leads today live inside a product. Every operator action that needs to compare or sweep across the whole pipeline forces a tab dance: open product A's Leads tab, scan, switch product, scan again. As soon as the workspace has ≥3 products this becomes the friction point in daily operation and is the most-asked operator capability that wasn't covered by the demo-roadmap (CRM and RBAC were explicitly excluded).

This change adds a single cross-product leads surface: a `/leads` route with type-ahead search, filter chips, saved views, and a one-click jump to the originating product. It uses the `pg_trgm` extension already installed in `Migration20260422223031` for fuzzy matching, so no new infrastructure.

## What Changes

### API
- `GET /api/leads/search?q={text}&status={status[]}&minScore={int}&maxScore={int}&signalTypes={type[]}&productId={uuid}&limit={int}&cursor={opaque}` — workspace-scoped lead search returning the matching leads with their parent product summary embedded.
- Trigram-similarity ranking on `company`, `domain`, `contact_name`, `contact_email` when `q` is present. Pure-filter requests (no `q`) use index-friendly equality + range filters and order by `score DESC, updated_at DESC`.
- Cursor-based pagination using `(score, updated_at, id)` keyset to keep deep scrolls cheap.
- Response: `{ items: LeadSearchRow[], nextCursor: string | null, total: number }` where `LeadSearchRow` carries the lead + `{ productId, productName }`.

### Web
- New `/leads` route at the workspace level — sidebar entry below Schedules.
- Top input: type-ahead with 200 ms debounce; submitting writes the query into the URL so browser back/forward roundtrips. Clear button inside the input.
- Filter row: status pill group (multi-select), score bucket pill group (`hot / warm / cold`), signal-type chip menu, product chip menu (defaults to "All products").
- Result list: virtualized when `items.length > 100`. Each row shows score pill, company + domain, contact, status badge, signal-summary excerpt, and a `Open in product` chevron link to `/products/:productId/leads?focus=:leadId`.
- Saved views: a small dropdown ("Views ▾") that lists named filter snapshots stored in `localStorage` keyed per workspace. Default "All hot in last 7 days" view is seeded.
- Cmd+K palette: a "Search all leads…" entry that focuses the `/leads` input on activation.

### DB
- Add a trigram GIN index on `leads(company)`, `leads(domain)`, `leads(contact_name)`, `leads(contact_email)` to keep `ILIKE`/`%` queries fast across the whole workspace.

## Capabilities

### New Capabilities
- `global-lead-search`: search endpoint contract, ranking rules, cursor pagination, and `/leads` page behavior including saved views.

### Modified Capabilities
- `product-management`: a focused-row mode for the per-product Leads tab (`?focus={leadId}`) that scrolls the matching row into view and opens the explain Sheet automatically. This is the link target for `Open in product`.
- `gtm-data-model`: documents the new GIN trigram indexes on `leads`.

## Impact

- **DB migration**: one new migration creates four `gin_trgm_ops` indexes on `leads`. Online with `CONCURRENTLY` on Postgres ≥ 12; the migration MUST run outside a transaction.
- **API**: 1 new route. No changes to existing routes.
- **Web routes**: `/leads` added; `/products/:id/leads?focus={leadId}` parameter contract added.
- **Bundle**: +~3 kB gzip (one new page + a small filter-chip group reusing existing primitives).
- **Out of scope**: full-text search across enrichment / outreach bodies; export-to-CSV; bulk actions (delete / re-score / assign); multi-workspace search.

## Status

Proposed. No implementation work has started.
