## ADDED Requirements

### Requirement: Weekly feedback aggregation endpoint

The API SHALL expose `GET /api/feedback/trend?productId={uuid}&weeks={int}`. The default for `weeks` MUST be 12 with an enforced cap (e.g., 52). The response MUST be an array of objects sorted oldest-first:

```
[ { weekStart: "YYYY-MM-DD", avg: number, count: number }, ... ]
```

`avg` MUST be the mean of `quality_score` for feedback entries scoped to the product whose `created_at` falls in that ISO week (`date_trunc('week', created_at)` semantics). `count` MUST be the number of entries in that week. Weeks with zero entries MUST be omitted (not included as `count: 0`).

Requesting a product the operator does not own MUST return 404. Requesting an absent `productId` MUST return 400.

#### Scenario: Aggregation matches data
- **WHEN** a product has 5 entries in week W1 with scores `[6, 7, 8, 9, 10]` and 0 entries in week W2
- **THEN** the response includes `{ weekStart: W1, avg: 8, count: 5 }` and does not include W2

#### Scenario: Cap enforced
- **WHEN** the request sets `weeks=200`
- **THEN** the API clamps to its enforced cap (52) and returns at most 52 entries

### Requirement: Sparkline component above feedback table

The Feedback tab SHALL render a 160×42 SVG bar-chart sparkline immediately above the table. Each bar represents one week from the trend endpoint; bar height is proportional to `avg` (range 0–10). Bar color MUST be derived from the score bucket:
- `avg >= 8` → `--score-hot`
- `avg >= 6` → `--score-warm`
- `avg < 6` → `--score-cold`

When the trend endpoint returns an empty array, the component MUST render `null` (not an empty SVG, not a placeholder) so the table empty-state remains the only message.

The sparkline MUST be decorative for screen readers (`role="img"` with `aria-label="Feedback quality, last 12 weeks"`) — individual bars MUST NOT be focusable.

#### Scenario: No data hides the chart
- **WHEN** a product has zero feedback entries
- **THEN** the sparkline is absent from the DOM and the table empty-state alone explains the situation

#### Scenario: Bar color reflects bucket
- **WHEN** a week's `avg` is 8.5
- **THEN** the corresponding bar uses `var(--score-hot)`
