# CLAUDE.md
your work will be reviewed, each line and everything will be reviewed by another AI agents and AI models like Chatgpt and its highly powerful coding model
## Philosophy
This codebase will outlive you. Every shortcut becomes someone else's burden. Every hack compounds into technical debt that slows the whole team down.
You are not just writing code. You are shaping the future of this project. patterns you establish will be copied. The corners you cut will be cut again.
Fight entropy. Leave the codebase better than you found it.

# Important
- use contex7 mcp for documentation searches and library/framework docs instead of doing websearches
- only do websearches where context7 mcp for documentation would not be enough
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**bullhouse** — a TypeScript monorepo for an e-commerce/subscription platform. Turborepo + pnpm workspaces. The primary app is a NestJS API (`apps/api`) with PostgreSQL (Drizzle ORM), MongoDB (Mongoose), Redis, and real-time WebSocket support.

## Commands

### Development
```bash
pnpm dev              # Start all apps (API + fumadocs)
pnpm dev:server       # Start backend API only (apps/api)
pnpm dev:fast         # API without Swagger, skip scheduled tasks (API_RUNTIME_PROFILE=fast)
```

### Building & Running
```bash
pnpm build            # Build all apps/packages
pnpm start            # Start production builds
pnpm check-types      # TypeScript type-check across all packages
```

### Linting & Formatting
```bash
pnpm check            # Biome lint + format (auto-fix)
```
Biome enforces: tab indentation, double quotes, organized imports (type → node → external → internal → relative). Pre-commit hook runs `lint-staged` with Biome.

### Database
```bash
pnpm db:start         # Start Redis + MongoDB containers (docker-compose.yml at root)
pnpm db:stop / db:down
pnpm db:push          # Push Drizzle schema changes to PostgreSQL (dev only)
pnpm db:generate      # Generate SQL migration files
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed database
pnpm db:studio        # Open Drizzle Studio GUI
```
PostgreSQL is managed separately (not in root docker-compose). Schemas live in `packages/db/src/schema/`.

### Testing
```bash
cd apps/api
pnpm test                     # Run all unit tests (Jest)
pnpm test -- --testPathPattern='subscription'  # Run tests matching pattern
pnpm test:int                 # Integration tests only (*.int.spec.ts)
pnpm test:e2e                 # End-to-end tests
pnpm test:watch               # Watch mode
```
Jest config: rootDir is `apps/api/src`, path alias `@/` maps to `<rootDir>/`. Setup file at `apps/api/test/jest.setup-env.ts` loads `.env` from both `apps/api/.env` and root.

### JWT Key Generation
```bash
pnpm --filter api generate:jwt-keys   # Generates RSA key pair into apps/api/.env
```

## Monorepo Structure

```
apps/
  api/         → NestJS backend (port 5000), SWC compiler
  fumadocs/    → API docs site (Next.js + Fumadocs, port 4000)

packages/
  db/          → @bullhouse/db — Drizzle ORM schemas, migrations, seed (PostgreSQL)
  mongodb/     → @bullhouse/mongodb — Mongoose schemas (audit logs, notifications)
  email/       → @bullhouse/email — SMTP email service
  otp/         → @bullhouse/otp — OTP generation/validation
  storage/     → @bullhouse/storage — File storage (local, S3, Supabase)
  firebase/    → @bullhouse/firebase — Firebase Admin SDK
  redis/       → @bullhouse/redis — Redis client
  jobs/        → @bullhouse/jobs — BullMQ job definitions
  realtime-core/ → @bullhouse/realtime-core — Shared WebSocket event types
```

Workspace packages are referenced as `workspace:*` in package.json. Path aliases for IDE resolution are in root `tsconfig.base.json`.

## Architecture Patterns

### NestJS Module Convention
Each feature lives in `apps/api/src/modules/<feature>/` with:
- `<feature>.module.ts` — NestJS module definition
- `<feature>.controller.ts` — HTTP endpoints
- `<feature>.service.ts` — Business logic
- `dto/` — Request/response DTOs (class-validator + class-transformer + Swagger decorators)
- `types.ts` — TypeScript types

Larger features use aggregate modules (e.g., `subscription-admin-aggregate.module.ts`) that bundle sub-modules for plans, tiers, etc.

### Database Injection
- PostgreSQL: inject via `@Inject(DATABASE)` symbol from `database.module.ts`. Type is `Database` from `@bullhouse/db`.
- MongoDB: inject via `@Inject(MONGODB)` symbol from `mongodb.module.ts`.
- Both modules are `@Global()` — available everywhere without explicit imports.

### Auth System
- JWT RS256 with Bearer token (`Authorization: Bearer <token>`) — NO cookie auth
- `JwtAuthGuard` (Germany) / `NepalJwtAuthGuard` (Nepal) — profile-aware global guard
- `@Public()` decorator exempts routes from auth
- `@CurrentUser()` param decorator extracts user from request
- OAuth strategies: Google, Facebook (via Passport.js)
- Phone OTP login supported

### Authorization
- `@Permissions(...)` decorator + `RoleGuard` for RBAC permission checks
- `@SubscriptionAccess("moduleSlug")` decorator + guard for subscription-gated endpoints (supports static slugs or dynamic `:param` references)

### Response Envelope
All API responses use `ResponseDto<T>` from `common/dto/response-dto.ts`:
```ts
new ResponseDto("message", data, { count, page, size })
```
Swagger docs use `@ApiResponseDto(MyDto)` or `@ApiPaginatedResponseDto(MyDto)`.

### Pagination
`QueryDto` from `common/dto/query.dto.ts` provides standard pagination params: `page`, `size`, `sort`, `order`, `search`, `pagination` (boolean toggle).

### Environment Validation
All env vars are validated at startup via Zod schema in `apps/api/src/config/env.validation.ts`. Add new env vars there first.

### Infrastructure Services (`apps/api/src/services/`)
- `RedisModule` — Redis connection
- `JobsModule` — BullMQ queue configuration
- `FirebaseModule` — Push notifications
- `RealtimeModule` — Socket.IO WebSocket gateway (uses Redis adapter)
- `ActivityModule` — MongoDB-backed audit/activity logging

### Runtime Profiles
`API_RUNTIME_PROFILE=fast` skips Swagger setup and scheduled tasks for faster dev iteration.

## Biome Rules (Notable)
- `unsafeParameterDecoratorsEnabled: true` for NestJS decorator syntax in `apps/api/`
- `useImportType: off` in `apps/api/` (NestJS DI needs value imports)
- `noParameterAssign: error`, `useAsConstAssertion: error`, `noInferrableTypes: error`
- Tailwind class sorting enabled via `useSortedClasses` (for fumadocs)

## Env Setup
Copy `apps/api/sample.env` to `apps/api/.env`. Root `sample.env` has Docker Compose variables for Redis/MongoDB credentials. Required: `DATABASE_URL`, `MONGODB_URL`, `REDIS_URL`, `JWT_PRIVATE_KEY_BASE64`, `JWT_PUBLIC_KEY_BASE64`.

## Adding Dependencies
```bash
pnpm add <pkg> --filter api           # To the API app
pnpm add <pkg> --filter @bullhouse/db     # To a specific package
pnpm add -w <pkg>                     # To workspace root
```

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
