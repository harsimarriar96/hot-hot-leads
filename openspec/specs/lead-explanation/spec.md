# lead-explanation Specification

## Purpose
TBD - created by archiving change add-demo-roadmap. Update Purpose after archive.
## Requirements
### Requirement: Click-to-explain lead row

A row in the Leads tab SHALL be clickable; clicking it MUST open a Sheet that explains why the agent surfaced this lead at this score. The Sheet MUST anchor right (or bottom on mobile) using the existing `Sheet` primitive, MUST be dismissable via the close button, an outside-click, or `Escape`, and MUST trap focus while open.

The trigger MUST be a real interactive element (button or row with `role="button"` and `tabIndex={0}`); a keyboard user pressing `Enter` or `Space` on a focused row MUST open the same Sheet.

#### Scenario: Keyboard opens the Sheet
- **WHEN** a keyboard-only user tabs to a lead row and presses Enter
- **THEN** the Sheet opens and focus moves into the Sheet

#### Scenario: Escape closes the Sheet
- **WHEN** the Sheet is open and the user presses Escape
- **THEN** the Sheet closes and focus returns to the originating row

### Requirement: Explanation content shape

The Sheet SHALL render the following sections when the corresponding data is present (each section is optional and MUST be omitted when its source data is empty, except for the header which is always present):

1. **Header** — company name + score pill colored via `--score-hot/warm/cold` based on `scoreTone(score)`.
2. **ICP fit** — a checklist comparing the lead's `industry`, `companySize`, `fundingStage`, and `geography` to the parent product's ICP. Each axis MUST render `✓` (matched) or `✗` (mismatched) with the matched/expected values displayed.
3. **Signals** — list of signals attached to this lead (from `lead.signals`) showing type icon, headline, source domain, and date.
4. **Reasoning** — the orchestrator's `icpFitReason` and `signalSummary` strings, rendered as paragraphs.
5. **Contact** — `contactEmail` and `domain` if present; otherwise an em-dash.

Missing or null fields MUST render as an em-dash (`—`), never as the string `"null"` or `"undefined"`.

#### Scenario: Lead without signals omits the section
- **WHEN** a lead has no associated signals
- **THEN** the Sheet renders Header, ICP fit, Reasoning, and Contact — the Signals section is absent (no empty heading)

#### Scenario: Score pill matches list
- **WHEN** the lead row in the table shows a hot-tinted pill at score 86
- **THEN** the Sheet header pill is the same hot tint at 86

### Requirement: ICP fit is computed against the parent product's current ICP

The fit checklist MUST compare the lead's enrichment fields against the **current** values in `ProductIcp`, not a snapshot taken at lead-creation time. Editing the ICP and reopening the Sheet MUST reflect the updated comparison without a full page reload.

#### Scenario: ICP edit reflows the explanation
- **WHEN** the operator removes "fintech" from `target_industries` and reopens the Sheet for a fintech lead
- **THEN** the industry axis flips from `✓` to `✗`

