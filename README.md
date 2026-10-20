<p align="left">
  <img src="apps/web/public/logo.svg" alt="HotHotLeads" height="64" />
</p>

# HotHotLeads

AI-led GTM (Go-To-Market) engineering engine powered by Claude. It discovers, enriches and
scores leads, drafts outreach, and monitors buying signals through a NestJS + Claude
multi-agent pipeline, controlled from a web UI and (optionally) Telegram or WhatsApp.

Everything is stored in Postgres. One deployment serves one workspace (single tenant).

## Workspace layout

Turborepo monorepo:

```
apps/
  api/      # NestJS API + agent orchestration; also serves the built web UI  (@hothotleads/api)
  web/      # Vite + React operator UI                                        (@hothotleads/web)
packages/
  config/   # Shared TSConfig / ESLint / Prettier bases                       (@hothotleads/config)
  types/    # Shared domain types                                             (@hothotleads/types)
  db/       # Postgres schema, MikroORM entities, repositories, migrations    (@hothotleads/db)
docs/       # Deployment guides
```

Apps may depend on packages; packages never depend on apps.

## Quickstart (local)

Prerequisites: Node 20+, Docker.

```bash
npm install
docker compose up -d postgres                 # Postgres 16 on localhost:5434
cp apps/api/.env.example apps/api/.env        # then fill in the required values below
npx turbo run dev                             # API on http://localhost:3000, web on http://localhost:5173
```

Open http://localhost:5173, sign in with `APP_AUTH_PASSWORD`, and complete the four-step
onboarding wizard (workspace → operator → channels → first product). Migrations run
automatically when the API boots.

Other commands:

```bash
npx turbo run typecheck lint build test       # what CI runs
npm --workspace @hothotleads/api run test:single -- src/modules/auth/auth.service.spec.ts
npm --workspace @hothotleads/db run db:migrate:create   # after changing an entity
```

## Configuration

All settings are environment variables, read by the API. See
[apps/api/.env.example](apps/api/.env.example) for the full annotated list.

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Used by the Claude Agent SDK subprocess for every agent run. |
| `APP_AUTH_PASSWORD` | yes | Shared password for the web UI sign-in. |
| `APP_SECRET_KEY` | yes | 32+ chars. Encrypts stored channel credentials and keys the sign-in token. |
| `DATABASE_URL` | yes | Postgres connection string. |
| `EXA_API_KEY` | for research | Prospect discovery, enrichment and signal monitoring call Exa. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | optional | Telegram channel. Webhooks are rejected while the secret is empty. |
| `WHATSAPP_*` incl. `WHATSAPP_APP_SECRET` | optional | WhatsApp Cloud API channel. Webhooks are rejected while the app secret is empty. |
| `CLAUDE_MODEL`, `CLAUDE_MODEL_HEAVY`, `CLAUDE_MODEL_FAST` | optional | Model ids per tier (defaults in `apps/api/src/config/models.ts`). |
| `SCHEDULES_ENABLED` | optional | `false` by default; see Status. |
| `DB_AUTO_MIGRATE`, `DATABASE_SSL`, `LOG_LEVEL`, `PORT` | optional | Operational knobs. |

## How it works

- **Agents.** `BaseAgent` wraps the Claude Agent SDK tool-use loop. The `OrchestratorAgent`
  parses intent, loads product context and routes to specialists (discovery, enrichment,
  scoring, outreach, signal monitoring, buying intent). A `FeedbackAgent` scores every
  significant output and stores it, so quality trends are visible on the dashboard.
- **HTTP API.** Every route lives under `/api` and requires `Authorization: Bearer <token>`
  obtained from `POST /api/auth/login { password }`. Exceptions: `GET /health` and the
  `/webhooks/*` endpoints, which authenticate with their own channel secrets.
- **Web UI.** Served by the API from `apps/web/dist` in production; the Vite dev server
  proxies `/api` during development.
- **Product chat.** `POST /api/products/:id/chat/messages` streams Server-Sent Events while
  the orchestrator runs. Telegram and WhatsApp messages land in the same per-product thread.

## Deploy

The supported production setup is a single host running `docker compose -f docker-compose.prod.yml`
(Postgres + API + Caddy for automatic HTTPS). See [docs/deploy-aws-ec2.md](docs/deploy-aws-ec2.md).

```bash
cp .env.example .env && chmod 600 .env       # fill in secrets
docker compose -f docker-compose.prod.yml up -d --build
```

## Status

| Area | State |
|---|---|
| Products, ICP, leads, outreach, signals, feedback, dashboard | Working |
| Web sign-in (shared password) | Working |
| Telegram / WhatsApp channels | Working; secrets required |
| **Schedules (recurring tasks)** | **Coming soon.** The scheduler is single-instance in-process cron and is disabled by default (`SCHEDULES_ENABLED=false`). The UI shows a placeholder. |
| Multi-tenant / multiple workspaces | Not planned; deploy one stack per customer |
| Channel credentials entered in Settings | Stored encrypted but channels currently read tokens from environment variables |

## Security notes

- Set `APP_AUTH_PASSWORD`, `APP_SECRET_KEY` and the channel secrets before exposing a deploy.
- Rotating `APP_AUTH_PASSWORD` or `APP_SECRET_KEY` signs out every browser session.
- See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## Further reading

- [CLAUDE.md](CLAUDE.md) — orientation for Claude Code working in this repo
- [CONTRIBUTING.md](CONTRIBUTING.md)
- `openspec/` — spec-driven change proposals and archive

## License

MIT — see [LICENSE](LICENSE).
