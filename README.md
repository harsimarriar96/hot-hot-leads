<p align="left">
  <img src="apps/web/public/logo.svg" alt="HotHotLeads" height="64" />
</p>

# HotHotLeads

AI-led GTM (Go-To-Market) engineering engine powered by Claude. It discovers, enriches and
scores leads, drafts outreach, and monitors buying signals through a NestJS + Claude
multi-agent pipeline, controlled from a web UI and (optionally) Telegram or WhatsApp.

Everything is stored in Postgres. One deployment hosts many organizations: users sign in with
their own account, belong to organizations with a role, and a platform admin decides which
features and limits each organization gets.

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

Open http://localhost:5173 and sign in with `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD`.
Create an organization in the Platform console, invite its owner (you get a link to share; no
email is sent), open the link in a private window, set a password and complete the three-step
onboarding wizard (organization → channels → first product). Migrations run automatically when
the API boots.

Other commands:

```bash
npx turbo run typecheck lint build test       # what CI runs
npm --workspace @hothotleads/api run test:single -- src/modules/auth/auth.guard.spec.ts
npm --workspace @hothotleads/db run db:migrate:create   # after changing an entity
```

## Configuration

All settings are environment variables, read by the API. See
[apps/api/.env.example](apps/api/.env.example) for the full annotated list.

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes, unless Bedrock | Used by the Claude Agent SDK subprocess for every agent run. Alternatively set `CLAUDE_CODE_USE_BEDROCK=1` and use AWS credentials (see the deploy guide). |
| `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD` | first boot | Creates (or promotes) the platform admin. The password is applied only to an account that has none. |
| `APP_PUBLIC_URL` | recommended | Origin used in invite and password-reset links (defaults to `https://$DOMAIN`, then `http://localhost:5173`). |
| `APP_SECRET_KEY` | yes | 32+ chars. Encrypts stored channel credentials at rest. |
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
| Accounts, organizations, roles (owner/admin/member/viewer) | Working |
| Per-organization entitlements (features, limits, channels) via the Platform console | Working |
| Invitations and password resets | Working as copy-link (no outbound email) |
| Telegram / WhatsApp channels | Working; secrets required |
| **Schedules (recurring tasks)** | **Coming soon.** The scheduler is single-instance in-process cron and is disabled by default (`SCHEDULES_ENABLED=false`). The UI shows a placeholder. |
| Per-organization Telegram/WhatsApp bots | Not yet; channels are deployment-wide and route to the only organization |
| Channel credentials entered in Settings | Stored encrypted but channels currently read tokens from environment variables |

## Security notes

- Set `PLATFORM_ADMIN_*`, `APP_SECRET_KEY` and the channel secrets before exposing a deploy.
- Passwords are scrypt-hashed; sessions are opaque tokens stored as hashes with a 30-day sliding expiry. Changing a password signs out that user's other sessions.
- Invite and reset links are single-use and expire (7 days / 72 hours); only the admin who generated one sees it.
- See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## Further reading

- [CLAUDE.md](CLAUDE.md) — orientation for Claude Code working in this repo
- [CONTRIBUTING.md](CONTRIBUTING.md)
- `openspec/` — spec-driven change proposals and archive

## License

MIT — see [LICENSE](LICENSE).
