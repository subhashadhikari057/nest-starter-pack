
A modern backend TypeScript monorepo combining NestJS, Drizzle ORM, MongoDB, Redis, SocketIO, and PostgreSQL - all managed with Turborepo and pnpm workspaces.

## Table of Contents

* [Features](#features)
* [Prerequisites](#prerequisites)
* [Project Structure](#project-structure)
* [Getting Started](#getting-started)
* [Configuration](#configuration)
* [Running the Applications](#running-the-applications)
* [Available Scripts](#available-scripts)
* [Notifications (MongoDB)](#notifications-mongodb)
* [Development Workflow](#development-workflow)
* [Common Issues & Troubleshooting](#common-issues--troubleshooting)

## Features

### Backend

* **NestJS** - Progressive Node.js framework with TypeScript
* **Drizzle ORM** - TypeScript-first ORM with excellent type inference
* **PostgreSQL** - Robust, scalable relational database
* **MongoDB (Mongoose)** - Document store for activity logs and notifications
* **Redis** - Queues, caching, and real-time infrastructure
* **Passport.js** - Authentication with JWT, Google OAuth, Facebook OAuth
* **Swagger/OpenAPI** - Auto-generated API documentation

### Packages

* **@nest-starter-pack/db** - Centralized database schemas and migrations
* **@nest-starter-pack/mongodb** - MongoDB schemas/models used by API modules
* **@nest-starter-pack/email** - Email service with SMTP support
* **@nest-starter-pack/otp** - OTP generation and validation
* **@nest-starter-pack/storage** - File storage (local, S3, Supabase)

### Developer Experience

* **TypeScript** - End-to-end type safety
* **Turborepo** - Optimized monorepo build system with smart caching
* **pnpm** - Fast, disk-efficient package manager
* **Biome** - Fast linting and formatting
* **Husky** - Git hooks for code quality
* **Docker Compose** - Easy PostgreSQL setup
* **Docker Compose** - Easy local infrastructure setup (Redis + MongoDB)

## Prerequisites

Before you begin, ensure you have the following installed on your system:

1. **pnpm** (v10 or higher)

* Install globally: `npm install -g pnpm`
* Verify installation: `pnpm --version`

2. **Docker & Docker Compose** (for local infrastructure services)

* Download Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop/)
* Verify installation: `docker --version` and `docker compose version`
* Make sure Docker is running

3. **Git** (for version control)

* Download from [git-scm.com](https://git-scm.com/)
* Verify installation: `git --version`

> **Note:** If you prefer local/manual installs, you can run PostgreSQL, MongoDB, and Redis directly without Docker.

## Project Structure

This is a monorepo managed by Turborepo. Here's how the code is organized:

```
nest-starter-pack/
├── apps/                    # Applications
│   └── api/               # Backend NestJS API (Port 5000)
│       ├── src/
│       │   ├── modules/   # Feature modules (auth, users, etc.)
│       │   └── database/  # Database configuration
│       │   └── services/  
│       │       ├── redis/  
│       │       │   ├── redis.module.ts  # Redis package module
│       │       │   └── redis.service.ts  # Redis services
│       │       ├── mongo/  
│       │       │   ├── mongo.module.ts  
│       │       │   └── mongo.service.ts  
│       │       └── bullmq/  
│       │           ├── bullmq.module.ts  
│       │           └── bullmq.service.ts  
│       ├── sample.env     # Environment variables template
│       ├── nest-cli.json  # NestJS CLI configuration
│       └── package.json
│
├── packages/              # Shared packages
│   ├── db/               # Database layer (Drizzle ORM)
│   │   ├── src/
│   │   │   └── schema/   # Database schemas
│   │   ├── drizzle.config.ts
│   │   └── docker-compose.yml  # PostgreSQL container
│   │
│   ├── mongodb/          # MongoDB models/schemas (Mongoose)
│   │   └── src/
│   │       └── schemas/
│   │
│   ├── email/            # Email service package
│   ├── otp/              # OTP (One-Time Password) utilities
│   └── storage/          # File storage utilities
│
├── turbo.json            # Turborepo configuration
├── pnpm-workspace.yaml   # pnpm workspace configuration
└── package.json          # Root package.json
```

### Understanding the Monorepo Structure

#### Applications (`apps/`)

* `**apps/api**`: Backend API built with NestJS framework. Handles authentication, business logic, and data operations. Runs on port **5000** by default.

#### Packages (`packages/`)

* `**@nest-starter-pack/db`\*\*: Centralized PostgreSQL database layer using Drizzle ORM. Contains schemas, migrations, and database connection.
* `**@nest-starter-pack/mongodb**`: MongoDB schemas/models used by activity and notification modules.
* `**@nest-starter-pack/email**`: Reusable email service for sending transactional emails via SMTP.
* `**@nest-starter-pack/otp**`: OTP generation and validation utilities for two-factor authentication.
* `**@nest-starter-pack/storage**`: File upload and storage management supporting local filesystem and cloud storage providers.

## Getting Started

Follow these steps to get your development environment running:

### 1. Clone the Repository

If you haven't already, clone this repository:

```bash
git clone <your-repo-url>
cd nest-starter-pack
```

### 2. Install Dependencies

Install all dependencies for the entire monorepo:

```bash
pnpm install
```

**What this does:** pnpm will install dependencies for all apps and packages in the monorepo. Thanks to pnpm workspaces, shared dependencies are installed only once, saving disk space.

### 3. Set Up Environment Variables

#### API Environment Variables

Create a `.env` file in the `apps/api` directory:

```bash
cp apps/api/sample.env apps/api/.env
```

**Required variables to update:**

* `DATABASE_URL`: Your PostgreSQL connection string
* `MONGODB_URL`: Your MongoDB connection string
* `REDIS_URL`: Your Redis connection string
* `COOKIE_SECRET`: Random secret for cookie encryption
* `JWT_PRIVATE_KEY_BASE64` & `JWT_PUBLIC_KEY_BASE64`: Generate using the command below

**Generate JWT keys:**

```bash
pnpm --filter api generate:jwt-keys
```

This automatically generates RSA key pairs and updates your `.env` file.

### 4. Start Infrastructure Services

#### Option A: Using Docker Compose (Recommended)

Start local services using Docker Compose:

```bash
pnpm db:start
```

**What this does:** Starts Redis and MongoDB containers in the background.
MongoDB is exposed at `localhost:27017` and Redis at `localhost:6379`.

**To view database logs:**

```bash
pnpm db:watch
```

**To stop the database:**

```bash
pnpm db:stop
```

#### Option B: Using Local Installations

If you prefer local installs:

1. Make sure PostgreSQL, MongoDB, and Redis are running
2. Create/configure required databases/users
3. Update `DATABASE_URL`, `MONGODB_URL`, and `REDIS_URL` in `apps/api/.env`

### 5. Initialize the Database Schema

Run PostgreSQL migrations:

```bash
pnpm db:migrate
```

**What this does:** Uses Drizzle ORM to create PostgreSQL tables, columns, and relationships based on `packages/db/src/schema/`.

MongoDB-backed modules (activity, notifications) do not require SQL migrations.

**Optional - Seed your database:**

```bash
pnpm db:seed
```

**Optional - View your database:**

```bash
pnpm db:studio
```

This opens Drizzle Studio in your browser where you can view and edit database records.

### 6. Start the Development Servers

Start all applications simultaneously:

```bash
pnpm dev
```

**What this does:** Turborepo will start both the frontend and backend in parallel with hot-reloading enabled. You'll see output from both in your terminal.

### 7. Access Your Applications

* **Backend (API Server)**: <http://localhost:5000>
* **API Documentation**: <http://localhost:5000/api/docs> (Swagger/OpenAPI docs)
* **Database Studio**: Run `pnpm run db:studio` and visit <https://local.drizzle.studio>

## Configuration

### Environment Variables

#### API Server (`apps/api/.env`)

Key environment variables you need to configure:

| Variable                        | Description                  | Example                                                                 |
| ------------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| `PORT`                          | Backend API port             | `5000`                                                                  |
| `NODE_ENV`                      | Environment mode             | `development`                                                           |
| `DATABASE_URL`                  | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/dbname`                          |
| `MONGODB_URL`                   | MongoDB connection string    | `mongodb://nest-starter-pack:securepassword@localhost:27017/nest-starter-pack?authSource=admin` |
| `REDIS_URL`                     | Redis connection string      | `redis://nest-starter-pack:securepassword@localhost:6379`                           |
| `COOKIE_SECRET`                 | Secret for cookie encryption | Random string (min 32 chars)                                            |
| `CORS_ORIGINS`                  | Allowed frontend origins     | `http://localhost:3000`                                                 |
| `FRONTEND_BASE_URL`             | Frontend URL for redirects   | `http://localhost:5000`                                                 |
| `JWT_PRIVATE_KEY_BASE64`        | RSA private key (base64)     | Auto-generated via script                                               |
| `JWT_PUBLIC_KEY_BASE64`         | RSA public key (base64)      | Auto-generated via script                                               |
| `JWT_ACCESS_TOKEN_TTL_SECONDS`  | Access token expiry          | `900` (15 minutes)                                                      |
| `JWT_REFRESH_TOKEN_TTL_SECONDS` | Refresh token expiry         | `604800` (7 days)                                                       |

**Optional variables:**

* **Storage**: Configure `STORAGE_`\* variables for file uploads (supports local, S3, Supabase)
* **OAuth**: Configure `GOOGLE_`\* and `FACEBOOK_*` variables for social login
* **Email**: Configure `EMAIL_SMTP_`\* variables for sending emails

See `apps/api/sample.env` for complete list and detailed descriptions.

## Notifications (MongoDB)

Notifications are now MongoDB-backed and include:

* `GET /notifications?surface=<surface>` (offset or cursor pagination via `cursor`)
* `POST /notifications/:id/read` (body includes `surface`)
* `POST /notifications/mark-all-read` (body includes `surface`)
* `GET /notifications/unread-count?surface=<surface>`

Retention is handled by MongoDB TTL (`expiresAt`), and orphan cleanup is handled by a scheduled reconciler job.

#### Database Package (`packages/db/.env`)

The database package can use its own `.env` or inherit from `apps/api/.env`:

```
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
```

### Port Configuration

If port 5000 is already in use, you can change them:

1. **Backend API**: Update `PORT` in `apps/api/.env`
2. **Update CORS**: If you change frontend port, update `CORS_ORIGINS` in `apps/api/.env`
3. **Update OAuth**: If you change backend port, update callback URLs in `apps/api/.env`

## Running the Applications

### Run Everything Together

Start all applications in development mode:

```bash
pnpm dev
```

**What runs:** `apps/api` (backend) starts with hot-reloading enabled.
Before `apps/api` starts, workspace package dev tasks (`@nest-starter-pack/db`, `@nest-starter-pack/jobs`, `@nest-starter-pack/redis`, `@nest-starter-pack/realtime-core`, `@nest-starter-pack/mongodb`, `@nest-starter-pack/firebase`) are orchestrated first so linked `dist` outputs are ready.

### Run Individual Applications

**Backend only:**

```bash
pnpm dev:server
```

> **Note:** The script name is `dev:server` but it runs the `apps/api` folder (NestJS backend).

### Production Build & Start

**Build all applications:**

```bash
pnpm build
```

This creates optimized production builds in the `dist` folders of each app.

**Start production servers:**

```bash
pnpm start
```

For backend only, you can run:

```bash
cd apps/api
pnpm start
```

### Database Commands

| Command            | Description                            |
| ------------------ | -------------------------------------- |
| `pnpm db:start`    | Start PostgreSQL container (detached)  |
| `pnpm db:watch`    | Start PostgreSQL container (with logs) |
| `pnpm db:stop`     | Stop PostgreSQL container              |
| `pnpm db:down`     | Stop and remove PostgreSQL container   |
| `pnpm db:push`     | Push schema changes to database        |
| `pnpm db:studio`   | Open Drizzle Studio (database GUI)     |
| `pnpm db:generate` | Generate SQL migrations from schema    |
| `pnpm db:migrate`  | Run pending migrations                 |
| `pnpm db:seed`     | Seed database with initial data        |

### Code Quality Commands

**Type checking across all packages:**

```bash
pnpm check-types
```

**Linting and formatting:**

```bash
pnpm check
```

**Run tests:**

```bash
pnpm test
```

## Available Scripts

| Script             | Description                                |
| ------------------ | ------------------------------------------ |
| `pnpm dev`         | Start all applications in development mode |
| `pnpm build`       | Build all applications for production      |
| `pnpm start`       | Start all production builds                |
| `pnpm test`        | Run tests across all packages              |
| `pnpm dev:server`  | Start backend API only                     |
| `pnpm check-types` | Type check all TypeScript code             |
| `pnpm check`       | Run Biome linting and formatting           |
| `pnpm db:start`    | Start PostgreSQL container (detached)      |
| `pnpm db:stop`     | Stop PostgreSQL container                  |
| `pnpm db:down`     | Remove PostgreSQL container                |
| `pnpm db:push`     | Push schema changes to database            |
| `pnpm db:studio`   | Open Drizzle Studio database GUI           |
| `pnpm db:generate` | Generate SQL migrations                    |
| `pnpm db:migrate`  | Run database migrations                    |
| `pnpm db:seed`     | Seed database with initial data            |

## Development Workflow

### Adding New Dependencies

**For the entire monorepo (root level):**

```bash
pnpm add -w <package-name>
```

**For a specific app or package:**

```bash
pnpm add <package-name> --filter api      # Backend API
pnpm add <package-name> --filter @nest-starter-pack/db      # Database package
pnpm add <package-name> --filter @nest-starter-pack/email   # Email package
pnpm add <package-name> --filter @nest-starter-pack/otp     # OTP package
pnpm add <package-name> --filter @nest-starter-pack/storage # Storage package
```

**For dev dependencies:**

```bash
pnpm add -D <package-name> --filter api
```

### Working with Database Schemas

**1. Edit schema files** in `packages/db/src/schema/`

**2. Push changes to database:(Only For Development)**

```bash
pnpm run db:push
```

Use this command during development to quickly sync schema changes without generating migrations.

**3. Review changes in Drizzle Studio:**

```bash
pnpm run db:studio
```

**4. Generate migrations for production:**

```bash
pnpm db:generate
pnpm db:migrate
```

### Adding New NestJS Modules

NestJS follows a modular architecture. To add a new module:

**1. Create module structure** in `apps/api/src/modules/your-module/`:

* `your-module.module.ts` - Module definition
* `your-module.controller.ts` - HTTP endpoints
* `your-module.service.ts` - Business logic
* `your-module.types.ts` - TypeScript types
* `dto/` - Data transfer objects

**2. Import the module** in `apps/api/src/app.module.ts`

Route types are automatically generated in `routeTree.gen.ts`.

### Git Hooks

This project uses Husky for Git hooks. Before each commit:

* Code is automatically formatted using Biome
* Linting rules are enforced

If a commit fails, fix the issues shown in the error message and try again.

## Common Issues & Troubleshooting

### Issue: "Cannot find module" errors

**Cause:** Dependencies might not be installed correctly or pnpm workspace links are broken.

**Solution:**

```bash
rm -rf node_modules
rm -rf apps/*/node_modules packages/*/node_modules
rm pnpm-lock.yaml
pnpm install
```

### Issue: Database connection fails

**Symptoms:** Errors like "ECONNREFUSED" or "password authentication failed"

**Solutions:**

**If using Docker:**

1. Check if PostgreSQL container is running:

```bash
 docker ps
```

2. Start the database if not running:

```bash
 pnpm run db:start
```

3. Check container logs:

```bash
 pnpm run db:watch
```

**If using local PostgreSQL:**

1. Verify PostgreSQL is running:

```bash
 pg_isready
```

2. Check your `DATABASE_URL` in `apps/api/.env`
3. Verify database exists and credentials are correct

### Issue: JWT keys not generated

**Symptoms:** API fails to start with JWT key errors

**Solution:**

```bash
pnpm --filter api generate:jwt-keys
```

This generates RSA key pairs and automatically updates `apps/api/.env`.

### Issue: Port already in use

**Symptoms:** Error like "EADDRINUSE: address already in use ::3000" or "::5000"

**Solutions:**

1. Find and kill the process using the port:

```bash
 lsof -ti:5000 | xargs kill -9    # For backend (port 5000)
```

2. Or change the port numbers:

* **Backend**: Edit `PORT` in `apps/api/.env`

### Issue: TypeScript errors after pulling new code

**Cause:** Type definitions or generated files might be outdated.

**Solution:**

```bash
pnpm install
pnpm run check-types
```

### Issue: Turborepo cache issues

**Symptoms:** Unexpected build behavior, stale outputs, or changes not reflecting

**Solution:**

Clear Turborepo cache:

```bash
rm -rf .turbo
rm -rf apps/*/.turbo packages/*/.turbo
pnpm run build
```

### Issue: Database schema out of sync

**Symptoms:** Database errors about missing columns, tables, or relations

**Solution:**

```bash
pnpm run db:push
```

**If that doesn't work and you're okay losing data:**

```bash
pnpm run db:down    # Remove database container
pnpm run db:start   # Start fresh container
pnpm run db:push    # Apply schema
```

### Issue: Docker container won't start

**Symptoms:** Database container fails to start or keeps restarting

**Solutions:**

1. Check if another PostgreSQL instance is using port 5432:

```bash
 lsof -i :5432
```

2. Check Docker logs:

```bash
 docker compose -f packages/db/docker-compose.yml logs
```

3. Remove old volumes and restart:

```bash
 pnpm run db:down
 docker volume prune
 pnpm run db:start
```

### Issue: CORS errors in browser

**Symptoms:** Browser console shows CORS policy errors

**Solution:**

1. Check `CORS_ORIGINS` in `apps/api/.env` includes your frontend URL:

```
 CORS_ORIGINS=http://localhost:3000
```

2. Restart the backend after changing:

```bash
 pnpm run dev:server
```

### Issue: Frontend can't reach backend API

**Checklist:**

1. Verify backend is running at <http://localhost:5000>
2. Check browser console for CORS errors
3. Verify API base URL in frontend (should be `http://localhost:5000`)
4. Check `CORS_ORIGINS` in `apps/api/.env` matches frontend URL

### Issue: "pnpm not found" error

**Solution:**

Install pnpm globally:

```bash
npm install -g pnpm
```

Or use Corepack (built into Node.js 16.13+):

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### Issue: Uploads/file storage not working

**Symptoms:** File uploads fail or images don't display

**Solution:**

1. Check `UPLOAD_LOCATION` in `apps/api/.env` exists and is writable
2. Verify `STORAGE_DRIVER` is configured correctly
3. Check storage configuration in `apps/api/.env` for your chosen provider

### Getting Help

If you encounter issues not covered here:

1. Check error messages carefully - they often point to the exact problem
2. Review the [NestJS documentation](https://docs.nestjs.com/) for backend issues
3. Review the [TanStack Router documentation](https://tanstack.com/router) for frontend routing issues
4. Check the [Drizzle ORM documentation](https://orm.drizzle.team/) for database issues
5. Try a fresh installation following the [Getting Started](#getting-started) steps

***

**Happy coding! 🚀**
