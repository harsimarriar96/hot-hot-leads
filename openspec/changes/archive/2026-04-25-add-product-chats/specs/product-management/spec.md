## ADDED Requirements

### Requirement: Products list surface

The web app SHALL expose a `/products` route that lists all products in the workspace with, for each product: name, a short description (first ~140 chars of `general_info`), total lead count, count of signals active within the last 30 days, and the timestamp of the most recent chat activity. The list MUST render within 200ms after data arrives (no blocking computation in render).

#### Scenario: Empty state shows CTA
- **WHEN** the workspace has zero products
- **THEN** the page renders a "Create your first product" button that opens the product-create form

#### Scenario: Stats are fresh within the current request
- **WHEN** a lead is inserted for product X and the operator reloads `/products`
- **THEN** product X's lead count reflects the new row (the list fetches fresh counts on mount)

### Requirement: Product detail surface

Each product SHALL have a `/products/:productId` page with three tabs: `overview`, `leads`, `chat`. The default tab MUST be `overview` on first visit and the most recently used tab on subsequent visits (persisted per product in `localStorage`).

#### Scenario: Invalid productId 404s
- **WHEN** a user navigates to `/products/00000000-0000-0000-0000-000000000000` and no such product exists
- **THEN** the page renders a not-found state with a link back to `/products`

#### Scenario: Tab selection persists
- **WHEN** a user selects the `leads` tab and returns to this product later
- **THEN** the `leads` tab is selected by default

### Requirement: Overview tab editing

The Overview tab SHALL display and allow in-place editing of: `name`, `general_info`, `sales_strategy`, `pricing`, `product_icp` (all fields), `product_sales_channels` (add/remove/edit), `product_sources` (add/remove/edit), `predefined_prospects` (add/remove/edit). Edits MUST persist via the same repositories used by onboarding and the Settings surface.

Field-level edits MUST use optimistic updates with rollback on server error. Bulk edits (e.g., reordering) MUST NOT be in scope for this change.

#### Scenario: Edit is atomic per field
- **WHEN** the operator edits `general_info` and saves
- **THEN** only `general_info` and `updated_at` are written; other fields are untouched

#### Scenario: Server error rolls back optimistic update
- **WHEN** an edit returns a 500 from the API
- **THEN** the field reverts to its previous value and an inline error appears

#### Scenario: Adding a sales channel persists
- **WHEN** the operator adds a new sales channel and saves
- **THEN** a new `product_sales_channels` row exists for that product with the entered values

### Requirement: Leads tab

The Leads tab SHALL render leads for the product in a table with columns: Company, Contact, Status, Score, Last Updated. It MUST support filtering by `status` and sorting by `score` or `updated_at`.

#### Scenario: Filter by status
- **WHEN** the operator selects status `outreach_ready`
- **THEN** only leads with that status are shown

#### Scenario: No leads yet
- **WHEN** the product has zero leads
- **THEN** the tab renders an empty state suggesting "Open the Chat tab and ask to generate leads"

### Requirement: Create product

The `/products` page SHALL have a "Create product" button that opens a modal with the same form used in onboarding step 4 (name, general info, ICP fields). On success, the modal closes and the new product is prepended to the list without a full page reload.

#### Scenario: Duplicate name is rejected inline
- **WHEN** the submitted name collides with an existing product
- **THEN** the modal stays open with an inline error on the `name` field

### Requirement: Delete product

The product detail page SHALL expose a "Delete product" action in an overflow menu. Clicking it MUST open a confirmation modal that requires typing the product name to confirm. On confirm, the API deletes the product and cascades to all owned rows; the UI redirects to `/products`.

#### Scenario: Confirmation requires name match
- **WHEN** the operator clicks delete and types a name that does not match
- **THEN** the confirm button stays disabled

#### Scenario: Delete cascades server-side
- **WHEN** deletion succeeds for a product that had leads, signals, drafts, schedules, feedback, and a chat thread
- **THEN** every row in those tables referencing the deleted `product_id` is gone
