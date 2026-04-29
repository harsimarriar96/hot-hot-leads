# feedback-trend Specification

## Purpose
TBD - created by archiving change add-demo-roadmap. Update Purpose after archive.
## Requirements
### Requirement: Weekly feedback aggregation endpoint

The API SHALL expose `GET /api/feedback/trend?product={name}&weeks={int}`. `weeks` MUST be clamped into the inclusive range `[2, 52]`; the default when omitted is `8`. The response MUST be an array of objects sorted oldest-first:

```
[ { week: "YYYY-Www", avg: number, count: number }, ... ]
```

`week` is the ISO-8601 year+week key for the bucket (e.g. `"2026-W17"`), computed with Monday as week start. `avg` MUST be the mean of `quality_score` for feedback entries scoped to the product whose `created_at` falls in that ISO week. `count` MUST be the number of entries in that week. Weeks with zero entries MUST be omitted from the response.

When the `product` query param is missing, the API MUST return `{ error: 'product query param required' }`. When the product cannot be found, the API MUST return an empty array `[]` (not 404) so the client renders the no-data empty state without an error toast.

#### Scenario: Aggregation matches data
- **WHEN** a product has 5 entries in week W1 with scores `[6, 7, 8, 9, 10]` and 0 entries in week W2
- **THEN** the response includes `{ week: W1, avg: 8, count: 5 }` and does not include W2

#### Scenario: Range clamped
- **WHEN** the request sets `weeks=200`
- **THEN** the API clamps to 52 and returns at most 52 weekly buckets

#### Scenario: Unknown product returns empty
- **WHEN** the request specifies a `product` name that does not exist
- **THEN** the API returns `[]` and the sparkline component renders nothing

### Requirement: Sparkline component above feedback table

The Feedback tab SHALL render a 160×42 SVG bar-chart sparkline immediately above the table. Each bar represents one week from the trend endpoint; bar height is proportional to `avg` (range 0–10). Bar color MUST be derived from the score bucket:
- `avg >= 8` → `--score-hot`
- `avg >= 6` → `--score-warm`
- `avg < 6` → `--score-cold`

When the trend endpoint returns an empty array, the component MUST render `null` (not an empty SVG, not a placeholder) so the table empty-state remains the only message.

The sparkline MUST carry `role="img"` with `aria-label="Feedback quality sparkline"`; individual bars MUST NOT be focusable. The component SHALL request `weeks=12` from the API explicitly so the displayed series is independent of the server default.

#### Scenario: No data hides the chart
- **WHEN** a product has zero feedback entries
- **THEN** the sparkline is absent from the DOM and the table empty-state alone explains the situation

#### Scenario: Bar color reflects bucket
- **WHEN** a week's `avg` is 8.5
- **THEN** the corresponding bar uses `var(--score-hot)`

