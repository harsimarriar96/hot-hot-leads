# monorepo-structure

## Purpose

Defines the Turborepo workspace layout, task pipeline, and cross-package dependency rules for the HotHotLeads monorepo.

## Requirements

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

#### Scenario: DB package is scaffolded
- **WHEN** a developer inspects `packages/db`
- **THEN** it has a `package.json` and a `src/index.ts`, intended to hold the Postgres schema, entities, and repositories

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

### Requirement: Application behavior contract

The monorepo layout MUST preserve the public contracts of both apps. The API exposes `/health` and returns a JSON status payload, and the web app renders all user-facing routes it defined before the migration. Any future change that alters these contracts MUST go through its own OpenSpec proposal.

#### Scenario: Health endpoint responds
- **WHEN** the API is started and a `GET /health` request is made
- **THEN** the response is `200 OK` with a JSON body containing at least `{ "status": "ok" }`

#### Scenario: Web app root renders
- **WHEN** the web app is served and a browser loads the root URL
- **THEN** the React tree mounts without runtime errors
