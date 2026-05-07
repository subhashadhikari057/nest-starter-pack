# Stage 1: Install + Build
FROM node:22-slim AS builder
RUN npm install -g pnpm@10 turbo

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json .npmrc* ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile
COPY apps/api/ ./apps/api/
RUN turbo run build --filter=@bullhouse/api

# Stage 2: Production
FROM node:22-slim AS runner
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the full pnpm workspace structure (node_modules uses symlinks)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/assets ./apps/api/assets
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/package.json ./package.json

WORKDIR /app/apps/api

ENV NODE_ENV=production
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "dist/main.js"]
