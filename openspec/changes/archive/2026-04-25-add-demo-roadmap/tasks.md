## 1. Live pipeline execution visualization

- [x] 1.1 Extend `AgentActivityContext` with a per-product `stages` map (`context | discovery | enrichment | outreach | feedback` → `'waiting' | 'running' | 'done'`)
- [x] 1.2 Map orchestrator tool names → stage keys via a single `STAGE_FOR_TOOL` constant in [use-agent-activity.tsx](apps/web/src/hooks/use-agent-activity.tsx)
- [x] 1.3 Forward-only state advancement: setting any stage to `running` flips earlier stages to `done`; never regress
- [x] 1.4 On `end()` for a product, flip any `running` stages to `done`
- [x] 1.5 Build [`<ProductPipelineStrip>`](apps/web/src/components/product-pipeline-strip.tsx) — a horizontal 5-step strip with `Check` icon for done, pulsing dot for running, dashed circle for waiting; uses `--pipeline-running / --pipeline-done / --pipeline-waiting` tokens
- [x] 1.6 Mount the strip above the Chat tab in `ProductDetailPage`; visible whenever the product has agent activity
- [x] 1.7 Verify: `useAgentActivity` mocks fire stage advancements with no orchestrator changes required

## 2. Demo seed

- [x] 2.1 Create [demo-seed.service.ts](apps/api/src/modules/admin/demo-seed.service.ts) with a single `seed()` method
- [x] 2.2 Idempotency: find any existing product with slug `acme-ai`, delete it (cascade via FK), then re-insert
- [x] 2.3 Seeded entities: 1 Product (`Acme AI`, slug `acme-ai`), 3 PredefinedProspects, 3 SalesChannels, 4 Sources, full ICP, 20 Leads (across all `lead_status` values), 15 Signals (across all `signal_type` values), 12 FeedbackEntries (trending up over weeks), 2 Schedules
- [x] 2.4 [`AdminController.demoSeed`](apps/api/src/modules/admin/admin.controller.ts) guarded by `X-Admin-Token: $APP_SECRET_KEY`; returns `{ counts: { leads, signals, feedbackEntries, schedules } }`
- [x] 2.5 Frontend: "Load demo data" button on the empty `/products` state; prompts for `APP_SECRET_KEY` and posts the header
- [x] 2.6 Verify: running twice in a row succeeds (idempotency); other products are not touched

## 3. "Why this lead?" Sheet

- [x] 3.1 Build [`<LeadExplainSheet>`](apps/web/src/components/lead-explain-sheet.tsx) — Radix Sheet anchored right; receives a Lead and the parent Product
- [x] 3.2 Sections: Header (company + score pill), ICP Fit checklist (industry/size/funding-stage/geography vs product ICP, ✓/✗ per axis), Signals (matched signals from `lead.signals`), Reasoning (`icpFitReason`, `signalSummary`), Contact (`contactEmail`, `domain`)
- [x] 3.3 Wire row click in [leads-tab.tsx](apps/web/src/pages/products/tabs/leads-tab.tsx) to open the Sheet
- [x] 3.4 Score pill colors via `--score-hot / --score-warm / --score-cold` tokens; `scoreTone(n)` helper in [display-labels.ts](apps/web/src/lib/display-labels.ts)
- [x] 3.5 Verify: Sheet opens for any lead, ICP fit reflects the product's ICP, missing fields show em-dash gracefully

## 4. Signal timeline

- [x] 4.1 Build [`<SignalsTimeline>`](apps/web/src/components/dashboard/signals-timeline.tsx) — vertical timeline grouped by ISO date with a relative-day label (Today / Yesterday / N days ago)
- [x] 4.2 Per signal type icon (`Briefcase`, `TrendingUp`, `Newspaper`, `Zap`, `MessageSquare`, etc.) tinted with `--accent`
- [x] 4.3 Source URL is a clickable link with `rel="noreferrer"` and `target="_blank"`
- [x] 4.4 Toggle on the Signals tab between `List` (existing table) and `Timeline` (default) views, persisted to `localStorage`
- [x] 4.5 Empty state: "No signals yet — the SignalMonitor agent will write them here as they appear."

## 5. Feedback quality sparkline

- [x] 5.1 Add `GET /api/feedback/trend?productId=X&weeks=12` returning `[{ weekStart: string, avg: number, count: number }]`
- [x] 5.2 Aggregation: `avg(quality_score)` and `count(*)` grouped by `date_trunc('week', created_at)` over the last 12 weeks
- [x] 5.3 Build [`<FeedbackSparkline>`](apps/web/src/components/dashboard/feedback-sparkline.tsx) — 160×42 SVG bar chart; bar color by bucket (≥8 hot, ≥6 warm, ≥4 cold) using the `--score-*` tokens
- [x] 5.4 Render above the Feedback table; the component returns `null` when there is no data
- [x] 5.5 Verify: with 0 feedback rows, sparkline absent; with 12 weeks of seeded data, sparkline renders

## 6. Schedules management

- [x] 6.1 `GET /api/schedules` lists all schedules (joined with product name)
- [x] 6.2 `PATCH /api/schedules/:id` accepts `{ enabled?: boolean }` and toggles the cron job in `SchedulerService` live (no restart required)
- [x] 6.3 `POST /api/schedules/:id/run` returns 202 and runs `SchedulerService.runOnce(schedule)` in a detached promise; chat sync writes results to the product chat
- [x] 6.4 Build [/schedules page](apps/web/src/pages/schedules-page.tsx): table with name · product · cron · last run · next run · enabled toggle · Run-now button (`Play` icon)
- [x] 6.5 Empty state: "No schedules yet — ask the chat to create a recurring task."
- [x] 6.6 Wire `/schedules` route + sidebar entry; surface in command palette
- [x] 6.7 Toast on Run-now: "Run queued · check chat for results"

## 7. Per-product agent customization

- [x] 7.1 Add `agent_model_tier` enum (`fast | default | heavy`) to Postgres
- [x] 7.2 Add 3 columns on `products`: `agent_model_tier` (default `'default'`), `agent_extra_instructions` (text, nullable), `icp_strictness` (int, default 60, check 0–100)
- [x] 7.3 Migration [Migration20260425013713.ts](packages/db/src/migrations/Migration20260425013713.ts) creates the enum + columns; rollback drops them
- [x] 7.4 Update [Product entity](packages/db/src/entities/product.entity.ts) with the new fields
- [x] 7.5 [ChatService.handleWebMessage](apps/api/src/modules/chat/chat.service.ts) reads the 3 fields, resolves model tier → env-driven Claude model id, appends extra instructions to `extraContext`, and embeds `ICP strictness: N/100` in the base context
- [x] 7.6 `resolveModelForTier` helper: `fast` → `CLAUDE_MODEL_FAST`, `heavy` → `CLAUDE_MODEL_HEAVY`, `default` → undefined (falls back to `BaseAgent.defaultModel()`)
- [x] 7.7 Add Agent section to Overview tab with: model-tier segment control (Fast / Default / Heavy), extra-instructions textarea, ICP strictness slider (0–100)
- [x] 7.8 Verify: switching model tier on a product visibly changes which Claude id is sent; extra instructions appear in the next chat turn's system overlay

## 8. Editable ICP / channels / sources / predefined prospects

- [x] 8.1 `PUT /api/products/:id/icp` replaces the entire ICP block atomically: `{ targetIndustries, companySizes, fundingStages, geographies, notes }`
- [x] 8.2 `POST/PATCH/DELETE /api/products/:id/sales-channels[/:channelId]`
- [x] 8.3 `POST/PATCH/DELETE /api/products/:id/sources[/:sourceId]`
- [x] 8.4 `POST/PATCH/DELETE /api/products/:id/predefined-prospects[/:prospectId]`
- [x] 8.5 Build [`<ChipInput>`](apps/web/src/components/ui/chip-input.tsx) — Enter or comma to commit a chip, Backspace removes the last chip when input is empty
- [x] 8.6 Add ICP editor section to Overview tab: 4 ChipInputs + textarea for notes; one Save button per editor
- [x] 8.7 Add reusable `<ChildEditorSection>` for sales-channels / sources / predefined-prospects with add/edit/delete inline
- [x] 8.8 Verify: editing ICP updates immediately on save; child editors reflect adds/edits/deletes without a full reload

## 9. Score-driven lead visuals

- [x] 9.1 Add `scoreTone(n)` helper returning `'hot' | 'warm' | 'cold'` based on score buckets (≥80 hot, 60–79 warm, <60 cold)
- [x] 9.2 Apply `--score-hot/warm/cold` tokens to score pills in [leads-tab.tsx](apps/web/src/pages/products/tabs/leads-tab.tsx) and [leads-table.tsx](apps/web/src/components/dashboard/leads-table.tsx)
- [x] 9.3 Tabular-nums + mono font for score numerics

## 10. Mobile polish

- [x] 10.1 Products list rows: `flex-col sm:flex-row` so stats stack below `sm`
- [x] 10.2 Schedules table: stacked card layout on `<sm`, table layout on `sm+`
- [x] 10.3 Touch targets ≥ 44×44 on coarse pointers via `[@media(pointer:coarse)]:min-h-11` on the `Button` primitive (already in place; verified)
- [x] 10.4 Chat tab: sticky send button above the on-screen keyboard; auto-scroll locked to bottom; tool-use disclosures collapsed by default on mobile
- [x] 10.5 Verify at 375×667 viewport that nothing horizontal-scrolls and all primary actions are reachable with a thumb

## 11. Validation and archival

- [x] 11.1 `npx turbo run typecheck build` is green
- [x] 11.2 Live verification: empty deploy → demo seed → Cmd+K → Acme AI → Chat → "generate 5 hot leads in fintech" → pipeline strip lights up live → leads tab shows score-tinted pills → click row → Sheet renders → Signals tab in Timeline view → Feedback tab shows sparkline → /schedules toggles work
- [x] 11.3 No new external dependencies; bundle gz under 10 kB increase budget
- [x] 11.4 `openspec validate add-demo-roadmap --strict` passes
- [x] 11.5 Archive change: copy specs/ deltas to `openspec/specs/`, move the change to `openspec/changes/archive/2026-04-25-add-demo-roadmap/`
