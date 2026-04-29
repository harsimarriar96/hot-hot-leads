# product-management

## Purpose

The first-class web surface for working with products: a list view with per-product stats, a detail page with three tabs (overview / leads / chat), in-place editing for product basics, and a typed-name confirm flow for destructive ops.
## Requirements
### Requirement: Products list surface

The web app SHALL expose a `/products` route that lists all products in the workspace with, for each product: name, a short description (first ~140 chars of `general_info`), total lead count, count of signals active within the last 30 days, and the timestamp of the most recent chat activity.

#### Scenario: Empty state shows CTA
- **WHEN** the workspace has zero products
- **THEN** the page renders a "Create product" button that opens the product-create form

#### Scenario: Stats reflect current state
- **WHEN** a lead is inserted for product X and the operator reloads `/products`
- **THEN** product X's lead count reflects the new row (the list fetches fresh counts on mount)

### Requirement: Product detail surface

Each product SHALL have a `/products/:productId` page with three tabs: `overview`, `leads`, `chat`. The most recently used tab MUST be persisted per product in `localStorage` and be the default on next visit.

#### Scenario: Invalid productId 404s
- **WHEN** a user navigates to `/products/00000000-0000-0000-0000-000000000000` and no such product exists
- **THEN** the page renders a not-found state with a link back to `/products`

#### Scenario: Tab selection persists
- **WHEN** a user selects the `leads` tab and returns to this product later
- **THEN** the `leads` tab is selected by default

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

### Requirement: Create product

The `/products` page SHALL have a "Create product" button that opens a modal-form (Radix Dialog) collecting name, general info, and the four ICP arrays. On success, the modal closes, the cache is invalidated, and the new product appears in the list.

#### Scenario: Duplicate name is rejected inline
- **WHEN** the submitted `name` collides with an existing product
- **THEN** the API returns 409 and the modal stays open with the error displayed

### Requirement: Delete product

The product detail page SHALL expose a "Delete product" action that opens a confirmation modal requiring the operator to type the product name to confirm. On confirm, deletion is deferred by 5 seconds; the operator is shown a toast with an "Undo" button. If `Undo` is clicked, the deletion is cancelled and the product reappears in the list. If the timer fires, the API call deletes the product and cascades to all owned rows.

#### Scenario: Confirmation requires name match
- **WHEN** the operator clicks delete and types a name that does not match
- **THEN** the confirm button stays disabled

#### Scenario: Undo cancels the cascade
- **WHEN** the operator confirms delete and clicks "Undo" within 5 seconds
- **THEN** no `DELETE /api/products/:id` request is made and the product remains intact in the database

#### Scenario: Delete cascades server-side
- **WHEN** deletion succeeds for a product that had leads, signals, drafts, schedules, feedback, and a chat thread
- **THEN** every row in those tables referencing the deleted `product_id` is gone

