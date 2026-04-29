## ADDED Requirements

### Requirement: Workspace-wide search endpoint

The API SHALL expose `GET /api/leads/search` accepting the following query parameters, all optional:

- `q` — string; if present, trigram-similarity match against `company`, `domain`, `contact_name`, `contact_email`.
- `status` — repeated `LeadStatus` enum values; multi-select union.
- `minScore`, `maxScore` — ints in `[0, 100]`. Out-of-range MUST 400.
- `signalTypes` — repeated `SignalType` enum values; matches when the lead's `signals` text[] contains any of the provided types.
- `productId` — UUID; restricts to a single product when present.
- `limit` — int 1..200, default 50.
- `cursor` — opaque base64 string from a prior response.

The response body MUST be:

```
{
  items: LeadSearchRow[],
  nextCursor: string | null,
  total: number
}
```

`LeadSearchRow` MUST include every field of the per-product Lead row plus `productId` and `productName`. `total` MUST count rows matching all filters (excluding cursor) and MUST NOT depend on the page size.

#### Scenario: q-only request returns ranked matches
- **WHEN** the request sets `q=acme` and no other filters
- **THEN** results include leads whose company, domain, contact_name, or contact_email match `acme` with similarity > 0.2, ranked by descending similarity then descending `score`

#### Scenario: Invalid cursor returns 400
- **WHEN** the request sets `cursor=not-a-real-cursor`
- **THEN** the server returns 400 with `{ message: "Invalid cursor" }` and no rows

#### Scenario: Multi-status filter is union
- **WHEN** the request sets `status=new&status=qualified`
- **THEN** results include leads whose status is `new` OR `qualified`

#### Scenario: Score range is inclusive
- **WHEN** the request sets `minScore=80`
- **THEN** every returned lead has `score >= 80`

### Requirement: Trigram threshold is tunable

The similarity cutoff used by `q` queries MUST be read from `process.env.LEAD_SEARCH_TRGM_THRESHOLD`, defaulting to `0.2` when the env var is absent or non-numeric. The threshold MUST be applied as `match_score > threshold` (strict) so a value of `0` means "include any non-zero similarity."

#### Scenario: Default threshold filters noise
- **WHEN** `LEAD_SEARCH_TRGM_THRESHOLD` is unset and the request sets `q=zz`
- **THEN** leads with no token sharing trigrams with `zz` are excluded (similarity 0 → match_score 0 → filtered)

### Requirement: Cursor pagination is keyset-based

The `cursor` parameter MUST be a base64-encoded JSON object of shape `{ score: number | null, updatedAt: string, id: string }`. The server MUST decode it and apply a strict less-than predicate on `(score NULLS LAST, updated_at, id)` to fetch the next page. Offset-based pagination MUST NOT be used.

When the result page is the final page, `nextCursor` MUST be `null`. When there are more rows, `nextCursor` MUST be the encoded triple of the last row in the current page.

#### Scenario: Last page signals end with null cursor
- **WHEN** a search returns fewer than `limit` rows
- **THEN** `nextCursor` is `null`

#### Scenario: Cursor stability across ties
- **WHEN** many leads share the same `score` and `updated_at`
- **THEN** the `id` UUID tiebreaker ensures each lead appears in exactly one page

### Requirement: Response includes parent product info

Every `LeadSearchRow` MUST embed `{ productId: string, productName: string }` so the client renders the product label inline without a second request. The join MUST be performed in a single SQL statement; the API MUST NOT issue per-row product lookups.

#### Scenario: Product label is inline
- **WHEN** a search returns 50 rows from 7 different products
- **THEN** each row carries its own productId/productName and the client renders them without further fetches

### Requirement: GIN trigram indexes on lead string columns

The `leads` table MUST have GIN trigram indexes on `company`, `domain`, `contact_name`, `contact_email` so workspace-scale searches stay sub-second. Indexes on nullable columns (`domain`, `contact_name`, `contact_email`) MUST be partial (`WHERE col IS NOT NULL`).

The migration that creates these indexes MUST run outside a transaction so `CREATE INDEX CONCURRENTLY` works on a populated table.

#### Scenario: Trigram index used for q queries
- **WHEN** an `EXPLAIN` is taken on the search query with a `q` parameter
- **THEN** the plan shows a Bitmap Index Scan on at least one of the four `gin_trgm_ops` indexes

### Requirement: Global Leads page

The web app SHALL expose a `/leads` route that renders `<LeadSearchPage>`. The page MUST be reachable from the sidebar (a link labeled "All leads" between Schedules and Settings) and from the command palette (`G L` shortcut, action label "Search all leads…").

The page MUST contain:
1. A search input with a 200 ms debounce; query mirrored to the URL via `useSearchParams`.
2. A filter row: status chip group (multi-select), score-bucket chip group (`hot / warm / cold`), signal-type chip menu, product chip menu (default `All products`).
3. A result list. When `items.length > 100`, the list MUST be virtualized.
4. Per-row `Open in product` link to `/products/:productId/leads?focus={leadId}`.
5. Empty states for pre-search, zero-results, and error.

The search input MUST take focus on page mount and on Cmd+K → "Search all leads…" activation.

#### Scenario: URL reflects current query
- **WHEN** the operator types `acme` and pauses
- **THEN** the URL becomes `/leads?q=acme` after debounce; back-button restores prior search

#### Scenario: Open in product preserves focus
- **WHEN** the operator clicks `Open in product` on a search result
- **THEN** the page navigates to `/products/:id/leads?focus={leadId}` and that page scrolls the row into view and opens the explain Sheet

### Requirement: Saved views

The page SHALL support saved views stored in `localStorage` keyed by workspace id. A saved view captures `{ name, query, status[], minScore, maxScore, signalTypes[], productId }`. On first mount of a fresh workspace, the page MUST seed a single default view named "All hot in last 7 days" with `minScore: 80` and an implicit "updated within 7 days" predicate.

A `<SavedViewsMenu>` MUST allow saving the current filter state as a new view, switching to a saved view, renaming, and deleting. The total number of saved views MUST be capped at 20.

Saved views MUST NOT be persisted server-side in v1.

#### Scenario: Default view on first run
- **WHEN** the operator opens `/leads` for the first time on a new workspace
- **THEN** the saved-views menu lists exactly one item, "All hot in last 7 days"

#### Scenario: Saved view round-trips reload
- **WHEN** the operator saves a view named "Fintech qualified", reloads the page, and reopens the menu
- **THEN** "Fintech qualified" appears and applying it restores the captured filters

#### Scenario: View cap enforced
- **WHEN** the operator attempts to save a 21st view
- **THEN** the action is rejected with an inline error and no `localStorage` write happens
