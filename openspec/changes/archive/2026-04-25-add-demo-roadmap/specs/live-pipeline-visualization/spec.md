## ADDED Requirements

### Requirement: Per-product pipeline stage strip

The product detail page SHALL render a 5-step pipeline strip above the Chat tab whenever the product has any agent activity in flight or recently completed in the current session. The strip MUST display the canonical stages in order — `context → discovery → enrichment → outreach → feedback` — and reflect each stage as one of three states: `waiting`, `running`, or `done`.

The strip MUST update in real time as the orchestrator's tool calls fire: a stage flips to `running` when its first tool fires; advancement to a later stage's `running` state MUST flip every earlier stage to `done` (forward-only). When the run ends, any remaining `running` stages MUST flip to `done`.

`waiting` stages MUST render as a dashed circle, `running` as a pulsing dot, `done` as a check icon. Colors MUST come from `--pipeline-waiting`, `--pipeline-running`, `--pipeline-done` tokens — no hardcoded hex values.

#### Scenario: Stages light up in order during a run
- **WHEN** the user posts "generate 5 leads in fintech" and the orchestrator fires `load_product_context`, then `run_prospect_discovery`, then `run_enrichment`
- **THEN** the strip first marks `context` running, then flips it to done while `discovery` becomes running, then flips both `context` and `discovery` to done while `enrichment` becomes running

#### Scenario: Run completes with trailing waiting stages
- **WHEN** a run only fires `load_product_context` and `run_prospect_discovery` and then completes
- **THEN** `context` and `discovery` are marked `done`; `enrichment`, `outreach`, and `feedback` remain `waiting`

### Requirement: Client-side stage detection from existing SSE events

Stage transitions SHALL be derived on the client by intercepting existing `tool_use_start` SSE events and mapping the tool name to a stage key via a single constant. The server MUST NOT emit a separate "stage" event family.

The mapping MUST live in one location (`STAGE_FOR_TOOL` in `apps/web/src/hooks/use-agent-activity.tsx`) and cover at minimum:
- `load_product_context` → `context`
- `run_prospect_discovery` → `discovery`
- `run_enrichment` → `enrichment`
- `run_outreach` → `outreach`
- `run_feedback` → `feedback`

Adding a new orchestrator tool that maps to a stage MUST be a one-line change to this constant.

#### Scenario: Adding a new mapped tool requires no server change
- **WHEN** an engineer adds a new entry to `STAGE_FOR_TOOL` mapping a future tool name to an existing stage
- **THEN** no orchestrator code or SSE schema changes are required for the strip to begin advancing on that tool

#### Scenario: Unmapped tools are ignored
- **WHEN** the orchestrator fires a tool not present in `STAGE_FOR_TOOL` (e.g., `update_lead`)
- **THEN** the strip state is unchanged

### Requirement: Activity is scoped per product

`AgentActivityContext` SHALL track stage state keyed by `productId`. Multiple products being run in parallel MUST NOT collide. The strip on a given product page MUST read only its own product's stage map.

#### Scenario: Two products in parallel do not interfere
- **WHEN** Product A is mid-run on `enrichment` and Product B starts a new run that fires `load_product_context`
- **THEN** Product A's strip remains on `enrichment`, and Product B's strip shows `context` running with later stages waiting
