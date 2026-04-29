# agent-customization Specification

## Purpose
TBD - created by archiving change add-demo-roadmap. Update Purpose after archive.
## Requirements
### Requirement: Per-product agent overrides

Each `Product` SHALL carry three operator-tunable fields that override agent behavior for runs scoped to that product:

- `agent_model_tier` — enum `fast | default | heavy`. Default: `default`.
- `agent_extra_instructions` — nullable text. Operator-written supplement to the orchestrator's system prompt.
- `icp_strictness` — integer in `[0, 100]`. Default: `60`. Hints how strictly the scoring agent should reject borderline-ICP leads.

These fields MUST be readable via `GET /api/products/:id` and writable via `PATCH /api/products/:id`. Writes MUST validate: the tier MUST be one of the enum values, and `icp_strictness` MUST be in `[0, 100]` (otherwise return 400).

#### Scenario: PATCH validates tier
- **WHEN** a PATCH sets `agentModelTier: "extreme"`
- **THEN** the API returns 400 and no fields are updated

#### Scenario: PATCH validates strictness range
- **WHEN** a PATCH sets `icpStrictness: 150`
- **THEN** the API returns 400 and no fields are updated

### Requirement: Model-tier resolution at chat time

`ChatService.handleWebMessage` SHALL resolve the product's `agent_model_tier` to a Claude model id at the start of each run:

- `fast` → `process.env.CLAUDE_MODEL_FAST`
- `heavy` → `process.env.CLAUDE_MODEL_HEAVY`
- `default` → undefined (falls through to `BaseAgent.defaultModel()`, which reads `CLAUDE_MODEL`)

The resolved model id MUST be passed to `OrchestratorAgent.runStream` as `options.model`. The orchestrator and every sub-agent MUST receive this override unchanged for the duration of the run.

#### Scenario: Heavy tier swaps the model
- **WHEN** a product has `agent_model_tier = 'heavy'` and `CLAUDE_MODEL_HEAVY=claude-opus-4-7`
- **THEN** the run's outbound Anthropic requests use `claude-opus-4-7`

#### Scenario: Default tier falls through
- **WHEN** a product has `agent_model_tier = 'default'`
- **THEN** the run uses whatever model `BaseAgent.defaultModel()` returns, identical to the pre-customization behavior

### Requirement: Extra instructions and ICP strictness flow into extraContext

`ChatService.handleWebMessage` SHALL build the orchestrator's `extraContext` string by concatenating, in order:

1. `Product: {name} | Source: web | ICP strictness: {icp_strictness}/100`
2. If `agent_extra_instructions` is non-empty: a separator (`\n\nProduct-specific instructions:\n`) followed by the verbatim instructions.

The orchestrator MUST receive this overlay alongside its canonical system prompt — the system prompt MUST NOT be replaced or mutated by per-product config.

#### Scenario: Extra instructions appear in system overlay
- **WHEN** a product's `agent_extra_instructions` is "Always cite signals by date." and a chat turn runs
- **THEN** the extraContext string passed to `runStream` includes the verbatim instructions after the base context line

#### Scenario: Strictness embedded in base context
- **WHEN** a product's `icp_strictness` is 85
- **THEN** the extraContext base line reads `... | ICP strictness: 85/100`

### Requirement: Channel-originated runs are unaffected

`ChatService.handleIncoming` (Telegram and WhatsApp entry) MUST NOT consult the per-product overrides in v1. Channel runs continue to use the default model and a minimal channel-tagged extraContext. This boundary keeps the customization surface scoped to the operator's web sessions and is explicit so future work can lift it.

#### Scenario: Channel run ignores overrides
- **WHEN** a Telegram message routes to a product with `agent_model_tier = 'heavy'`
- **THEN** the orchestrator runs with the default model and no extra-instructions overlay

### Requirement: Overview tab Agent section

The product Overview tab SHALL include an "Agent" section with three controls bound to the corresponding fields:

1. **Model tier** — segmented control with three options (Fast / Default / Heavy).
2. **Extra instructions** — multi-line textarea (operator-friendly placeholder; no maximum length enforced beyond Postgres `text`).
3. **ICP strictness** — slider 0–100 with the current value displayed numerically.

Each control MUST persist via the existing `PATCH /api/products/:id` endpoint. Changes MUST take effect on the very next chat turn — no restart, no per-turn flag.

#### Scenario: Slider edit takes effect on next turn
- **WHEN** the operator drags strictness from 60 to 85, saves, then sends a new chat message
- **THEN** the next run's extraContext line reads `... | ICP strictness: 85/100`

