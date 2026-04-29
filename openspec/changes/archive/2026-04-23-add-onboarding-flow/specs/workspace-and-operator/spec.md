## ADDED Requirements

### Requirement: Singleton workspace

The system SHALL support at most one `Workspace` row. Attempting to create a second workspace MUST fail. The workspace is identified by its `id` (uuid) and carries the top-level settings for the deployment.

The `workspaces` table MUST have: `id` (uuid, pk), `name` (text, not null), `timezone` (text, not null, default `'UTC'`), `default_currency` (text, 3-char ISO code, default `'USD'`), `onboarding_status` (enum: pending | workspace_details | operator_profile | channels | first_product | completed, default `'pending'`), `created_at`, `updated_at`.

#### Scenario: Second workspace insert is rejected
- **WHEN** an insert is attempted and a workspace row already exists
- **THEN** the insert fails (enforced by a unique partial index on a sentinel column or by application-level guard, implementation choice)

#### Scenario: Default onboarding status is pending
- **WHEN** a workspace is created without specifying `onboarding_status`
- **THEN** the row's status is `'pending'`

### Requirement: Operator entity

An `Operator` SHALL represent the human using the system. The `operators` table MUST have: `id` (uuid, pk), `workspace_id` (uuid, fk → workspaces.id, not null), `name` (text, not null), `email` (text, not null, unique), `preferred_channel` (enum: telegram | whatsapp, nullable — set after the channels step), `created_at`, `updated_at`.

At most one operator is expected per workspace in this single-tenant model, but the schema does not enforce that — it is an application-level invariant (enforced by the onboarding flow refusing to create a second operator).

#### Scenario: Operator email is unique
- **WHEN** two operator inserts attempt to use the same email
- **THEN** the second insert fails with a unique-violation error

#### Scenario: Operator without preferred channel is valid
- **WHEN** an operator is created before the channels step
- **THEN** `preferred_channel` is null and the row is valid

### Requirement: Channel credentials at rest

Channel credentials SHALL be stored in a `channel_credentials` table with fields: `id` (uuid, pk), `workspace_id` (uuid, fk → workspaces.id, not null), `channel` (enum: telegram | whatsapp), `credentials_ciphertext` (bytea, not null), `credentials_iv` (bytea, not null), `created_at`, `updated_at`. A unique constraint MUST exist on `(workspace_id, channel)` so each channel has at most one credential row per workspace.

Credentials MUST be encrypted with AES-GCM using a 256-bit key derived from the `APP_SECRET_KEY` env var. The plaintext JSON MUST be structured as:
- Telegram: `{ "botToken": string, "webhookSecret": string | null }`
- WhatsApp: `{ "phoneNumberId": string, "accessToken": string, "verifyToken": string }`

Plaintext MUST NOT be logged, and ciphertext MUST NOT be returned to clients — the API returns a redacted view (`{ channel, configured: true, updatedAt }`).

#### Scenario: Credentials round-trip through encryption
- **WHEN** a Telegram bot token is saved via `ChannelCredentialsService.save(...)` and later loaded via `load('telegram')`
- **THEN** the loaded plaintext equals the original input

#### Scenario: API never exposes plaintext
- **WHEN** a client calls `GET /settings/channels`
- **THEN** the response for each configured channel contains only `{ channel, configured: true, updatedAt }` with no token material

#### Scenario: Missing APP_SECRET_KEY fails fast
- **WHEN** the API starts without `APP_SECRET_KEY`
- **THEN** startup exits non-zero with a clear error identifying the missing variable

### Requirement: Settings surface

The web app SHALL expose a `/settings` route that allows an operator to edit workspace name/timezone/currency, their own operator profile, and channel credentials. Edits MUST persist via the same repositories used by the onboarding flow. The Settings page MUST be reachable only after onboarding is completed.

#### Scenario: Settings is hidden pre-onboarding
- **WHEN** a user navigates to `/settings` while `onboarding_status` is not `'completed'`
- **THEN** the router redirects to `/onboarding`

#### Scenario: Settings edits persist
- **WHEN** the operator updates the workspace timezone via Settings and reloads the page
- **THEN** the new timezone is displayed and stored in the database
