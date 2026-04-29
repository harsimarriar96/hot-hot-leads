## Context

With Notion gone and Postgres in place, a fresh deploy is a blank DB that the operator has no way to populate from the UI. Historically, the "setup" was editing env vars and pointing at a Notion page tree; this is no longer available. We need a small, directed flow that bootstraps the minimum state the agents need (a workspace, an operator, channel creds, and at least one product with an ICP).

The system is single-tenant. There is exactly one workspace per deployment, one operator in practice, and no public signup.

## Goals / Non-Goals

**Goals:**
- Wizard UX that completes in under 2 minutes for a prepared operator.
- State machine that is resilient to reloads — progress is server-side, not in-browser.
- Channel credentials stored encrypted at rest.
- Data captured in the first-product step is rich enough that `ProspectDiscoveryAgent` can immediately be useful.
- Onboarding and Settings share the same underlying service so there's one code path for writes.

**Non-Goals:**
- Multi-operator/team invites.
- External identity providers (Google, GitHub SSO).
- Billing or plan selection.
- An elaborate ICP builder — the first-product step captures the basics; deeper ICP editing lives on the product page (introduced by the product-chat change).
- Undoing onboarding from the UI (admin-only reset endpoint exists for recovery).

## Decisions

### 1. Server-owned state machine

`onboarding_status` lives on the `workspaces` row. The web app fetches it on boot and after every step. This means: page reloads, multiple tabs, and browser crashes all converge to the same state. The alternative (client-managed step index) was rejected because reload = lost progress.

### 2. Four steps, not three or five

Four fits the minimum state needed:
1. Workspace identity (name/tz/currency)
2. Operator identity (name/email/preferred channel)
3. Channels (optional but encouraged — skipping this yields a product-creation-only system until the operator sets up channels later)
4. First product + basic ICP

Three would force workspace+operator into one noisy screen. Five would push ICP into its own step and slow down the path-to-value.

### 3. Channel credentials encrypted with AES-GCM

Credentials are sensitive tokens. We store `credentials_ciphertext` + `credentials_iv` in Postgres, encrypted with a 256-bit key derived from `APP_SECRET_KEY` via SHA-256 (single-tenant, key rotation handled by re-encrypting on a future version bump if needed). Plaintext never leaves the server process except through the send pathways to Telegram/WhatsApp.

Alternatives considered: external secret manager (KMS/Vault) — overkill for single-tenant self-host. Storing plaintext — unacceptable for anyone running the app in any shared environment.

### 4. Telegram token validated via getMe; WhatsApp credentials validated shallowly

Telegram has a cheap unauthenticated-ish `getMe` endpoint we can hit to confirm a bot token is live. WhatsApp doesn't have an equivalent zero-cost check and Meta's API shapes are token-shape-dependent, so we accept credentials that parse and defer real validation to the first outbound message.

### 5. First product step writes Product + ProductIcp in one transaction

`OnboardingService.completeFirstProduct(input)` opens a transaction, inserts the `products` row, then the `product_icp` row, then flips `onboarding_status` to `completed`. Three writes, one transaction — rollback on any failure leaves the status unchanged.

### 6. Settings page shares the service layer

`OnboardingService` and `SettingsService` sit on top of `WorkspaceService`, `OperatorService`, `ChannelCredentialsService`. The onboarding step endpoints and the settings CRUD endpoints both call into these. The only difference is the state-machine guard in onboarding.

### 7. No admin UI for the reset endpoint

`POST /onboarding/reset` exists for disaster recovery and is guarded by a header token (`X-Admin-Token`) matching `APP_SECRET_KEY`. We intentionally don't expose it in the web UI because an "undo onboarding" button is a footgun.

### 8. Redirect decision made from real API data

The web app's app-shell `useQuery` fetches `GET /onboarding` at mount. The redirect guard (`/` → `/onboarding` vs `/products`) keys off that query. No local-storage flags — they go stale.

## Risks / Trade-offs

- **Credentials leak via logs** → Mitigation: a winston redaction filter in `apps/api` that strips `botToken`, `accessToken`, `credentials_ciphertext`, and any field name ending in `_token`. Add a lint rule in code review: "never `log.info(creds)`".
- **Timezone list UX** → Mitigation: use a typeahead backed by `Intl.supportedValuesOf('timeZone')` on the web side rather than a giant dropdown.
- **Operator abandons after step 2** → Mitigation: `GET /onboarding` returns `completedSteps`, so reopening the tab resumes at step 3. No timeout.
- **Second workspace insert sneaks in via admin scripts** → Mitigation: a unique partial index on a sentinel column (`singleton = TRUE`) enforced in migration. Also an application-level guard in `WorkspaceService.create`.
- **`APP_SECRET_KEY` lost/rotated** → Mitigation: channel credentials become unreadable; the Settings page shows "reconfigure required" for any row that fails decryption and prompts re-entry. Documented in `CLAUDE.md`.
- **Race on concurrent step submissions** → Mitigation: the state-machine guard is implemented via a `SELECT ... FOR UPDATE` on the workspace row within the transaction, so two concurrent step 2 submits serialize.

## Migration Plan

1. Add `Workspace`, `Operator`, `ChannelCredential` entities in `packages/db`.
2. Generate migration for the three new tables and the `onboarding_status` enum.
3. Implement `WorkspaceService`, `OperatorService`, `ChannelCredentialsService` (with AES-GCM) in `apps/api`.
4. Implement `OnboardingModule` (controller + service + guards) in `apps/api`.
5. Implement `SettingsModule` reusing the services.
6. Add `APP_SECRET_KEY` to `config/configuration.ts` as required.
7. Build web wizard screens under `apps/web/src/pages/onboarding/` and wire the app-shell redirect guard.
8. Build web Settings page under `apps/web/src/pages/settings/`.
9. Write integration tests for the state machine (reject skip, accept resubmit, atomic first-product).

**Rollback:** revert the PR. The migration introduces three new tables with no FKs from existing tables pointing in — they can be dropped cleanly if the change ships and then gets reverted.

## Open Questions

- Should the "channels" step accept Slack in addition to Telegram/WhatsApp? **Proposed:** not yet. Adding Slack is a separate channel feature; we can extend this step with a new channel enum value when it exists.
- Should we pre-fill the first-product ICP fields from an AI suggestion based on company name? **Proposed:** no — keep the flow deterministic for v1. Add later as a quality-of-life feature.
- Is there a path for a user to export/import an onboarding bundle (for moving between deployments)? **Proposed:** defer; not in the current ask.
