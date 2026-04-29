## 1. Database

- [ ] 1.1 Add a new MikroORM migration that creates 4 GIN trigram indexes on `leads` (`company`, `domain`, `contact_name`, `contact_email`) using `gin_trgm_ops`. The migration MUST run outside a transaction (use `disableTransactions = true` on the migration class) so `CREATE INDEX CONCURRENTLY` works.
- [ ] 1.2 Each index MUST be `IF NOT EXISTS` and the nullable-column indexes MUST be partial (`WHERE col IS NOT NULL`) to keep the index tight.
- [ ] 1.3 Apply the migration locally and verify with `\di+ leads` in psql.

## 2. Repository search method

- [ ] 2.1 Add `LeadsRepository.searchWorkspace(input)` accepting `{ q?, statuses?, minScore?, maxScore?, signalTypes?, productId?, limit, cursor? }`.
- [ ] 2.2 When `q` is present, build a SQL expression that selects `greatest(similarity(...), ...)` as `match_score`, filters `match_score > 0.2`, and orders by `match_score DESC, score DESC NULLS LAST, updated_at DESC, id DESC`.
- [ ] 2.3 When `q` is absent, order by `score DESC NULLS LAST, updated_at DESC, id DESC`.
- [ ] 2.4 Cursor: encode `(score, updated_at, id)` as base64-JSON; decode in repo and apply `WHERE (score, updated_at, id) < (?, ?, ?)` keyset.
- [ ] 2.5 Limit defaults to 50, capped at 200.
- [ ] 2.6 Each row MUST be returned with its parent `productId` and `productName` populated via a single JOIN on `products`.
- [ ] 2.7 The `total` count MUST be a separate cheap `COUNT(*)` over the same predicates without limit/cursor; the query plan should hit the trigram index for trigram queries and a covering index for filter-only queries.
- [ ] 2.8 Tunable similarity threshold: read `process.env.LEAD_SEARCH_TRGM_THRESHOLD ?? 0.2`.

## 3. API endpoint

- [ ] 3.1 Add `LeadsSearchController` with `@Get('api/leads/search')`. Body params accepted via query string; class-validator DTO with `@IsString`, `@IsArray`, `@IsInt`, `@Min`, `@Max` decorators.
- [ ] 3.2 Status query param: accept multiple `?status=new&status=qualified` parsed into a `LeadStatus[]`. Reject unknown values with 400.
- [ ] 3.3 Score range: `minScore` and `maxScore` accept 0–100 ints; out-of-range → 400.
- [ ] 3.4 Cursor errors (malformed base64) → 400 with `{ message: "Invalid cursor" }`; do not 500.
- [ ] 3.5 Response shape: `{ items: LeadSearchRow[], nextCursor: string | null, total: number }`.
- [ ] 3.6 `LeadSearchRow` mirrors the per-product Lead shape plus `productId` and `productName`.
- [ ] 3.7 Wire into `app.module.ts`.

## 4. Web `/leads` page

- [ ] 4.1 Add the route to `App.tsx` under the `<AppShell>` wrapper.
- [ ] 4.2 Build `<LeadSearchPage>` component:
  - 4.2.1 Search input (lucide `Search` icon prefix) bound to a 200 ms debounced state; query mirrors into the URL via `useSearchParams`.
  - 4.2.2 Filter row: status chip group, score-bucket chip group (`hot ≥80 / warm 60–79 / cold <60`), signal-type chip group, product chip menu.
  - 4.2.3 Result list rendered with `react-window` only when `items.length > 100`. Each row: score pill, company + domain, contact, status badge, signal-summary excerpt, `Open in product` chevron link.
  - 4.2.4 Empty states: pre-search ("Type to search across all leads…"), zero-results, error.
  - 4.2.5 Loading state: 6 `<SkeletonRow />`.
- [ ] 4.3 `Open in product` link target: `/products/:productId/leads?focus={leadId}`.
- [ ] 4.4 Saved views menu (`<SavedViewsMenu>`):
  - 4.4.1 Renders a button "Views ▾" next to the search input.
  - 4.4.2 Stores `{ name, query, status[], minScore, maxScore, signalTypes[], productId }` per workspace key in `localStorage`.
  - 4.4.3 Seeds "All hot in last 7 days" on first mount if `localStorage` is empty for this workspace.
  - 4.4.4 Save-current-view, rename, delete actions; max 20 views.
- [ ] 4.5 Sidebar entry "All leads" with a `Search` icon between Schedules and Settings.
- [ ] 4.6 Command palette: `Search all leads…` action (shortcut `G L`) that navigates to `/leads` and focuses the input.

## 5. Focused-row mode in product Leads tab

- [ ] 5.1 In `LeadsTab` read `useSearchParams().get('focus')`.
- [ ] 5.2 If `focus` is present and the corresponding lead is in the current page, scroll the row into view (`element.scrollIntoView({ block: 'nearest' })`) and open the explain Sheet for it.
- [ ] 5.3 If the lead is not in the loaded page, fetch a page that contains it (the existing `?leadId=` pivot or a one-time `findOne` request) before scrolling.
- [ ] 5.4 Removing the param (closing the Sheet) MUST clear `focus` from the URL via `setSearchParams({}, { replace: true })`.

## 6. Verification

- [ ] 6.1 Type-check + build are green: `npx turbo run typecheck build`.
- [ ] 6.2 Live: with the demo seed loaded, navigate to `/leads`, type "acme" — results include leads with `acme` in company, domain, or contact_email; ranking puts the closest matches first.
- [ ] 6.3 Filters: select status `qualified` + score bucket `hot` — only matching leads show.
- [ ] 6.4 `Open in product` link from `/leads` lands on `/products/:id/leads?focus={leadId}` with the row scrolled into view and the Sheet open.
- [ ] 6.5 Saved views: create a custom view, reload the page, verify it persists; delete the seeded "All hot in last 7 days" — page does not crash.
- [ ] 6.6 Pagination: with >50 leads, scroll to the bottom and verify the next page loads via cursor without re-fetching the first page.
- [ ] 6.7 Empty workspace: with zero leads, the page shows the pre-search empty state and `total: 0` from the API.

## 7. Documentation

- [ ] 7.1 Update `CLAUDE.md` with a brief "Global lead search" subsection under product chats describing the route, query schema, and trigram threshold env var.
- [ ] 7.2 Document `LEAD_SEARCH_TRGM_THRESHOLD` in the env-var list in `CLAUDE.md`.

## 8. Validation + archive

- [ ] 8.1 `npx openspec validate add-global-lead-search --strict` passes.
- [ ] 8.2 After implementation lands and verification step 6 passes, archive the change with `npx openspec archive add-global-lead-search`.
