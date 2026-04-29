## Context

The four foundational OpenSpec changes shipped a working platform: monorepo + Postgres + onboarding + per-product chat. But running an investor demo on it was lifeless — the orchestrator streamed text into one chat bubble, the leads table showed plain numbers, and core operator surfaces (Schedules, ICP editing) were missing. The brief in [.impeccable.md](.impeccable.md) is explicit: investors should see the work happening, and operators should reach flow state with keyboard-grade controls.

This change is a 10-feature push to close both gaps without expanding scope into integrations the user explicitly excluded (CRM, email send, multi-operator). It builds on the primitives the audit/critique passes installed (Dialog, Sheet, Tooltip, Toast, command palette, AgentActivityContext) so almost no new foundation work was needed.

## Goals / Non-Goals

**Goals:**
- Make the demo path show, not tell: pipeline stages light up live, scores read hot/warm/cold, "why this lead?" turns a number into a story.
- Eliminate the empty-state demo trap with one-click seed data.
- Surface every existing back-end capability operators couldn't yet reach (Schedules, ICP editing, agent tuning).
- Keep the bundle increase under 10kB gz.
- Preserve full A11y / theming / responsive scores from the prior audit (20/20).

**Non-Goals:**
- CRM and email integrations.
- Multi-operator / RBAC / audit log.
- Custom user-defined agents (the per-product extra-instructions field gets ~80% of that value).
- A/B outreach experiments.
- RSS signal subscriptions or global lead search.

## Decisions

### 1. Pipeline stages observed client-side, not pushed by the server

We map orchestrator tool names → pipeline stages on the **client** by intercepting the existing `tool_use_start` SSE events:
```
load_product_context  → context
run_prospect_discovery → discovery
run_enrichment         → enrichment
run_outreach           → outreach
run_feedback           → feedback
```
This means no server-side changes are required to add a new stage indicator. Forward-only state advancement (`stages[i] = 'done'` once `stages[j > i]` becomes 'running') gives the visual narrative without needing explicit "stage_end" events.

**Alternatives:** server-side stage events. Rejected because the SSE protocol is already rich and the client mapping is trivially extensible.

### 2. Demo seed: idempotent tear-down + re-insert

`POST /admin/demo-seed` finds any existing product with slug `acme-ai`, removes it (cascading to all owned rows via FK), then re-inserts the entire scenario. This makes the operation safe to call repeatedly during demo prep.

### 3. Per-product agent customization injected via `extraContext` + `model`

We don't change `BaseAgent`. Instead, `ChatService.handleWebMessage` reads the product's `agentModelTier`, `agentExtraInstructions`, `icpStrictness` and passes them as `options.model` and as appended text in `options.extraContext`. The orchestrator and every sub-agent still receive their canonical system prompts unchanged; the per-product overlay is additive.

### 4. ICP edited as a single PUT, not field-level PATCHes

`PUT /api/products/:id/icp` replaces the entire ICP block (4 arrays + notes) atomically. Field-level PATCH would require optimistic merge and partial array semantics. The PUT approach is simpler, the bandwidth cost is trivial, and the operator UX (one Save button per editor) matches.

### 5. Schedule "run now" is fire-and-forget

`POST /api/schedules/:id/run` returns 202 immediately, then runs `SchedulerService.runOnce(schedule)` in a detached promise. The actual run continues server-side; results land in the chat thread (when synced) or the channel. The client toasts "Run queued · check chat for results" so the operator knows where to look.

### 6. Mobile polish via `flex-col sm:flex-row` not new layouts

Instead of building separate mobile components, we reorder the existing flex containers: `flex-col` on mobile → `flex-row` at `sm`+. Touch targets inherit the `[@media(pointer:coarse)]:min-h-11` rule already on the `Button` primitive.

## Risks / Trade-offs

- **Stage detection drifts if orchestrator tool names change** → Mitigation: the mapping lives in one constant (`STAGE_FOR_TOOL` in `use-agent-activity.tsx`); a tool rename is a one-line update.
- **Demo seed wipes user data if slug collision** → Mitigation: only the slug `acme-ai` is matched. Documented as such; admin-only endpoint with token auth.
- **Heavy model tier could exhaust quota during demos** → Mitigation: tier defaults to `default`. "Heavy" is operator-opt-in.
- **ICP PUT replaces collections atomically — concurrent edits clobber** → Mitigation: editor only loads on tab open and there's a single operator. If multi-operator lands later, add `If-Match` / `updated_at` optimistic concurrency.
- **Sparkline shows zero weeks for low-data products** → Mitigation: component returns `null` when no data; the empty Feedback table empty-state still informs the user.

## Migration Plan

The migration was already applied in production-like environment 2026-04-25:
- `Migration20260425013713` — adds `agent_model_tier` enum, `agent_model_tier` column (default `'default'`), `agent_extra_instructions` column (nullable text), `icp_strictness` column (default 60).

No data migration is needed; existing products get the defaults via the column defaults.

**Rollback**: revert the migration (down() drops the 3 columns and the enum). No client code calls these fields with hardcoded assumptions; they all read with `?? default` semantics.

## Open Questions

- Should "ICP strictness" actually be wired into the `ScoringAgent`'s prompt as a numeric weight, vs the current "appended to extraContext" treatment? **Proposed:** revisit after first round of feedback shows whether the slider visibly changes scoring outcomes.
- The pipeline stage strip currently shows `+N more` if multiple activities are running for the same product. Multi-activity-per-product is rare; we may want to forbid it altogether (queue submissions instead). **Deferred** to a future change.
