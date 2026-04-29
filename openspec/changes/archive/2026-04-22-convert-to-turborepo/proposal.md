## Why

The codebase currently has two separate top-level Node projects (`/` for the NestJS API, `/web` for the Vite React app) with no shared tooling, no shared types, and two independent `node_modules` trees. Onboarding, Postgres migration, and product-chat work coming next will all introduce shared contracts (DB entities, DTOs, channel payloads) between the API and the web app. Without a monorepo we'll either duplicate those types or build fragile cross-package imports. Turborepo also gives us cached task orchestration across `build`, `lint`, `typecheck`, and `test`, which matters once we have 2+ apps and 3+ packages.

## What Changes

- **BREAKING**: Move the existing NestJS app from the repo root into `apps/api/`.
- **BREAKING**: Move the existing Vite React app from `/web/` into `apps/web/`.
- Introduce a root `package.json` with `workspaces: ["apps/*", "packages/*"]` and `turbo` as a devDependency.
- Add `turbo.json` with pipeline entries for `build`, `dev`, `lint`, `typecheck`, `test`, and `start`.
- Create three shared packages as empty scaffolds (filled by later changes):
  - `packages/types` — shared TypeScript types currently duplicated between API and web.
  - `packages/config` — shared ESLint, Prettier, and TSConfig base files.
  - `packages/db` — placeholder for the Postgres schema + MikroORM entities (populated by the Postgres migration change).
- Replace root-level `npm run *` scripts with Turborepo-driven equivalents (`turbo run dev`, `turbo run build`, etc.).
- Keep all agent code, channel code, and web UI behavior byte-identical — only paths and tooling move.

## Capabilities

### New Capabilities
- `monorepo-structure`: Defines the package layout, task pipeline, and cross-package dependency rules for the Turborepo workspace.

### Modified Capabilities
<!-- None — no prior specs exist. -->

## Impact

- **Code**: every file under `src/` moves to `apps/api/src/`; every file under `web/` moves to `apps/web/`. Import paths inside each app are unchanged.
- **Tooling**: root `package.json`, root `tsconfig.json`, and `nest-cli.json` are rewritten. The `dist/` directory at repo root is no longer produced — builds emit under `apps/api/dist/`.
- **CI and scripts**: any external caller (CI, Dockerfile, deploy script) that runs `npm run build` or `node dist/main` at repo root breaks and must be updated to the new commands.
- **CLAUDE.md**: the "Architecture" section must be updated to reflect the new layout. This change is responsible for that update.
- **Dependencies**: adds `turbo` at the root. No runtime dependencies change.
- **Out of scope**: Postgres migration, MikroORM setup, onboarding flow, product-chat feature — each handled by a separate OpenSpec change.
