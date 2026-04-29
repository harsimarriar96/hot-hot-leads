## ADDED Requirements

### Requirement: Chronological signal presentation

The Signals tab SHALL render signals in a vertical timeline grouped by ISO date, newest-first, with each day group labeled by a relative-day string (`Today`, `Yesterday`, `N days ago`, or the absolute date once older than 7 days). Within each day, signals MUST sort newest-first by `created_at`.

The timeline view MUST be the default presentation. A toggle control above the list MUST allow switching between `Timeline` and `List` (the existing table). The selected view MUST persist across reloads via `localStorage`, scoped per product.

#### Scenario: Default view is timeline
- **WHEN** the user opens the Signals tab for the first time
- **THEN** the Timeline view is rendered

#### Scenario: View choice persists
- **WHEN** the user switches to `List` view, navigates away, and returns to the same product's Signals tab
- **THEN** the `List` view is restored

### Requirement: Per-type iconography and source links

Each timeline entry MUST display: a date marker (mono, tabular-nums), a signal-type icon, the company name, the signal description, and (when present) a clickable source URL. The icon MUST be selected from a single `TYPE_ICON` map covering all `signal_type` enum values, e.g. hiring → `Briefcase`, funding → `TrendingUp`, news → `Newspaper`, product launch → `Zap`. Icons MUST be tinted using the `--accent` token.

Source links MUST open in a new tab and carry `rel="noreferrer"`.

#### Scenario: Each signal type has an icon
- **WHEN** the Timeline renders signals across all `signal_type` enum values
- **THEN** every entry displays a distinct icon — no entry falls back to a generic placeholder

#### Scenario: Source URL is safe
- **WHEN** the user clicks a signal's source link
- **THEN** it opens in a new tab with `rel="noreferrer"` so the destination cannot read `window.opener`

### Requirement: Empty state guides next action

When the timeline has no signals, the empty state MUST inform the operator that the SignalMonitor agent populates this view automatically and offer a chat link to ask for a manual scan. The empty state MUST NOT instruct the user to "create a signal" — signals are produced by agents, not entered by hand.

#### Scenario: Empty timeline message
- **WHEN** a product has zero signals
- **THEN** the timeline displays "No signals yet — the SignalMonitor agent will write them here as they appear." with no `Add signal` button
