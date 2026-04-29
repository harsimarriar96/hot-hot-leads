## 1. Prepare workspace scaffold

- [x] 1.1 Create `apps/` and `packages/` directories at the repo root
- [x] 1.2 Add `turbo` as a devDependency in a new root `package.json` declaring `"workspaces": ["apps/*", "packages/*"]`
- [x] 1.3 Write `turbo.json` with pipeline entries for `build`, `dev`, `lint`, `typecheck`, `test`, `start` (build has `dependsOn: ["^build"]`; dev has `cache: false`, `persistent: true`)
- [x] 1.4 Update root `.gitignore` to include `apps/*/dist`, `packages/*/dist`, `.turbo`, and remove the obsolete root `dist/` entry if present
- [x] 1.5 Add thin pass-through scripts to the root `package.json`: `dev`, `build`, `lint`, `typecheck`, `test`, `start` — each delegates to `turbo run <task>`

## 2. Move the API into apps/api

- [x] 2.1 Create `apps/api/package.json` named `@hothotleads/api` with the current API runtime dependencies (`@nestjs/*`, `@anthropic-ai/*`, `@notionhq/client`, `axios`, `class-transformer`, `class-validator`, `exa-js`, `nest-winston`, `reflect-metadata`, `rxjs`, `winston`) and devDependencies (`@nestjs/cli`, `@nestjs/testing`, `@types/*`, `ts-*`, `jest`, etc.)
- [x] 2.2 Move `src/` → `apps/api/src/`
- [x] 2.3 Move `test/` → `apps/api/test/` (if present)
- [x] 2.4 Move `nest-cli.json` → `apps/api/nest-cli.json`; verify paths inside still resolve
- [x] 2.5 Move `tsconfig.json` and `tsconfig.build.json` → `apps/api/`
- [x] 2.6 Add scripts to `apps/api/package.json`: `dev` (`nest start --watch`), `build` (`nest build`), `start` (`node dist/main`), `lint`, `typecheck` (`tsc --noEmit`), `test` (`jest`)
- [x] 2.7 Remove now-obsolete root `dist/`, root `src/`, root `test/`, root `nest-cli.json`, root `tsconfig.json`, `tsconfig.build.json`
- [x] 2.8 Smoke-test: from repo root run `npm install`, then `turbo run build --filter=@hothotleads/api` and `turbo run dev --filter=@hothotleads/api`; confirm `GET /health` responds

## 3. Move the web app into apps/web

- [x] 3.1 Move `web/*` → `apps/web/*`
- [x] 3.2 Rename the package in `apps/web/package.json` to `@hothotleads/web`
- [x] 3.3 Ensure `apps/web/package.json` includes scripts: `dev`, `build`, `preview`, `lint`, `typecheck`
- [x] 3.4 Delete the now-empty `web/` directory and its lockfile/node_modules
- [x] 3.5 Smoke-test: `turbo run dev --filter=@hothotleads/web` serves the UI on its dev port and every pre-existing route renders

## 4. Scaffold shared packages

- [x] 4.1 Create `packages/types/package.json` as `@hothotleads/types` with `main`/`types`/`exports` pointing to `dist/index.{js,d.ts}` and a `build` script using `tsc`
- [x] 4.2 Create `packages/types/src/index.ts` exporting an empty re-export barrel (to be populated by later changes)
- [x] 4.3 Create `packages/config/package.json` as `@hothotleads/config` with `exports` for `./tsconfig/base.json`, `./tsconfig/nest.json`, `./tsconfig/vite.json`, `./tsconfig/library.json`, `./eslint/base.js`, and `./prettier/index.js`
- [x] 4.4 Author the TSConfig bases in `packages/config/tsconfig/` (base.json with strict mode; nest.json and vite.json extending it; library.json for packages)
- [x] 4.5 Move the current root ESLint and Prettier configs into `packages/config/eslint/` and `packages/config/prettier/`
- [x] 4.6 Create `packages/db/package.json` as `@hothotleads/db` with the same exports shape as `packages/types`, and an empty `src/index.ts` (populated by the Postgres migration change)
- [x] 4.7 Update `apps/api/tsconfig.json` to extend `@hothotleads/config/tsconfig/nest.json`
- [x] 4.8 Update `apps/web/tsconfig.json` to extend `@hothotleads/config/tsconfig/vite.json`
- [x] 4.9 Update `apps/api/package.json` and `apps/web/package.json` ESLint configs to extend `@hothotleads/config/eslint/base.js`
- [x] 4.10 Add `@hothotleads/config` and `@hothotleads/types` to `apps/api/package.json` and `apps/web/package.json` dependencies as `"*"`

## 5. Enforce boundaries and verify

- [x] 5.1 Add a root `README.md` section (or update) documenting the workspace layout and the app→package dependency rule
- [x] 5.2 Run `turbo run typecheck` at the root — all workspaces pass
- [x] 5.3 Run `turbo run build` at the root — build order is correct (packages before apps) and both apps produce `dist/`
- [x] 5.4 Run `turbo run lint` at the root — zero errors
- [x] 5.5 Confirm `apps/web` cannot import from `apps/api`: attempt the import locally, confirm TS rejects it, then revert
- [x] 5.6 Verify a single `package-lock.json` exists at the repo root and no stray lockfiles remain inside `apps/*` or `packages/*`

## 6. Update documentation

- [x] 6.1 Rewrite the "Architecture" section in `CLAUDE.md` to reflect `apps/` and `packages/` layout
- [x] 6.2 Replace the "Commands" section in `CLAUDE.md` with Turborepo equivalents (`turbo run dev`, `turbo run build`, `turbo run typecheck`, workspace-filtered test commands)
- [x] 6.3 Update any README, Dockerfile, or script references that assumed the old layout (search for `node dist/main`, `npm run start:dev`, `cd web`)
