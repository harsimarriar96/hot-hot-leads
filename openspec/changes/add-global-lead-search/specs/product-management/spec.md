## MODIFIED Requirements

### Requirement: Leads tab

The Leads tab SHALL render leads for the product in a table with columns: Company, Contact, Status, Score. Status values MUST be rendered with their display label (e.g. `outreach_ready` → "Ready to outreach"). Score MUST be rendered as a colored pill using the `--score-hot / --score-warm / --score-cold` design tokens, bucketed by score (≥80 hot, 60–79 warm, 40–59 lukewarm, <40 cold).

Each row SHALL be a clickable trigger that opens the lead-explanation Sheet (see capability `lead-explanation`). The trigger MUST be keyboard-accessible — pressing `Enter` or `Space` on a focused row MUST behave identically to clicking it. Cursor styling MUST indicate the row is interactive.

The Leads tab SHALL accept a `?focus={leadId}` query parameter. When the parameter is present, the tab MUST scroll the matching row into view (`block: 'nearest'`) and automatically open the explain Sheet for that lead. If the focused lead is not on the currently loaded page, the tab MUST fetch a page containing it before scrolling. Closing the Sheet MUST clear `focus` from the URL via `setSearchParams({}, { replace: true })` so the back button doesn't reopen it.

#### Scenario: Empty state suggests chat action
- **WHEN** the product has zero leads
- **THEN** the tab renders an empty state suggesting "Open the Chat tab and ask the agent to generate leads"

#### Scenario: Row click opens explain Sheet
- **WHEN** the operator clicks a lead row
- **THEN** the lead-explanation Sheet opens with that lead's data and the parent product's current ICP

#### Scenario: Keyboard activation works
- **WHEN** a lead row has keyboard focus and the operator presses Enter
- **THEN** the Sheet opens identically to a mouse click

#### Scenario: Focus param scrolls and opens
- **WHEN** the page is opened with `?focus={leadId}` for a lead in the workspace
- **THEN** the matching row scrolls into view and its explain Sheet opens automatically

#### Scenario: Closing the focused Sheet clears the URL
- **WHEN** the explain Sheet was opened via `?focus=...` and the operator closes it
- **THEN** the URL becomes `/products/:id/leads` (no `focus` parameter) without adding a history entry
