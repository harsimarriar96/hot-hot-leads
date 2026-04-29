## Why

After the 4 foundational changes (turborepo, Postgres migration, onboarding, product-chats) landed, the platform was technically solid but had no **demo weight** — nothing that made a 2–10 minute investor session memorable, and several gaps that blocked daily-operator productivity. Per the design brief in [.impeccable.md](.impeccable.md), credibility comes from "watching agents actually run," and the trading-terminal feel requires operator-grade controls that didn't yet exist.

This change retroactively documents the 10 features shipped over 3 weeks to close that gap. The features were planned in the approved plan file at `~/.claude/plans/now-give-me-suggestions-tender-crescent.md` and implemented end-to-end; this proposal captures the spec-level requirements they introduced or modified.

## What Changes

### Demo-credibility additions
- **Live pipeline execution viz**: a 5-stage strip (`context → discovery → enrichment → outreach → feedback`) above the chat tab that advances in real time as the orchestrator's tool calls fire.
- **Demo seed**: an admin-token-guarded `POST /admin/demo-seed` endpoint that idempotently populates a rich scenario (1 product, 20 leads, 15 signals, 12 feedback entries, 2 schedules) so demos never start empty.
- **"Why this lead?" Sheet**: clicking a lead row opens a Sheet showing the agent's reasoning (`icpFitReason`, `signalSummary`), an ICP-fit checkmark breakdown vs the product's ICP, and matched signals.
- **Signal timeline**: chronological view (with iconography per signal type) that replaces the table as the default Signals presentation.
- **Feedback quality sparkline**: a 12-week SVG bar chart of `avgQualityByWeek` above the Feedback tab, fed by a new `GET /api/feedback/trend` aggregation.
- **Score-driven lead visuals**: `--score-hot / --score-warm / --score-cold` token pills replace plain numerics in lead lists.

### Operator-productivity additions
- **Schedules UI**: `/schedules` page lists all schedules with toggle (enable/disable) and "run now" actions; new `GET /api/schedules`, `PATCH /api/schedules/:id`, `POST /api/schedules/:id/run` endpoints.
- **Per-product agent customization**: 3 new columns on `products` (`agent_model_tier`, `agent_extra_instructions`, `icp_strictness`) consumed by `ChatService.handleWebMessage` to override the orchestrator's model and system context per product.
- **ICP / channel / source / prospect editors**: closes the v1 "display-only" gap. New `PUT /api/products/:id/icp`, plus `POST/PATCH/DELETE` for `/sales-channels`, `/sources`, `/predefined-prospects`. New `<ChipInput>` primitive backs the ICP multi-select.
- **Mobile polish**: products list and schedules rows stack vertically below `sm`; tap targets above 44px on touch.

## Capabilities

### New Capabilities
- `live-pipeline-visualization`: contract for the per-product stage strip and its event source.
- `demo-seed`: admin-only endpoint and seeded data shape for demo-ready empty deployments.
- `lead-explanation`: requirements for surfacing agent reasoning per lead.
- `signal-timeline`: chronological signal presentation contract.
- `feedback-trend`: weekly aggregation of agent quality scores and its API.
- `schedules-management`: web surface and API for managing recurring agent runs.
- `agent-customization`: per-product agent overrides (model tier, extra instructions, ICP strictness) and their flow into runtime.

### Modified Capabilities
- `gtm-data-model`: 3 new columns on `products` (`agent_model_tier`, `agent_extra_instructions`, `icp_strictness`).
- `product-management`: lead-row click opens a "Why this lead?" Sheet; ICP / channels / sources / predefined-prospects are now editable inline (closes the v1 read-only gap).
- `product-chat`: live pipeline-stage tracking via `AgentActivityContext`; per-product agent overrides flow through `ChatService.handleWebMessage`.

## Impact

- **DB migration**: one new migration adds the `agent_model_tier` enum + 3 columns on `products`. Backwards-compatible defaults (`'default'`, NULL, 60).
- **API endpoints**: 16 new routes total — see proposal body for breakdown.
- **Web routes**: `/schedules` added; existing `/products/:id` Overview, Leads, and Chat tabs gain new sections.
- **Bundle**: +~9kB gzip across all features (cmdk was already in; chip-input + sparkline + timeline + editors are first-party).
- **Out of scope** (deliberately, per user direction): CRM / email-send integrations, multi-operator / RBAC, custom user-defined agents, A/B outreach templates, RSS signal subscriptions, global lead search.

## Status

All 10 features were implemented, type-checked, built, and live-verified end-to-end against the demo seed on 2026-04-24. This is a retroactive proposal; tasks.md is fully checked.
