## ADDED Requirements

### Requirement: Workspace layout

The repository SHALL follow a Turborepo workspace layout with exactly two directories containing packages: `apps/` for deployable applications and `packages/` for shared libraries. The root `package.json` SHALL declare `"workspaces": ["apps/*", "packages/*"]` and MUST NOT contain runtime application code.

#### Scenario: API app lives under apps/api
- **WHEN** a developer checks out the repo
- **THEN** the NestJS application source exists at `apps/api/src/` with its own `package.json`, `tsconfig.json`, and `nest-cli.json`

#### Scenario: Web app lives under apps/web
- **WHEN** a developer checks out the repo
- **THEN** the Vite React application source exists at `apps/web/src/` with its own `package.json`, `tsconfig.json`, and `vite.config.ts`

#### Scenario: No stray top-level app code
- **WHEN** a developer inspects the repo root
- **THEN** there is no `src/` directory at the repo root and no top-level `dist/` output

### Requirement: Shared packages scaffold

The workspace SHALL include three shared packages: `packages/types`, `packages/config`, and `packages/db`. Each package MUST have its own `package.json` with a scoped name under `@hothotleads/*` and MUST be importable from any app via its package name (not a relative path).

#### Scenario: Types package is importable from apps
- **WHEN** an app imports from `@hothotleads/types`
- **THEN** TypeScript resolves the import to `packages/types/src/index.ts` without additional path mapping per consumer

#### Scenario: Config package exports tsconfig and eslint bases
- **WHEN** an app extends `@hothotleads/config/tsconfig/base.json`
- **THEN** the extend resolves successfully and compiler options are inherited

#### Scenario: DB package is scaffolded empty
- **WHEN** this change is applied
- **THEN** `packages/db` exists with a `package.json` and an empty `src/index.ts`, ready to be populated by the Postgres migration change

### Requirement: Turborepo task pipeline

The workspace SHALL use Turborepo to orchestrate tasks. A `turbo.json` at the repo root MUST define pipeline entries for `build`, `dev`, `lint`, `typecheck`, `test`, and `start`. The `build` task MUST declare `dependsOn: ["^build"]` so that downstream apps rebuild their upstream package dependencies first.

#### Scenario: Running build from root builds apps and packages
- **WHEN** a developer runs `turbo run build` at the repo root
- **THEN** every workspace package with a `build` script executes, and packages depended on by apps build first

#### Scenario: Dev task runs both apps concurrently
- **WHEN** a developer runs `turbo run dev`
- **THEN** `apps/api` and `apps/web` both start in watch mode in parallel

#### Scenario: Typecheck runs across the workspace
- **WHEN** a developer runs `turbo run typecheck`
- **THEN** every package with a `typecheck` script runs and non-zero exit from any package fails the overall task

### Requirement: Cross-package dependency rules

Apps MAY depend on packages, but packages MUST NOT depend on apps. Apps MUST NOT import from sibling apps. Package-to-package dependencies MUST be declared explicitly in the consumer's `package.json` under `dependencies`.

#### Scenario: App-to-app import is prevented
- **WHEN** `apps/web` attempts to import from `apps/api`
- **THEN** TypeScript fails the build because `apps/api` is not listed as a dependency

#### Scenario: Package importing an app is prevented
- **WHEN** `packages/types` adds `@hothotleads/api` as a dependency
- **THEN** this is rejected in code review as it violates the dependency direction rule (documented in the root README)

### Requirement: Preserved application behavior

This change MUST NOT alter runtime behavior of either app. All existing NestJS routes, agent behavior, channel webhooks, and web UI routes MUST remain functional with the same request/response contracts after the move.

#### Scenario: Health endpoint still responds after move
- **WHEN** the API is started via `turbo run dev` and a `GET /health` request is made
- **THEN** the response is identical to the pre-change response

#### Scenario: Web app renders the same pages
- **WHEN** the web app is started via `turbo run dev`
- **THEN** every route that existed before the move renders the same top-level component tree
