## ADDED Requirements

### Requirement: Onboarding state machine

The workspace's `onboarding_status` SHALL advance through these states in order: `pending` → `workspace_details` → `operator_profile` → `channels` → `first_product` → `completed`. Each step's `POST` endpoint MUST validate that the current status matches the expected previous state, and MUST advance to the next state only on success.

Steps MUST be idempotent: re-submitting the same step payload for the current state overwrites the prior submission. Backward movement is permitted only via the Settings page after completion, not through the wizard API.

#### Scenario: Status advances on successful step
- **WHEN** the workspace is in `workspace_details` and `POST /onboarding/workspace-details` succeeds
- **THEN** `onboarding_status` becomes `operator_profile`

#### Scenario: Skipping a step is rejected
- **WHEN** the workspace is in `pending` and `POST /onboarding/operator-profile` is called
- **THEN** the API responds with 409 Conflict and the status does not advance

#### Scenario: Re-submission overwrites
- **WHEN** `POST /onboarding/workspace-details` is submitted twice from the same `pending` state
- **THEN** the second submission replaces the values from the first and advances exactly once

### Requirement: Step 1 — workspace details

The first step SHALL collect workspace `name` (1–80 chars, required), `timezone` (IANA tz identifier, required), and `default_currency` (3-char ISO 4217 code, default `USD`). On success the workspace row is inserted (or updated if already pending) and status advances to `operator_profile`.

#### Scenario: Invalid timezone is rejected
- **WHEN** `POST /onboarding/workspace-details` is called with `timezone: "Mars/Phobos"`
- **THEN** the API responds with 400 and includes a validation error naming `timezone`

#### Scenario: Missing name is rejected
- **WHEN** the payload has no `name` or an empty string
- **THEN** the API responds with 400 and includes a validation error naming `name`

### Requirement: Step 2 — operator profile

The second step SHALL collect operator `name` (1–80 chars), `email` (valid email), and `preferred_channel` (telegram | whatsapp). On success an `Operator` row is inserted for the workspace and status advances to `channels`.

#### Scenario: Duplicate email reuse within same workspace
- **WHEN** the step is re-submitted with a different email than the first submission
- **THEN** the existing operator row is updated in place (no second operator is created)

#### Scenario: Invalid email is rejected
- **WHEN** `email` fails RFC-5322-ish validation
- **THEN** the API responds with 400 and the status does not advance

### Requirement: Step 3 — channels (optional)

The third step SHALL allow the operator to configure Telegram and/or WhatsApp credentials, OR to skip entirely. The payload MAY include a `telegram` object, a `whatsapp` object, both, or neither. Provided credentials MUST pass a lightweight validation (Telegram: `getMe` call succeeds; WhatsApp: phone number id is a non-empty string — no live check) before being stored. On success status advances to `first_product` regardless of whether credentials were provided.

#### Scenario: Telegram credentials validated via getMe
- **WHEN** a Telegram bot token is submitted and the Telegram API `getMe` call fails
- **THEN** the API responds with 400 and the credentials are NOT stored

#### Scenario: Skipping channels advances state
- **WHEN** the payload is `{}` or both `telegram` and `whatsapp` are absent
- **THEN** no credentials are stored and status advances to `first_product`

#### Scenario: Credentials stored encrypted
- **WHEN** valid credentials are submitted
- **THEN** a `channel_credentials` row exists for the channel, the `credentials_ciphertext` is non-empty, and the plaintext is not recoverable without `APP_SECRET_KEY`

### Requirement: Step 4 — first product

The fourth step SHALL create the first `Product` row. Payload requires: product `name` (unique, 1–80 chars), `general_info` (text, 0–2000 chars, optional), and an ICP block with `target_industries` (string[]), `company_sizes` (string[]), `geographies` (string[]), and `icp_notes` (text). On success, the `Product` and its linked `ProductIcp` row are persisted in one transaction, and the workspace status advances to `completed`.

#### Scenario: Product is persisted atomically with its ICP
- **WHEN** `POST /onboarding/first-product` succeeds
- **THEN** both the `products` row and the `product_icp` row exist in the database, or neither does

#### Scenario: Duplicate product name is rejected
- **WHEN** the submitted `name` collides with an existing product
- **THEN** the API responds with 409 Conflict, neither row is written, and the status does not advance

### Requirement: Onboarding API contract

The API SHALL expose:
- `GET /onboarding` → returns `{ status, currentStep, completedSteps, data }` where `data` is the values submitted for already-completed steps (redacted for channel credentials).
- `POST /onboarding/workspace-details` → step 1.
- `POST /onboarding/operator-profile` → step 2.
- `POST /onboarding/channels` → step 3.
- `POST /onboarding/first-product` → step 4.
- `POST /onboarding/reset` → admin-only (not exposed in web UI) — wipes the workspace back to `pending`. Guarded by an `X-Admin-Token` header matching the `APP_SECRET_KEY`.

After `status === 'completed'`, all `POST /onboarding/*` endpoints except `/reset` MUST respond with 409 Conflict.

#### Scenario: POST after completed is rejected
- **WHEN** status is `completed` and `POST /onboarding/workspace-details` is called
- **THEN** the response is 409 Conflict

#### Scenario: GET exposes progress
- **WHEN** steps 1 and 2 are complete and the client calls `GET /onboarding`
- **THEN** `completedSteps` contains `['workspace_details', 'operator_profile']` and `data.workspace_details` and `data.operator_profile` are populated

### Requirement: Web wizard

The web app SHALL expose an `/onboarding` route with four screens in order, one per step. Navigation MUST reflect the API status: the user MAY revisit a completed step to review values but CANNOT submit out of order. A progress indicator showing `(n of 4)` MUST be visible on each screen.

The root route `/` SHALL redirect to `/onboarding` while `status !== 'completed'`, and to `/products` (provided by the product-chat change) once complete. The redirect MUST be based on data fetched at app boot from `GET /onboarding`, not on optimistic client-side flags.

#### Scenario: Fresh deploy redirects to onboarding
- **WHEN** a first-time user opens the web app against a fresh database
- **THEN** they land on `/onboarding` step 1, not on the app home

#### Scenario: Completed user lands on products
- **WHEN** an operator who has completed onboarding opens `/`
- **THEN** they are redirected to `/products`

#### Scenario: Progress indicator reflects real state
- **WHEN** the operator is on step 3
- **THEN** the UI shows "3 of 4" and the first two steps' values are pre-filled from the API response
