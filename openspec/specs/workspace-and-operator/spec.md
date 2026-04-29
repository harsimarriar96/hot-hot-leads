# workspace-and-operator

## Purpose

The singleton workspace + single operator entities, plus the encrypted channel credential store. Everything per-deployment sits under one `Workspace` row.

## Requirements

### Requirement: Singleton workspace

The system SHALL support at most one `Workspace` row. Attempting to create a second workspace MUST fail. The workspace is identified by its `id` (uuid) and carries the top-level settings for the deployment.

The `workspaces` table MUST have: `id` (uuid, pk), `name` (text, not null), `timezone` (text, not null, default `'UTC'`), `default_currency` (text, 3-char ISO code, default `'USD'`), `onboarding_status` (enum: pending | workspace_details | operator_profile | channels | first_product | completed, default `'pending'`), `created_at`, `updated_at`. A `singleton` boolean column exists with a unique partial index (`WHERE singleton = TRUE`) that enforces the single-row constraint.

#### Scenario: Second workspace insert is rejected
- **WHEN** an insert is attempted and a workspace row already exists
- **THEN** the partial unique index on `singleton` causes the insert to fail

#### Scenario: Default onboarding status is pending
- **WHEN** a workspace is created without specifying `onboarding_status`
- **THEN** the row's status is `'pending'`

### Requirement: Operator entity

An `Operator` SHALL represent the human using the system. The `operators` table MUST have: `id` (uuid, pk), `workspace_id` (uuid, fk → workspaces.id, not null), `name` (text, not null), `email` (text, not null, unique), `preferred_channel` (enum: telegram | whatsapp, nullable), `created_at`, `updated_at`.

At most one operator is expected per workspace in this single-tenant model. The schema does not enforce that directly; the onboarding flow enforces it by upserting a single operator row per workspace rather than inserting.

#### Scenario: Operator email is unique
- **WHEN** two operator inserts attempt to use the same email
- **THEN** the second insert fails with a unique-violation error

#### Scenario: Operator without preferred channel is valid
- **WHEN** an operator is created before the channels step
- **THEN** `preferred_channel` is null and the row is valid

### Requirement: Channel credentials at rest

Channel credentials SHALL be stored in a `channel_credentials` table with fields: `id` (uuid, pk), `workspace_id` (uuid, fk → workspaces.id, not null), `channel` (enum: telegram | whatsapp), `credentials_ciphertext` (bytea, not null), `credentials_iv` (bytea, not null), `credentials_auth_tag` (bytea, not null), `created_at`, `updated_at`. A unique constraint MUST exist on `(workspace_id, channel)` so each channel has at most one credential row per workspace.

Credentials MUST be encrypted with AES-256-GCM using a 256-bit key derived from the `APP_SECRET_KEY` env var via SHA-256. The plaintext JSON MUST be structured as:
- Telegram: `{ "botToken": string, "webhookSecret": string | null }`
- WhatsApp: `{ "phoneNumberId": string, "accessToken": string, "verifyToken": string }`

Plaintext MUST NOT be logged, and ciphertext MUST NOT be returned to clients — the API returns a redacted view (`{ channel, configured: true, updatedAt }`).

#### Scenario: Credentials round-trip through encryption
- **WHEN** a Telegram bot token is saved via `ChannelCredentialsService.save(...)` and later loaded via `load(...)`
- **THEN** the loaded plaintext equals the original input

#### Scenario: API never exposes plaintext
- **WHEN** a client calls `GET /settings`
- **THEN** the `channels` array contains only `{ channel, configured: true, updatedAt }` per configured channel, with no token material

#### Scenario: Missing APP_SECRET_KEY fails fast
- **WHEN** the API starts without `APP_SECRET_KEY` (or with a value shorter than 32 chars)
- **THEN** startup exits non-zero with a clear error identifying the missing variable

### Requirement: Settings surface

The web app SHALL expose a `/settings` route that allows an operator to edit workspace name/timezone/currency, their own operator profile, and view the status of channel credentials. Edits MUST persist via the same services used by the onboarding flow. The Settings page MUST be reachable only after onboarding is completed.

#### Scenario: Settings is hidden pre-onboarding
- **WHEN** a user navigates to `/settings` while `onboarding_status !== 'completed'`
- **THEN** the router redirects to `/onboarding`

#### Scenario: Settings edits persist
- **WHEN** the operator updates the workspace timezone via Settings and reloads the page
- **THEN** the new timezone is displayed and stored in the database
