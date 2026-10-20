# Contributing

```bash
npm install
docker compose up -d postgres
cp apps/api/.env.example apps/api/.env   # fill in ANTHROPIC_API_KEY, APP_AUTH_PASSWORD, APP_SECRET_KEY
npx turbo run dev                        # API on :3000, web on :5173
```

Before opening a pull request:

```bash
npx turbo run typecheck lint build test
```

- Keep changes focused; one topic per PR.
- New API routes live under `/api` (the global prefix) and are protected by the bearer guard
  unless decorated with `@Public()`.
- Schema changes need a migration: `npm --workspace @hothotleads/db run db:migrate:create`.
- Do not commit `.env` files, customer data or credentials.
