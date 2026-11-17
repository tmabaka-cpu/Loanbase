# Fxchange

Point of sale and back office for licensed bureaux de change. Multi-tenant, built by Moneychaps (Pty) Ltd.

- **Specification:** [`docs/blueprint.md`](docs/blueprint.md)
- **Rules for AI-assisted work:** [`CLAUDE.md`](CLAUDE.md)
- **Build plan and prompts for each phase:** [`docs/KICKOFF.md`](docs/KICKOFF.md)

## Status

| Phase | State |
| --- | --- |
| 0. Foundation | Done |
| 1. Tenancy and access | Next |
| 2. Posting core | |
| 3. Trading | |
| 4. Accounts | |
| 5. Reports (pilot starts after this) | |
| 6. Compliance | |
| 7. Offline | |

## What you need

- Node.js 22 or later
- pnpm 10 (`npm install -g pnpm`)
- Docker, for the local PostgreSQL database

## First-time setup

```bash
pnpm install
cp .env.example .env
docker compose up -d        # start PostgreSQL
pnpm db:bootstrap           # create the database and its two roles (once)
pnpm db:migrate             # create or update the tables
```

## Everyday commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run the web application at http://localhost:3000 |
| `pnpm worker` | Run the background worker |
| `pnpm db:migrate` | Apply any new migrations |
| `pnpm test` | Run all tests against a real PostgreSQL database |
| `pnpm lint` | Check code style and the layer rules |
| `pnpm typecheck` | Check types |
| `pnpm check` | Lint, type-check and test in one go |
| `pnpm build` | Production build |

The tests need the PostgreSQL container running. They rebuild a separate database, `fxchange_test`, from the migrations on every run, so they never touch development data.

## How the code is laid out

```
migrations/        SQL files, the single source of truth for the database schema
src/domain/        Business rules. No web framework, database or worker imports (enforced by lint)
src/db/            Database client, tenant context, audit log, migration runner
src/worker/        Background job queue and jobs
src/app/           Web screens and API routes
scripts/           Command-line entry points
tests/             Tests that need the database
docs/              Blueprint and build plan
```

## Database roles

| Role | Used by | Can do |
| --- | --- | --- |
| superuser (`DATABASE_ADMIN_URL`) | `pnpm db:bootstrap` only | Create the roles and the database |
| `fxchange_owner` (`DATABASE_OWNER_URL`) | `pnpm db:migrate` only | Own and change the schema |
| `fxchange_app` (`DATABASE_URL`) | The application and the worker | Read and write rows that row-level security allows; cannot change the schema or bypass row-level security |

## Rules already enforced by the foundation

- **Tenant isolation in the database.** Every request runs inside `withContext` (`src/db/context.ts`), which sets the tenant for that transaction only. Row-level security refuses any other tenant's rows.
- **Append-only tables.** `app.forbid_change()` is a trigger that refuses UPDATE, DELETE and TRUNCATE. It is attached to `audit_log` and will be attached to every ledger table.
- **Audit log.** `writeAudit` (`src/db/audit.ts`) writes inside the caller's transaction, so an audit row commits or rolls back with the change it describes.
- **Fixed-point money.** `src/domain/money.ts` rounds half-up to 2 places for amounts and 6 for rates.

## Adding a migration

Add a new file to `migrations/` with the next number, for example `0002_tenancy.sql`. Never edit a migration that has already been applied anywhere. For every tenant-owned table: add `tenant_id`, enable and force row-level security, add policies using `app.current_tenant_id()`, and grant the application role only the privileges it needs.

## Continuous integration

`.github/workflows/ci.yml` runs lint, type-check, tests and the production build on every push and pull request.

## Deferred to the phase that first needs them

- Sign-in library (Better Auth): Phase 1.
- Screen styling (Tailwind and shadcn/ui): Phase 1, with the first real screens.
- Deployment and infrastructure as code: once the hosting region and provider are confirmed (blueprint section 13).
