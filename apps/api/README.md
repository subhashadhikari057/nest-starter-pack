# bullhouse API (NestJS)

NestJS backend for bullhouse.

Read the migration guide: `apps/api/MIGRATION.md`.

## Quick Start

```bash
pnpm install
pnpm --filter @bullhouse/api build
pnpm --filter @bullhouse/api start
```

## Runtime Profiles

`API_RUNTIME_PROFILE` controls optional startup behavior.

- `full` (default): existing behavior, full feature set.
- `fast`: disables non-essential startup costs currently proven safe:
  - Bull Board UI route registration (`/admin/queues`)
  - Scheduler bootstrap (`ScheduleModule.forRoot()`)

No API route contract changes are intended in `full` mode.

## Swagger Boot Policy

Swagger is env-controlled and backward compatible by default.

- `SWAGGER_ENABLED=true|false` (default: `true`)
- `SWAGGER_BOOT_MODE=eager|disabled` (default: `eager`)

Effective behavior:

- `true + eager` => Swagger docs boot at startup (default)
- `false` or `disabled` => Swagger docs are not mounted
- If Swagger generation throws at boot, API startup continues and docs stay disabled for that run.

## Scripts

From `apps/api` (or use `pnpm --filter @bullhouse/api <script>` from repo root):

- `pnpm run build` - SWC build (`nest build --builder swc`)
- `pnpm run build:swc` - Explicit SWC build alias
- `pnpm run build:tsc` - Explicit TypeScript builder
- `pnpm run dev` - SWC watch dev loop
- `pnpm run dev:swc` - Explicit SWC watch alias
- `pnpm run dev:fast` - Fast local mode (`SWAGGER_ENABLED=false API_RUNTIME_PROFILE=fast`)
- `pnpm run start` - Start compiled server from `dist/src/main.js`

### SWC + Swagger Safety

This repo can hit a Swagger schema circular-dependency runtime crash in some DTO graphs when booting docs from SWC output. Startup now guards Swagger boot failures and keeps the API server alive, with docs disabled for that run.

## Rollback

One-command rollback paths:

- Build fallback: `pnpm run build:tsc`
- Runtime fallback: keep `API_RUNTIME_PROFILE=full`, `SWAGGER_ENABLED=true`, `SWAGGER_BOOT_MODE=eager`

## Environment

See `apps/api/sample.env` for a full template.
