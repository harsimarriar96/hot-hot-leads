# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**HotHotLeads** is an AI-led GTM (Go-To-Market) Engineering engine built on NestJS + Claude. It:
- Reads and writes product knowledge (ICP, strategy, channels, pricing) in a **Postgres** database managed via MikroORM in [packages/db](packages/db/)
- Discovers, enriches, scores leads and drafts outreach using **Claude multi-agent pipelines**
- Monitors GTM signals via **Exa** web research
- Is controlled via a web UI plus **Telegram** and **WhatsApp** (on demand; scheduled runs are gated behind `SCHEDULES_ENABLED`, see below)
- Persists all output (leads, outreach, signals, feedback) in Postgres
- Is **multi-tenant**: users belong to organizations with a role; a platform admin creates organizations and sets their feature entitlements

## Commands

All commands run from the repo root and are orchestrated by Turborepo.

```bash
# Install all workspace dependencies (one node_modules at the root)
npm install

# One-time: start Postgres and apply migrations
docker compose up -d postgres
npm --workspace @hothotleads/db run db:migrate

# Development — starts both apps in watch mode
npx turbo run dev

# Run only the API in watch mode
npx turbo run dev --filter=@hothotleads/api

# Run only the web app
npx turbo run dev --filter=@hothotleads/web

# Production build (packages, then apps, in dependency order)
npx turbo run build

# Type-check the entire workspace
npx turbo run typecheck

# Lint the entire workspace
npx turbo run lint

# Run all tests
npx turbo run test

# Run a single API test file
npm --workspace @hothotleads/api run test:single -- src/modules/auth/auth.guard.spec.ts

# Production image (API serves the web build) and the single-host stack
docker build -t hothotleads .
docker compose -f docker-compose.prod.yml up -d --build

# Start the API from its build output
npm --workspace @hothotleads/api run start
```

## Architecture

This is a Turborepo monorepo with apps under `apps/` and shared packages under `packages/`.

```
apps/
├── api/                            # NestJS API + agent orchestration (@hothotleads/api)
│   ├── package.json
│   ├── tsconfig.json               # extends @hothotleads/config/tsconfig/nest.json
│   ├── nest-cli.json
│   ├── .env                        # runtime secrets (gitignored)
│   └── src/
│       ├── main.ts                 # NestJS bootstrap: global /api prefix, shutdown hooks, log level
│       ├── app.module.ts           # Root module wiring (serves apps/web/dist; schedules behind a flag)
│       ├── health.controller.ts    # GET /health (checks DB; 503 when down)
│       ├── config/configuration.ts # All env vars typed; config/models.ts holds model defaults
│       ├── modules/auth/           # Accounts, sessions, invites, TenantContext, guard + access decorators
│       ├── modules/organization/   # Organization service + members/invitations API
│       ├── modules/platform/       # Super-admin console API (/api/platform/*)
│       ├── common/types/           # Shared TypeScript interfaces
│       ├── agents/                 # BaseAgent + 8 specialized agents
│       ├── channels/               # Telegram + WhatsApp webhook controllers
│       ├── integrations/           # Exa / Tavily / Perplexity web-research clients
│       ├── db/db.module.ts         # MikroORM wiring + repository providers
│       └── scheduler/              # Cron-registration service (only loaded when SCHEDULES_ENABLED=true)
└── web/                            # Vite + React operator UI (@hothotleads/web)
    ├── package.json
    ├── tsconfig.json               # extends @hothotleads/config/tsconfig/vite.json
    ├── vite.config.ts
    └── src/                        # pages, components, hooks

packages/
├── config/                         # Shared TSConfig / ESLint / Prettier bases (@hothotleads/config)
│   ├── tsconfig/{base,nest,vite,library}.json
│   ├── eslint/base.js
│   └── prettier/index.js
├── types/                          # Shared domain types (@hothotleads/types) — plain interfaces shared between api + web
└── db/                             # Postgres schema + entities + repositories (@hothotleads/db)

turbo.json                          # pipeline: build, dev, lint, typecheck, test, start
```

**Dependency rule:** apps may depend on packages. Packages must not depend on apps. Apps must not import from sibling apps.

## Agent Architecture

8 specialized agents, all extending `BaseAgent` (which owns the Claude tool-use loop):

| Agent | Role | Key Tools |
|-------|------|-----------|
| **OrchestratorAgent** | Entry point — parses intent, loads product context, routes to specialists | get_products, load_product_context, run_* |
| **ProductContextAgent** | Loads + summarizes a product's knowledge (ICP, channels, sources, predefined prospects) from Postgres | get_product_knowledge |
| **ProspectDiscoveryAgent** | Finds new companies matching ICP via Exa | search_companies, save_lead |
| **EnrichmentAgent** | Deep-researches a company (news, funding, hiring, tech stack) | research_company, search_web, update_lead |
| **ScoringAgent** | Scores leads 0–100 against ICP + signals | get_product_knowledge, update_lead_score |
| **OutreachAgent** | Drafts channel-specific personalized messages referencing signals | get_lead, save_outreach |
| **SignalMonitorAgent** | Monitors Sources for new GTM signals and saves them to Postgres | search_signals, save_signal |
| **FeedbackAgent** | Evaluates output quality (0–10) and writes to Feedback Log | get_recent_feedback, save_feedback |

### Feedback Loop
Every significant output (lead batch, outreach draft) automatically triggers **FeedbackAgent** via `OrchestratorAgent.executeTool('run_feedback', ...)`. Feedback is persisted in the `feedback_entries` table (scoped by `product_id`). Run `/feedback-review` to surface patterns and ICP refinement suggestions.

## Data Model

Postgres is the single source of truth. Schema lives in [packages/db/src/entities/](packages/db/src/entities/).

```
Organization (tenant; slug, plan, entitlements jsonb, onboarding_status)
├── Membership                 N:M  — User ↔ Organization with role owner|admin|member|viewer
├── ChannelCredential          1:N  — encrypted Telegram/WhatsApp credentials
├── Schedule                   1:N  — also keeps created_by_user_id for the acting user
└── Product                    1:N  — (organization_id, name) and (organization_id, slug) unique
User (email unique, scrypt password_hash, is_platform_admin)
├── Session                    1:N  — opaque bearer token stored as sha256, 30-day sliding expiry
└── AuthToken                  1:N  — invite | password_reset, single use, hash only

Product (root of the GTM domain)
├── ProductIcp                 1:1  — target industries, sizes, funding stages, geographies, notes
├── ProductSalesChannel        1:N  — named outreach channels with templates
├── ProductSource              1:N  — signal sources (news, social, databases…)
├── PredefinedProspect         1:N  — seed companies for prospect discovery
├── Lead                       1:N
│     └── OutreachDraft        1:N  — drafts per lead, multiple channels
├── Signal                     1:N  — buying intent / hiring / activity signals; status pending|approved|rejected|snoozed
├── Schedule                   1:N  — recurring tasks delivered via Telegram/WhatsApp
├── Chat                       1:N  — conversations linked to the product (also owned by the organization)
│     └── ChatMessage          1:N  — append-only content blocks
└── FeedbackEntry              1:N  — agent quality scores
```

Organization-owned and product-owned tables cascade on delete. `leads(product_id, domain)` has a partial unique index (only when `domain IS NOT NULL`) to prevent dupes. UUID primary keys come from `pgcrypto.gen_random_uuid()`.

Repositories in [packages/db/src/repositories/](packages/db/src/repositories/) wrap the `EntityManager`. **Every tenant-scoped method takes `orgId` first** and every id lookup joins to the organization, so a row from another tenant is simply "not found" (`getLead(orgId, id)`, `getProductKnowledge(orgId, name)`, ...). All repositories are provided once by [apps/api/src/db/db.module.ts](apps/api/src/db/db.module.ts); new entities must be added both to `packages/db/src/entities/index.ts` and to the `ENTITIES` array there.

## Local dev — database

```bash
docker compose up -d postgres                           # Postgres 16 on localhost:5434
npm --workspace @hothotleads/db run db:migrate          # apply migrations
```

The API fails fast at boot if `DATABASE_URL` is missing or unreachable.

## HTTP API conventions

- **Every route is under `/api`** (`app.setGlobalPrefix('api')` in `main.ts`). Controllers declare paths without the prefix (`@Controller('products')` → `/api/products`). Only `/health` and `/webhooks/*` are excluded so externally configured webhooks keep their URLs.
- **Auth:** `POST /api/auth/login { email, password }` returns `{ token, me }`. The token is an opaque session (sha256 stored in `sessions`, 30-day sliding expiry). A global `AuthGuard` (`APP_GUARD`) resolves the session, picks the active organization (`X-Organization-Id` header → session default → the user's only membership), builds a `TenantContext` on `req.auth` (user, org, role, permissions, entitlements) and enforces `@RequirePermission(...)` / `@RequireFeature(...)` / `@PlatformAdmin()` metadata. `@Public()` opts a route out (health, webhooks, login, invite/reset). Denials are 403 with `{ code: 'permission_denied' | 'feature_disabled' | 'limit_reached' | 'no_organization' }`. Five failed logins per IP or per email lock for 15 minutes.
- **Tenant context is explicit.** Controllers take `@Auth() ctx` and pass `ctx.org.id` down; agents receive `{ ctx }` in `AgentRunOptions` and tool handlers get it as their second argument. Never store it on a singleton. Cron and channel runs rebuild it via `TenantContextService.forSchedule` / `forChannel`.
- **Roles and entitlements** live in `packages/types/src/auth.ts` (shared with the web): `ROLE_PERMISSIONS` maps owner/admin/member/viewer to a `Permission` set; `Organization.entitlements` is a sparse `EntitlementsPatch` resolved with `resolveEntitlements()` (features on/off, `maxProducts` / `maxMembers` / `maxLeadsPerMonth`, allowed channels). The `schedules` feature is ANDed with `SCHEDULES_ENABLED`. Agent tools carry `requires: { feature?, permission? }` and `BaseAgent` hides the ones the caller cannot use, telling the model so in a preamble.
- **Platform admin:** `users.is_platform_admin`. Bootstrapped from `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` at boot (password applied only when the account has none). Platform admins can open any organization in "support mode" (acting as owner) and manage orgs, entitlements, owner invites and reset links under `/api/platform/*` and the `/platform` web console.
- **Invites and resets are copy-link only.** No email is sent: `POST /api/organization/invitations` and the platform `invite-owner` route return `inviteUrl`; `password-reset-link` routes return `resetUrl`. Only hashes are stored, so "copy link" on a pending invite re-issues it. At boot, every member without a password gets a reset link logged at WARN.
- **Web client:** all requests go through `apps/web/src/lib/http.ts` (`apiFetch` / `apiJson`), which attaches the token and the `X-Organization-Id` header and signs the user out on a 401. Do not call `fetch` directly from components. `hooks/use-auth.tsx` exposes `useAuth()` (`can`, `hasFeature`, `limit`, `switchOrganization`); `components/gate.tsx` has `<Can>`, `<RequireFeature>`, `<GateHint>`. Gating rule: a missing role permission **hides** a control, a disabled feature **disables** it with a tooltip (and hides nav / shows `FeatureUnavailable` for routes), a reached limit disables with the counts. `App.tsx` gates: sign-in → organization → onboarding → app, with `/platform` before the organization gate.
- **Webhooks:** Telegram requests must carry `X-Telegram-Bot-Api-Secret-Token` equal to `TELEGRAM_WEBHOOK_SECRET`; WhatsApp requests must carry a valid `X-Hub-Signature-256` (HMAC of the raw body with `WHATSAPP_APP_SECRET`). Both are rejected while their secret is empty.
- **SPA serving:** `ServeStaticModule` serves `apps/web/dist` for every non-API path, so browser reloads on client routes work in production.
- **Dashboard:** `GET /api/dashboard/overview` (`leads:read`) returns the cross-product `DashboardOverview` (`packages/types/src/dashboard.ts`): totals, score-bucket pipeline, top hot leads, the newest pending signals and a per-product row, computed server-side in `modules/dashboard/dashboard.service.ts` (`summarise()` is pure). When the `signals` feature is off, signal numbers are zero and `signalsEnabled` is false without querying signals.
- **Signal review:** `POST /api/signals/:id/review { action: 'approve' | 'reject' | 'snooze', snoozeDays? }` (`signals:write` + `signals` feature) maps the action to a `SignalStatus`, stamps the reviewer, and returns the updated signal; `snoozeDays` is 1–90, default 7. `GET /api/signals?product=…` accepts an optional comma-separated `?status=` filter (unknown values ignored) and `?review=1`, which returns the dashboard's review queue (pending, or snoozed and due; no age cap).

## Chats

Conversations are organization-scoped rows in `chats` (optional `product_id`, `title`, `created_by_user_id`, `last_message_at`) with append-only `chat_messages` storing Anthropic-shaped `content_blocks` (text / tool_use / tool_result) as JSONB. Any member with `chat:read` sees every conversation; `chat:write` creates / renames / deletes / clears; `agents:run` sends.

- **API:** `/api/chats` — list (`?productId=`), create, get (`{ chat, messages }`), `PATCH` title, `DELETE` (cascade), `DELETE /:id/messages` (clear, keeps the row), `POST /:id/messages` (SSE), and `POST /api/chats/messages { text, productId? }` which creates the conversation and streams the first turn (`message_start` carries `chatId`, `userMessageId`, `title`; `message_done` carries `assistantMessageId`). Shared types live in `packages/types/src/chat.ts`; the SSE writer is `apps/api/src/modules/chat/sse.ts`.
- **Web:** `/chat` and `/chat/:chatId` (one route, optional segment) show a conversation sidebar plus the thread; the product Chat tab shows the product's conversations in a rail. Both use `hooks/use-chat-stream.ts` and `components/chat/*`; the API client is `lib/chats.ts` over `lib/sse.ts`. Titles are derived server-side from the first user message (`chat-title.ts`).
- **Model memory:** every turn passes the conversation's prior turns as `AgentRunOptions.history` (`chat-history.ts` reduces them to text, `agents/base/history.ts` renders at most 20 turns / 4k chars each / 24k total into the system overlay, after the canonical prompt). Only the orchestrator's top-level run gets history.
- **Streaming agent:** [BaseAgent.runStream](apps/api/src/agents/base/base.agent.ts) maps the Claude Agent SDK's async iterator into `message_start`, `text_delta`, `tool_use_start`, `tool_use_result`, `message_done`, `error`. Non-streaming `run()` drains the generator.
- **Channel sync:** `ChatService.handleIncoming` is used by both Telegram and WhatsApp handlers. Channels are still deployment-wide (env credentials), so a message is routed to the organization only when the deployment hosts exactly one (`ChatService.resolveOrgForSender`) and acts as that organization's earliest owner. When `organizations.sync_channel_chats = true` (default) and a product is resolved, the exchange lands in the product's newest conversation that already has messages from that channel, else the product's newest conversation, else a new one titled `<Product> · <channel>`.
- **Product management:** `/api/products` — list / get / create / patch / delete. Delete cascades to leads, outreach drafts, signals, schedules, feedback, and chats via the DB FKs. `lastChatActivityAt` reads `chats.last_message_at`.
- **Client disconnect:** the SSE handler continues the orchestrator run to completion even if the client aborts mid-stream, so the assistant message is always persisted in full.

### Known scope calls

- The Overview tab edits basics (name / generalInfo / salesStrategy / pricing). ICP, sales-channel, source, and predefined-prospect editing is **display-only in v1**; editing those nested collections comes in a follow-up.
- Telegram/WhatsApp messages that don't resolve to a product fall back to running the orchestrator directly without persistence. A "product selection" convention for channels is a future concern.
- Conversations started from `/chat` have no product; the orchestrator infers it from the text. A product picker in the `/chat` composer is a follow-up.

## Onboarding

A fresh deploy has an empty database except the platform admin created from `PLATFORM_ADMIN_*`. The admin creates an organization in `/platform` and invites its owner; the owner opens the invite link, sets a password, and completes the in-app wizard at `/onboarding` (3 steps: organization details → channels → first product). Progress is persisted as `organizations.onboarding_status` so reloads resume where you left off. Members without `org:update` see a "still being set up" screen until it completes.

- **Entities:** `Organization`, `User`, `Membership`, `ChannelCredential`.
- **Channel credentials** are stored encrypted at rest (AES-256-GCM, key = SHA-256 of `APP_SECRET_KEY`). The plaintext never leaves the server process; the API exposes only redacted `{ channel, configured, updatedAt }` views.
- **Telegram** credentials are validated via a live `getMe` call before being saved. **WhatsApp** credentials pass a shallow shape check (full validation happens on first outbound message).
- **State machine:** `pending → workspace_details → channels → first_product → completed` (`operator_profile` remains in the enum for old rows but is never set). Out-of-order submissions return `409 Conflict`. A user with no organization who submits `workspace-details` creates one and becomes its owner.
- **Reset:** `POST /api/onboarding/reset` (needs `org:update`) sets the organization back to `pending` and removes its channel credentials; products and members are kept. `POST /api/admin/demo-seed` (needs `products:write`) loads a demo product into the active organization.
- **Settings surface:** `GET /api/settings` → `{ organization, profile, channels }`; `PATCH /api/settings/organization` (`org:update`), `PATCH /api/settings/profile` (any member), `PUT/DELETE /api/settings/channels/:channel` (`channels:manage`). The web page `/settings` has Organization, Members (invite links, roles, reset links) and Profile tabs. Channel credentials saved here are encrypted and stored but the Telegram/WhatsApp services currently read tokens from env vars only.

## Environment Variables

```
ANTHROPIC_API_KEY             # required unless CLAUDE_CODE_USE_BEDROCK=1 (then AWS creds + Bedrock profile ids; see docs/deploy-aws-ec2.md §7)
CLAUDE_MODEL, CLAUDE_MODEL_HEAVY, CLAUDE_MODEL_FAST   # defaults in apps/api/src/config/models.ts
PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD   # required on first boot (no users yet); creates/promotes the platform admin
APP_PUBLIC_URL                # origin used in invite / reset links; defaults to https://$DOMAIN, then http://localhost:5173
APP_SECRET_KEY                # required, min 32 chars. Encrypts channel credentials at rest. `openssl rand -hex 32`
DATABASE_URL                  # postgresql://user:pass@host:port/db — required
DATABASE_SSL, DATABASE_SSL_REJECT_UNAUTHORIZED   # default false / true
DB_AUTO_MIGRATE               # default true — apply pending migrations at boot
MIKROORM_DEBUG                # true|false, default false
EXA_API_KEY                   # needed for discovery / enrichment / signals (fails at first use, not boot)
TAVILY_API_KEY, PERPLEXITY_API_KEY
TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET
WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET
SCHEDULES_ENABLED             # default false — loads the scheduler module + /api/schedules + the save_schedule tool
HOST, PORT, LOG_LEVEL         # LOG_LEVEL: debug | info | warn | error
```

## Slash Commands (`.claude/commands/`)

| Command | What it does |
|---------|-------------|
| `/generate-leads` | Full pipeline: discovery → enrichment → scoring → feedback for a product |
| `/check-signals` | Monitor Sources via Exa, classify + save new signals |
| `/draft-outreach` | Write channel-specific personalized outreach for a lead |
| `/feedback-review` | Aggregate Feedback Log — quality trends + ICP improvement suggestions |
| `/setup-schedule` | Create a recurring task delivered to Telegram/WhatsApp (**coming soon**: requires `SCHEDULES_ENABLED=true`) |

## Key Design Decisions

- **`BaseAgent` is the only place the Anthropic SDK is called** — every specialized agent inherits the tool-use loop. To add a new agent: extend `BaseAgent`, define `systemPrompt`, `tools[]`, and `executeTool()`.
- **Product knowledge is loaded via a single query.** `ProductsRepository.getProduct(name)` returns the Product with its ICP, sales channels, sources, and predefined prospects populated in one round-trip. There is no in-process cache (Postgres reads are fast).
- **Schedules are "coming soon"** — the scheduler is in-process cron (single instance only, no timezone handling) and is not loaded unless `SCHEDULES_ENABLED=true`. When enabled, `SchedulerService.onApplicationBootstrap` loads `enabled=true` schedules from Postgres and registers each `CronJob`; the orchestrator's `save_schedule` tool only persists a row (it does not live-register), and the web UI shows a placeholder page regardless of the flag.
- **Feedback is automatic** — `OrchestratorAgent` always calls `run_feedback` after prospect discovery and outreach. This is intentional and should not be removed.
- **Cron runs open their own ORM context** — `SchedulerService.runSchedule` wraps each fire in `RequestContext.create`, otherwise the global identity map would keep serving an organization's entitlements as first loaded.
- **Per-organization channels are a follow-up** — webhooks and the scheduler still use the deployment-wide Telegram/WhatsApp credentials from env; `ChatService.resolveOrgForSender` is the single hook to replace when sender→organization routing lands.
- **WhatsApp `chatId` == phone number** — Unlike Telegram, there is no separate chat ID.
- **Signals carry a review status** (`pending|approved|rejected|snoozed`, new rows default to `pending`); only approved signals feed buying intent (`get_signals_for_company`), the web dashboard counts pending ones, and `signal-monitor`'s dedupe still sees every status.
- **Lint/test are CI gates** — ESLint 9 flat configs live in each package (`eslint.config.mjs`, extending `packages/config/eslint/base.mjs`); API unit tests are pure (no DB, repositories stubbed) and run with `jest --passWithNoTests`. Tests that import an agent must `jest.mock('@anthropic-ai/claude-agent-sdk')` because the SDK ships as ESM. `.github/workflows/ci.yml` runs typecheck, lint, build, test and a Docker image build.
