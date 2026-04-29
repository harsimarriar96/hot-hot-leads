# demo-seed Specification

## Purpose
TBD - created by archiving change add-demo-roadmap. Update Purpose after archive.
## Requirements
### Requirement: Admin-guarded demo seed endpoint

The API SHALL expose `POST /admin/demo-seed`, guarded by an `X-Admin-Token` header that MUST equal `APP_SECRET_KEY`. Requests without the header, or with a mismatched token, MUST return `403 Unauthorized`. The endpoint MUST NOT be exposed in any web navigation; it is invoked from the empty `/products` state and from operator scripts.

A successful response MUST be `200 OK` with a JSON body of shape `{ productId: string, counts: { leads, outreach_drafts, signals, feedback, schedules, channels, sources, prospects } }`.

#### Scenario: Missing token rejected
- **WHEN** a request to `POST /admin/demo-seed` arrives without the `X-Admin-Token` header
- **THEN** the server returns 403 and writes nothing

#### Scenario: Wrong token rejected
- **WHEN** the header is present but does not match `APP_SECRET_KEY`
- **THEN** the server returns 403 and writes nothing

### Requirement: Idempotent tear-down + re-insert

The seed operation SHALL be idempotent: invoking it any number of times MUST converge on the same end-state without producing duplicates. The implementation MUST locate any existing product with slug `acme-ai`, delete it (relying on FK cascades to remove all owned rows: leads, outreach drafts, signals, schedules, feedback entries, chat messages, ICP, sales channels, sources, predefined prospects), then re-insert the full scenario.

The seed MUST NOT touch any product whose slug is not `acme-ai`. Other products' leads/signals/feedback/schedules MUST be untouched across reseeds.

#### Scenario: Repeated seeds converge
- **WHEN** `POST /admin/demo-seed` is called twice in a row
- **THEN** both calls return 200, the database contains exactly one `acme-ai` product, and the per-table counts match the canonical seed shape

#### Scenario: Foreign products preserved
- **WHEN** a `acme-ai` product and a separately-created product `internal-tool` both exist, then `POST /admin/demo-seed` runs
- **THEN** `acme-ai` is rebuilt and `internal-tool` (and all its owned rows) is unchanged

### Requirement: Canonical seed shape

The seed MUST insert exactly one product with `slug = 'acme-ai'`, populated with: a complete ICP (target industries, company sizes, funding stages, geographies, notes), 3 sales channels, 4 sources (each with a valid URL), 3 predefined prospects, 20 leads spanning every value of the `lead_status` enum, 15 signals spanning every value of the `signal_type` enum, 12 weeks of feedback entries showing an upward quality trend, and 2 schedules (one enabled, one disabled).

Lead scores MUST be distributed across `hot` (≥80), `warm` (60–79), and `cold` (<60) buckets so the score-pill colors are visible without further user action.

#### Scenario: Counts match contract
- **WHEN** a fresh seed completes
- **THEN** the response `counts` object reads `{ leads: 20, outreach_drafts: 3, signals: 15, feedback: 12, schedules: 2, channels: 3, sources: 4, prospects: 3 }`

#### Scenario: Score buckets all represented
- **WHEN** the seeded leads are loaded into the Leads tab
- **THEN** the tab shows leads with hot, warm, and cold score pills present

### Requirement: Empty-state surface for "Load demo data"

The web `/products` empty state SHALL render a "Load demo data" action alongside the "Create product" CTA. Clicking it MUST prompt the operator for the admin token (a `window.prompt` is acceptable in v1) and POST it as `X-Admin-Token`. On success the products query MUST be invalidated and a toast displayed with the inserted counts. On failure a danger-toned toast MUST display the error message returned by the API.

#### Scenario: Successful seed updates the empty state
- **WHEN** the operator enters the correct token and the seed succeeds
- **THEN** the products list refreshes to show "Acme AI" and a success toast confirms `Loaded 20 leads, 15 signals`

#### Scenario: Failure preserves empty state
- **WHEN** the operator cancels the prompt or the API returns 403
- **THEN** the empty state is unchanged and (on 403) a danger toast displays the failure message

