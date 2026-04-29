## Why

Today the system has no notion of "who is using it." Product knowledge lives in a user-owned Notion workspace that the operator configures manually with env vars and page IDs. With Notion gone and Postgres as the datastore, we need a clean, in-app way for a new operator to: tell the system who they are, name their workspace, connect their channels (Telegram/WhatsApp tokens — optional to start), and create their first one or two products so the agents have something to work with. Without this, a fresh deploy is a blank database with no agent can do anything useful.

## What Changes

- Introduce a singleton `Workspace` entity plus an `Operator` entity representing the human operating the system. Single-tenant, so at most one workspace exists per deployment.
- Add an onboarding state machine persisted on the workspace: `pending` → `workspace_details` → `operator_profile` → `channels` → `first_product` → `completed`. The API exposes `GET /onboarding` returning current state, and `POST /onboarding/:step` advancing it.
- Web app gets an onboarding wizard at `/onboarding` with one screen per step. The app's root route redirects to `/onboarding` until `status === 'completed'`.
- First-step screen collects workspace name, timezone, and default currency.
- Second-step screen collects operator name, email, and preferred chat channel (Telegram or WhatsApp).
- Third-step screen is optional-but-encouraged channel configuration: paste Telegram bot token + chat id, or WhatsApp phone number id + access token. Skipping leaves the workspace in a state where chat channels are not wired up (operator can finish later from Settings).
- Fourth-step screen creates the first product — name, description, and a quick ICP capture (target industries, company sizes, geographies, and a free-text "who we sell to" note). Saved via the `ProductsRepository` introduced by the Postgres change.
- On completion, the wizard marks the workspace `completed` and redirects to `/products` (the surface added by the product-chat change).
- Add a "Settings" page in the web app that allows re-editing workspace/operator/channel details after onboarding.
- Re-running onboarding is blocked at the API level once `completed`, but the Settings page provides the same edits.

## Capabilities

### New Capabilities
- `workspace-and-operator`: The single-tenant workspace and operator entities, plus their settings and channel configuration.
- `onboarding-flow`: The stepped onboarding experience — state machine, API endpoints, and the web wizard — that collects initial setup details and bootstraps the first product.

### Modified Capabilities
<!-- None — prior changes in this series introduce the entities we extend. No conflict at spec level. -->

## Impact

- **Depends on**: `convert-to-turborepo` and `migrate-persistence-to-postgres` — this change assumes `apps/web` and `packages/db` exist and the ORM is wired.
- **DB**: adds `workspaces`, `operators`, and `channel_credentials` tables (and a migration). The first two are small; `channel_credentials` stores Telegram/WhatsApp tokens encrypted at rest.
- **API**: adds `OnboardingModule` with `OnboardingController` and `OnboardingService`; adds `SettingsModule` with CRUD for workspace/operator/channels.
- **Web**: adds `apps/web/src/pages/onboarding/` (one file per step) and `apps/web/src/pages/settings/`; adds a top-level guard in the app router that redirects to `/onboarding` when the workspace is not yet completed.
- **Security**: channel credentials are sensitive. Stored encrypted using an `APP_SECRET_KEY` env var (AES-GCM). Plaintext returned only to the operator who owns the workspace (single-tenant — no cross-user concerns).
- **Config**: introduces `APP_SECRET_KEY` as a required env var for encrypting channel credentials. Documented in `CLAUDE.md` and `.env.example`.
- **Out of scope**: multi-operator or role-based access (single-tenant, single-operator); external auth providers; billing; team invites — all deferred.
