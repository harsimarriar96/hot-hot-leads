# HotHotLeads

AI-led GTM (Go-To-Market) Engineering engine powered by Claude. Discovers, enriches, scores leads and drafts outreach via a NestJS + Claude multi-agent pipeline, controlled from a web UI and Telegram/WhatsApp.

## Workspace layout

This repo is a Turborepo monorepo.

```
apps/
  api/      # NestJS API + agent orchestration  (@hothotleads/api)
  web/      # Vite + React operator UI          (@hothotleads/web)

packages/
  config/   # Shared TSConfig / ESLint / Prettier bases  (@hothotleads/config)
  types/    # Shared domain types                         (@hothotleads/types)
  db/       # Postgres schema + entities + repositories   (@hothotleads/db)

turbo.json  # pipeline: build, dev, lint, typecheck, test, start
```

**Dependency rule:** apps may depend on packages; packages must not depend on apps; apps must not import from sibling apps.

## Quickstart

```bash
# Install workspace deps (single node_modules at the repo root)
npm install

# One-time: start Postgres and apply migrations
docker compose up -d postgres
npm --workspace @hothotleads/db run db:migrate

# Run both apps in watch mode
npx turbo run dev

# Or just one:
npx turbo run dev --filter=@hothotleads/api
npx turbo run dev --filter=@hothotleads/web

# Type-check / build / lint / test across the whole workspace
npx turbo run typecheck
npx turbo run build
npx turbo run lint
npx turbo run test
```

## Environment

Runtime env is read from `apps/api/.env`. See `apps/api/.env.example` for the full list.

## Further reading

- `CLAUDE.md` — instructions for Claude Code working in this repo
- `openspec/changes/` — proposed and in-flight changes (spec-driven)
- `TECHNICAL_SPEC.md` — original design doc
