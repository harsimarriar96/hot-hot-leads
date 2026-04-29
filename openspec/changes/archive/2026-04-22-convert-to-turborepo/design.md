## Context

Today the repo has two independent Node projects that share no tooling: a NestJS API at the root and a Vite React app under `/web`. They have duplicated ESLint, Prettier, and TSConfig, and separate `node_modules`. No shared types exist — both sides redefine types like `Lead` and `Product`.

Three incoming changes (Postgres migration, onboarding flow, product chats) all add contracts that must cross the API/web boundary (entity types, DTOs, chat message schemas). Continuing with two siloed projects forces us to either duplicate those types or reach across a relative `../../src/...` import, both of which have bitten this team before.

Turborepo gives us: (a) a single `node_modules` tree via npm workspaces, (b) typed package boundaries via `@hothotleads/*` scopes, and (c) cached task orchestration so `turbo run typecheck` skips packages whose inputs haven't changed.

## Goals / Non-Goals

**Goals:**
- Single workspace with `apps/api`, `apps/web`, and three shared packages (`types`, `config`, `db`).
- One `package-lock.json` at the repo root; one install.
- All existing API routes and web pages functional and byte-equivalent after the move.
- Turborepo pipeline that runs `dev`, `build`, `lint`, `typecheck`, `test`, `start` across the workspace with correct topological ordering.
- Shared TSConfig, ESLint, and Prettier bases living in `packages/config`, extended by both apps.

**Non-Goals:**
- Introducing pnpm or yarn — npm workspaces are sufficient and keep CI simple.
- Changing any runtime behavior, agent prompts, channel integrations, or web routes.
- Populating `packages/db` with entities — that is the Postgres migration change's job.
- Adding CI configuration, Docker changes, or deploy scripts — handled separately once all four changes land.
- Introducing Nx, Rush, or other monorepo tools.

## Decisions

### 1. Turborepo + npm workspaces (not pnpm, not Nx)

Turborepo is the lightest-weight option that satisfies the requirements: task orchestration with caching, no framework lock-in, tiny config surface. npm workspaces pair cleanly with it and avoid introducing a new package manager to the team.

**Alternatives considered:**
- *pnpm workspaces* — stricter dependency isolation, but requires team-wide pnpm install and breaks existing `npm` muscle memory.
- *Nx* — too heavy; its plugin/generator model is overkill for two apps.
- *Single-package with path aliases* — fastest to adopt, but doesn't give us true package boundaries and the types-dup problem returns immediately.

### 2. `@hothotleads/*` scope for internal packages

All shared packages use the scope `@hothotleads/*` (e.g., `@hothotleads/types`, `@hothotleads/db`, `@hothotleads/config`). This makes cross-package imports unambiguous in IDEs, grep, and diffs, and avoids collisions with public npm packages.

### 3. Apps consume packages via `workspace:*` protocol

Each app lists shared packages under `dependencies` as `"@hothotleads/types": "*"`. npm workspaces resolves these via symlinks into `node_modules` at install time, so no build step is required to make shared packages importable during development.

### 4. Shared packages ship compiled output and types via `exports`

Each shared package's `package.json` declares:
```json
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } }
}
```
This avoids consumers having to transpile our source and keeps the contract explicit. `turbo run build` handles the ordering.

### 5. TSConfig inheritance via `packages/config`

A single `packages/config/tsconfig/base.json` sets strict mode, target, and lib. `apps/api/tsconfig.json` extends `@hothotleads/config/tsconfig/nest.json` which extends base and adds NestJS-specific settings. `apps/web/tsconfig.json` extends `@hothotleads/config/tsconfig/vite.json`. Shared packages extend `@hothotleads/config/tsconfig/library.json` with `composite: true` for project references if needed later.

### 6. Web app stays on Vite; API stays on Nest CLI

Turborepo orchestrates but does not replace build tools. `apps/api` still builds with `nest build`, `apps/web` still builds with `vite build`. This keeps the blast radius small and lets us defer any bundler changes.

### 7. Nest CLI output directory becomes `apps/api/dist`

`nest-cli.json` is moved into `apps/api/` and its `compilerOptions.tsConfigPath` updated accordingly. The `main` entry in `apps/api/package.json` becomes `dist/main.js`. Consumers that previously ran `node dist/main` must now run `node apps/api/dist/main` (or `npm --workspace apps/api run start:prod`).

### 8. Keep `reflect-metadata` and NestJS at the app level, not root

Runtime dependencies like `@nestjs/*`, `reflect-metadata`, `@anthropic-ai/sdk`, `@notionhq/client`, `exa-js`, `axios`, `winston`, `rxjs` move with the API into `apps/api/package.json`. React, Radix, TanStack Query, etc. move with the web app. Only `turbo` and true devtime-root things (Prettier, top-level ESLint config if any) live at the root.

## Risks / Trade-offs

- **Deploy scripts break silently** → Mitigation: search the repo (Dockerfile, CI configs, deploy/ shell scripts) for `node dist/main`, `npm run build`, and `cd web`; update each to the workspace-aware equivalent as part of the same PR. Document the new commands in `README.md` and `CLAUDE.md`.
- **IDE confusion from two `tsconfig.json`s** → Mitigation: keep project references out of scope for this change; rely on each app's local tsconfig. Revisit if type-check performance degrades.
- **npm workspaces hoisting surprises** (a dep installed at the root leaking into apps) → Mitigation: avoid installing runtime deps at the root. Add a CI check later that fails if `package.json` at the root has a non-dev runtime dep.
- **`dist/` at root in git history** → Mitigation: ensure the root `dist/` directory is deleted and `.gitignore` updated to ignore `apps/*/dist` and `packages/*/dist`.
- **Developers running old `npm run start:dev` at root** → Mitigation: replace root scripts with thin pass-throughs to `turbo run dev --filter=@hothotleads/api` etc. so old commands still work during the transition.

## Migration Plan

1. Create `apps/` and `packages/` directories.
2. Move `src/`, `test/`, `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`, and the API's runtime dependencies into `apps/api/`. Create `apps/api/package.json`.
3. Move `web/*` into `apps/web/`. Flatten so `apps/web/package.json` replaces the current `web/package.json`.
4. Scaffold `packages/types`, `packages/config`, `packages/db` with minimal `package.json` + `src/index.ts`.
5. Rewrite the root `package.json` to expose workspaces and turbo scripts only.
6. Write `turbo.json` with the pipeline defined in the spec.
7. Delete the old root `node_modules`, root `dist/`, and `web/node_modules`. Run `npm install` at the root.
8. Verify: `turbo run typecheck`, `turbo run build`, `turbo run dev` (smoke test both apps).
9. Update `CLAUDE.md` Architecture section and `README.md` commands to match.

**Rollback:** if workspace install fails or types resolution breaks, revert the single commit. No data is migrated and no external system is touched, so rollback is cheap.

## Open Questions

- Should we enable Turborepo remote caching (Vercel) now, or defer? **Proposed**: defer until after all four changes land.
- Should shared packages be published to a private registry eventually? **Proposed**: no — keep them workspace-only; publishing adds ceremony without clear value today.
