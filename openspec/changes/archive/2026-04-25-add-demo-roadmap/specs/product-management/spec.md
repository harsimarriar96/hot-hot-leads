## MODIFIED Requirements

### Requirement: Leads tab

The Leads tab SHALL render leads for the product in a table with columns: Company, Contact, Status, Score. Status values MUST be rendered with their display label (e.g. `outreach_ready` → "Ready to outreach"). Score MUST be rendered as a colored pill using the `--score-hot / --score-warm / --score-cold` design tokens, bucketed by score (≥80 hot, 60–79 warm, 40–59 lukewarm, <40 cold).

Each row SHALL be a clickable trigger that opens the lead-explanation Sheet (see capability `lead-explanation`). The trigger MUST be keyboard-accessible — pressing `Enter` or `Space` on a focused row MUST behave identically to clicking it. Cursor styling MUST indicate the row is interactive.

#### Scenario: Empty state suggests chat action
- **WHEN** the product has zero leads
- **THEN** the tab renders an empty state suggesting "Open the Chat tab and ask the agent to generate leads"

#### Scenario: Row click opens explain Sheet
- **WHEN** the operator clicks a lead row
- **THEN** the lead-explanation Sheet opens with that lead's data and the parent product's current ICP

#### Scenario: Keyboard activation works
- **WHEN** a lead row has keyboard focus and the operator presses Enter
- **THEN** the Sheet opens identically to a mouse click

### Requirement: Overview tab editing

The Overview tab SHALL allow in-place editing of: `name`, `general_info`, `sales_strategy`, `pricing`, the `product_icp` block, and the `product_sales_channels`, `product_sources`, and `predefined_prospects` collections (add / edit / delete each row). Edits MUST persist via the same repositories used by onboarding.

The Overview tab MUST additionally render an **Agent** section (see capability `agent-customization`) with controls for `agent_model_tier`, `agent_extra_instructions`, and `icp_strictness`. The Agent section is part of the same edit surface — it uses the same `PATCH /api/products/:id` endpoint as the basics block.

The ICP block MUST be editable as a single atomic write: `PUT /api/products/:id/icp` replaces the four arrays (target industries, company sizes, funding stages, geographies) and the notes field in one transaction. Field-level PATCH on ICP is NOT exposed.

#### Scenario: Field edits write only the changed columns
- **WHEN** the operator edits `general_info` and saves
- **THEN** only `general_info` and `updated_at` are written; other fields are untouched

#### Scenario: Adding a sales channel persists
- **WHEN** the operator adds a new sales channel and saves
- **THEN** a new `product_sales_channels` row exists for that product with the entered values

#### Scenario: ICP save replaces the block atomically
- **WHEN** the operator removes one industry, adds two new geographies, and saves
- **THEN** a single `PUT /api/products/:id/icp` call carries the full new collection and the database reflects exactly the submitted arrays
