## 1. Schema additions in packages/db

- [x] 1.1 Add `Workspace` entity with fields per spec, a `singleton` boolean column with a partial unique index `WHERE singleton = TRUE`, and `onboarding_status` enum
- [x] 1.2 Add `Operator` entity with FK to Workspace, unique email, `preferred_channel` enum
- [x] 1.3 Add `ChannelCredential` entity with FK to Workspace, `(workspace_id, channel)` unique constraint, `credentials_ciphertext bytea`, `credentials_iv bytea`
- [x] 1.4 Define `onboarding_status`, `channel`, and `preferred_channel` Postgres enums
- [x] 1.5 Create MikroORM migration adding the three tables, their enums, and the partial unique index on workspaces
- [x] 1.6 Add `WorkspacesRepository`, `OperatorsRepository`, `ChannelCredentialsRepository` in `packages/db/src/repositories/`

## 2. Encryption service

- [x] 2.1 Add `APP_SECRET_KEY` (required, min 32 chars) to `apps/api/src/config/configuration.ts` with fail-fast on missing
- [x] 2.2 Implement `CryptoService` in `apps/api/src/common/crypto/` with `encrypt(plain: string): { ciphertext, iv }` and `decrypt(ciphertext, iv): string` using AES-256-GCM (key = SHA-256 of `APP_SECRET_KEY`)
- [x] 2.3 Add unit tests for round-trip, tampered-ciphertext-rejected, and wrong-key-rejected cases
- [x] 2.4 Add a winston redaction format that strips fields matching `/token|credential|ciphertext/i` from log objects

## 3. Workspace / Operator / Channel services

- [x] 3.1 `WorkspaceService`: `get()`, `create(input)`, `update(patch)`. `create` refuses if a workspace row already exists.
- [x] 3.2 `OperatorService`: `getCurrent(workspaceId)`, `upsert(workspaceId, input)`. "Upsert" because onboarding step 2 is idempotent.
- [x] 3.3 `ChannelCredentialsService`: `save(workspaceId, channel, plaintext)` (encrypts), `load(workspaceId, channel)` (decrypts), `redactedList(workspaceId)` (returns `{ channel, configured, updatedAt }[]`)
- [x] 3.4 Wire Nest modules: `WorkspaceModule`, `OperatorModule`, `ChannelsModule` (all under `apps/api/src/modules/...`)

## 4. Onboarding module (API)

- [x] 4.1 `OnboardingController`: endpoints per spec — `GET /onboarding`, `POST /onboarding/workspace-details`, `/operator-profile`, `/channels`, `/first-product`, `/reset`
- [x] 4.2 DTOs with `class-validator`: `WorkspaceDetailsDto`, `OperatorProfileDto`, `ChannelsDto`, `FirstProductDto`; validate timezone via `Intl.supportedValuesOf('timeZone').includes(tz)` in a custom decorator
- [x] 4.3 `OnboardingService.advance(fromStatus, toStatus, tx)` helper that does `SELECT ... FOR UPDATE` on the workspace row and bumps status
- [x] 4.4 Step 1 handler: creates or updates the workspace row; advances `pending → workspace_details`
- [x] 4.5 Step 2 handler: upserts the operator; advances `workspace_details → operator_profile`
- [x] 4.6 Step 3 handler: for each provided channel, validates (Telegram via `getMe`, WhatsApp shallow) and persists credentials; advances `operator_profile → channels`
- [x] 4.7 Step 4 handler: transaction that inserts Product + ProductIcp and advances `channels → first_product` then directly to `completed`
- [x] 4.8 Reset endpoint: guarded by `X-Admin-Token` header matching `APP_SECRET_KEY`; deletes the workspace (cascades to operators, channel creds, products if any); a new `pending` workspace is created fresh on next onboarding
- [x] 4.9 After `completed`, all non-reset step endpoints respond 409 Conflict

## 5. Settings module (API)

- [x] 5.1 `SettingsController`: `GET /settings`, `PATCH /settings/workspace`, `PATCH /settings/operator`, `PUT /settings/channels/:channel`, `DELETE /settings/channels/:channel`
- [x] 5.2 Reuse the same services as onboarding; guard every route behind "workspace exists and onboarding_status = completed"
- [x] 5.3 Do not re-encrypt unchanged credentials on PUT

## 6. Web wizard

- [x] 6.1 Add `apps/web/src/pages/onboarding/index.tsx` — the wizard shell with progress indicator
- [x] 6.2 `apps/web/src/pages/onboarding/step-workspace-details.tsx` — form with name/timezone/currency
- [x] 6.3 `apps/web/src/pages/onboarding/step-operator-profile.tsx` — form with name/email/preferred channel
- [x] 6.4 `apps/web/src/pages/onboarding/step-channels.tsx` — two collapsible sections (Telegram, WhatsApp), each with skippable state, inline validation errors from the API
- [x] 6.5 `apps/web/src/pages/onboarding/step-first-product.tsx` — product name, general info, ICP (target industries multiselect, company sizes multiselect, geographies multiselect, ICP notes)
- [x] 6.6 Wire a TanStack Query hook `useOnboardingStatus()` that fetches `GET /onboarding` and invalidates after each step submit
- [x] 6.7 App-shell route guard in `apps/web/src/App.tsx`: until `status === 'completed'`, redirect `/` to `/onboarding`; once completed, redirect `/` to `/products` (route may not exist yet — fall back to `/` with an empty state until the product-chat change lands)
- [x] 6.8 Timezone typeahead using `Intl.supportedValuesOf('timeZone')`
- [x] 6.9 Client-side validation mirrors server-side DTOs; submission errors from API are surfaced inline

## 7. Settings page (web)

- [x] 7.1 `apps/web/src/pages/settings/index.tsx` with three sections: Workspace, Operator, Channels
- [x] 7.2 Channels section renders each channel's `configured: boolean` status and `updatedAt`; "Reconfigure" button opens a modal to re-enter credentials
- [x] 7.3 Guard the route: redirect to `/onboarding` if `status !== 'completed'`

## 8. Documentation

- [x] 8.1 Update `.env.example` — add `APP_SECRET_KEY=<generate-a-32-char-secret>` with a comment on purpose
- [x] 8.2 Update `CLAUDE.md`: add "Onboarding" section describing the state machine; add note that `APP_SECRET_KEY` is required; document the admin reset endpoint
- [x] 8.3 Update root `README.md` quickstart to include: after DB migrations, start the app and open `/onboarding`

## 9. Verify

- [x] 9.1 Fresh DB → open web → redirected to `/onboarding` step 1
- [x] 9.2 Submit all four steps → redirected to `/products` (or fallback)
- [x] 9.3 Attempting out-of-order step submission → 409
- [x] 9.4 Post-completion, hitting `/onboarding/first-product` → 409
- [x] 9.5 Settings edits persist through a full API restart
- [x] 9.6 Reset endpoint with correct admin token wipes and restarts; wrong token 401
