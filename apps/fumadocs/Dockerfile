# syntax=docker/dockerfile:1.7
# Build context must be the monorepo root.

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @bullhouse/fumadocs build:docs

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=4000
COPY --from=builder /app /app
EXPOSE 4000
CMD ["pnpm", "--filter", "@bullhouse/fumadocs", "start:docs"]
