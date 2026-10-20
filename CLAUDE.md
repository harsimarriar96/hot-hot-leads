# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**HotHotLeads** is an AI-led GTM (Go-To-Market) Engineering engine built on NestJS + Claude. It:
- Reads and writes product knowledge (ICP, strategy, channels, pricing) in a **Postgres** database managed via MikroORM in [packages/db](packages/db/)
- Discovers, enriches, scores leads and drafts outreach using **Claude multi-agent pipelines**
- Monitors GTM signals via **Exa** web research
- Is controlled via a web UI plus **Telegram** and **WhatsApp** (on demand; scheduled runs are gated behind `SCHEDULES_ENABLED`, see below)
- Persists all output (leads, outreach, signals, feedback) in Postgres

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
npm --workspace @hothotleads/api run test:single -- src/modules/auth/auth.service.spec.ts

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
│       ├── modules/auth/           # Shared-password auth: global bearer guard + @Public()
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
Product (root of the GTM domain)
├── ProductIcp                 1:1  — target industries, sizes, funding stages, geographies, notes
├── ProductSalesChannel        1:N  — named outreach channels with templates
├── ProductSource              1:N  — signal sources (news, social, databases…)
├── PredefinedProspect         1:N  — seed companies for prospect discovery
├── Lead                       1:N
│     └── OutreachDraft        1:N  — drafts per lead, multiple channels
├── Signal                     1:N  — buying intent / hiring / activity signals
├── Schedule                   1:N  — recurring tasks delivered via Telegram/WhatsApp
└── FeedbackEntry              1:N  — agent quality scores
```

Product-owned tables cascade on delete. `leads(product_id, domain)` has a partial unique index (only when `domain IS NOT NULL`) to prevent dupes. UUID primary keys come from `pgcrypto.gen_random_uuid()`.

Repositories in [packages/db/src/repositories/](packages/db/src/repositories/) wrap the `EntityManager` — `ProductsRepository`, `LeadsRepository`, `SignalsRepository`, `SchedulesRepository`, `FeedbackRepository`. Apps consume them as Nest providers via [apps/api/src/db/db.module.ts](apps/api/src/db/db.module.ts).

## Local dev — database

```bash
docker compose up -d postgres                           # Postgres 16 on localhost:5434
npm --workspace @hothotleads/db run db:migrate          # apply migrations
```

The API fails fast at boot if `DATABASE_URL` is missing or unreachable.

## HTTP API conventions

- **Every route is under `/api`** (`app.setGlobalPrefix('api')` in `main.ts`). Controllers declare paths without the prefix (`@Controller('products')` → `/api/products`). Only `/health` and `/webhooks/*` are excluded so externally configured webhooks keep their URLs.
- **Auth:** `POST /api/auth/login { password }` (compared with `APP_AUTH_PASSWORD`) returns a stateless bearer token derived from `APP_SECRET_KEY` + the password. A global `AuthGuard` (`APP_GUARD`) requires `Authorization: Bearer <token>` on every route unless the controller or handler is decorated with `@Public()` (health, webhooks, login). Rotating either secret invalidates all sessions. Five failed logins per IP lock the address for 15 minutes.
- **Web client:** all requests go through `apps/web/src/lib/http.ts` (`apiFetch` / `apiJson`), which attaches the token and signs the user out on a 401. Do not call `fetch` directly from components. `App.tsx` gates: login → onboarding → app.
- **Webhooks:** Telegram requests must carry `X-Telegram-Bot-Api-Secret-Token` equal to `TELEGRAM_WEBHOOK_SECRET`; WhatsApp requests must carry a valid `X-Hub-Signature-256` (HMAC of the raw body with `WHATSAPP_APP_SECRET`). Both are rejected while their secret is empty.
- **SPA serving:** `ServeStaticModule` serves `apps/web/dist` for every non-API path, so browser reloads on client routes work in production.

## Product chats

Each product has a single, persistent chat thread rooted on `product_chats` + `product_chat_messages`. Messages are append-only and store Anthropic-shaped `content_blocks` (text / tool_use / tool_result) as JSONB.

- **Web chat surface:** `/products/:productId` Chat tab. `POST /api/products/:productId/chat/messages` returns Server-Sent Events (`message_start`, `text_delta`, `tool_use_start`, `tool_use_result`, `message_done`, `error`). The client renders text incrementally and discloses tool calls inline.
- **Streaming agent:** [BaseAgent.runStream](apps/api/src/agents/base/base.agent.ts) maps the Claude Agent SDK's async iterator into the event types above. Non-streaming `run()` is a thin wrapper that drains the generator.
- **Channel sync:** `ChatService.handleIncoming` is used by both Telegram and WhatsApp handlers. When `workspaces.sync_channel_chats = true` (default) and a product is resolved, the channel exchange is persisted to the same product thread with `source_channel` set to `telegram` or `whatsapp`.
- **Product management:** `/api/products` — list / get / create / patch / delete. Delete cascades to leads, outreach drafts, signals, schedules, feedback, and chat messages via the DB FKs.
- **Client disconnect:** the SSE handler continues the orchestrator run to completion even if the client aborts mid-stream, so the assistant message is always persisted in full. A subsequent `GET /api/products/:productId/chat` shows the complete reply.

### Known scope calls

- The Overview tab edits basics (name / generalInfo / salesStrategy / pricing). ICP, sales-channel, source, and predefined-prospect editing is **display-only in v1**; editing those nested collections comes in a follow-up.
- Telegram/WhatsApp messages that don't resolve to a product fall back to running the orchestrator directly without persistence. A "product selection" convention for channels is a future concern.

## Onboarding

A fresh deploy has an empty database. After signing in with `APP_AUTH_PASSWORD`, the operator bootstraps the system via an in-app wizard at `/onboarding` (4 steps: workspace details → operator profile → channels → first product). Progress is persisted as `workspaces.onboarding_status` so reloads resume where you left off.

- **Entities:** `Workspace` (singleton, enforced by a unique partial index on `singleton = TRUE`), `Operator`, `ChannelCredential`.
- **Channel credentials** are stored encrypted at rest (AES-256-GCM, key = SHA-256 of `APP_SECRET_KEY`). The plaintext never leaves the server process; the API exposes only redacted `{ channel, configured, updatedAt }` views.
- **Telegram** credentials are validated via a live `getMe` call before being saved. **WhatsApp** credentials pass a shallow shape check (full validation happens on first outbound message).
- **State machine:** `pending → workspace_details → operator_profile → channels → first_product → completed`. Out-of-order submissions return `409 Conflict`.
- **Admin reset:** `POST /api/onboarding/reset` (bearer auth, like every other route) wipes the workspace + operator + channel rows. Not exposed in the web UI by design. `POST /api/admin/demo-seed` loads a demo scenario the same way.
- **Settings surface:** after onboarding, edits go through `GET/PATCH /api/settings` and the corresponding web page at `/settings`. Channel credentials saved here are encrypted and stored but the Telegram/WhatsApp services currently read tokens from env vars only.

## Environment Variables

```
ANTHROPIC_API_KEY             # required — the Claude Agent SDK CLI subprocess inherits it from the environment
CLAUDE_MODEL, CLAUDE_MODEL_HEAVY, CLAUDE_MODEL_FAST   # defaults in apps/api/src/config/models.ts
APP_AUTH_PASSWORD             # required — web UI sign-in password
APP_SECRET_KEY                # required, min 32 chars. Encrypts channel credentials + keys the sign-in token. `openssl rand -hex 32`
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
- **WhatsApp `chatId` == phone number** — Unlike Telegram, there is no separate chat ID.
- **Lint/test are CI gates** — ESLint 9 flat configs live in each package (`eslint.config.mjs`, extending `packages/config/eslint/base.mjs`); API unit tests are pure (no DB) and run with `jest --passWithNoTests`. `.github/workflows/ci.yml` runs typecheck, lint, build, test and a Docker image build.
