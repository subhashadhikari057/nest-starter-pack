#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"
ENV_GERMANY="$API_DIR/.env.germany"
ENV_NEPAL="$API_DIR/.env.nepal"
SAMPLE_GERMANY="$API_DIR/sample.env.germany"
SAMPLE_NEPAL="$API_DIR/sample.env.nepal"

echo ""
echo "====================================="
echo "  bullhouse local development setup"
echo "====================================="
echo ""

# ── 1. Install dependencies ────────────────────────────────────────────────
echo "[1/6] Installing dependencies..."
cd "$ROOT_DIR"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
echo ""

# ── 2. Create env files from samples if missing ────────────────────────────
echo "[2/6] Setting up environment files..."
if [ ! -f "$ENV_GERMANY" ]; then
    cp "$SAMPLE_GERMANY" "$ENV_GERMANY"
    echo "  Created apps/api/.env.germany"
else
    echo "  apps/api/.env.germany already exists, skipping."
fi

if [ ! -f "$ENV_NEPAL" ]; then
    cp "$SAMPLE_NEPAL" "$ENV_NEPAL"
    echo "  Created apps/api/.env.nepal"
else
    echo "  apps/api/.env.nepal already exists, skipping."
fi
echo ""

# ── 3. Generate JWT keys if placeholders are still there ────────────────────
echo "[3/6] Checking JWT keys..."
NEEDS_KEYS=false
if grep -q "REPLACE_WITH_BASE64_PRIVATE_KEY" "$ENV_GERMANY" 2>/dev/null; then
    NEEDS_KEYS=true
fi

if [ "$NEEDS_KEYS" = true ]; then
    echo "  Generating JWT keys..."
    cd "$API_DIR"
    KEY_OUTPUT=$(node scripts/generate-jwt-keys.mjs 2>&1)
    PRIVATE_KEY=$(echo "$KEY_OUTPUT" | grep "JWT_PRIVATE_KEY_BASE64=" | cut -d= -f2-)
    PUBLIC_KEY=$(echo "$KEY_OUTPUT" | grep "JWT_PUBLIC_KEY_BASE64=" | cut -d= -f2-)

    if [ -n "$PRIVATE_KEY" ] && [ -n "$PUBLIC_KEY" ]; then
        # Germany gets both keys
        sed -i "s|REPLACE_WITH_BASE64_PRIVATE_KEY|$PRIVATE_KEY|" "$ENV_GERMANY"
        sed -i "s|REPLACE_WITH_BASE64_PUBLIC_KEY|$PUBLIC_KEY|" "$ENV_GERMANY"
        echo "  Injected private + public key into .env.germany"

        # Nepal gets public key only
        sed -i "s|REPLACE_WITH_BASE64_PUBLIC_KEY|$PUBLIC_KEY|" "$ENV_NEPAL"
        echo "  Injected public key into .env.nepal"
    else
        echo "  WARNING: Could not extract JWT keys. Run manually:"
        echo "  pnpm --filter api generate:jwt-keys"
    fi
    cd "$ROOT_DIR"
else
    echo "  JWT keys already configured, skipping."
fi
echo ""

# ── 4. Start infrastructure ────────────────────────────────────────────────
echo "[4/6] Starting infrastructure (Postgres, Redis x2, MongoDB, RustFS)..."
docker compose -f docker-compose.dev.yml up -d
echo ""

# Wait for postgres to be ready
echo "  Waiting for Postgres..."
until docker exec bullhouse_postgres pg_isready -U postgres -p 5432 -q 2>/dev/null; do
    sleep 1
done
echo "  Postgres is ready."
echo ""

# ── 5. Run migrations ──────────────────────────────────────────────────────
echo "[5/6] Running Germany migrations and seed..."
pnpm db:migrate:germany
pnpm db:seed:germany
echo ""

echo "[6/6] Running Nepal migrations..."
pnpm db:migrate:nepal
echo ""

# ── Done ────────────────────────────────────────────────────────────────────
echo "====================================="
echo "  Setup complete!"
echo "====================================="
echo ""
echo "  Start developing:"
echo "    pnpm dev:germany     # Germany API on port 5000"
echo "    pnpm dev:nepal       # Nepal API on port 5001"
echo "    pnpm dev:server      # Default profile (uses .env)"
echo ""
echo "  Run both simultaneously (in separate terminals):"
echo "    pnpm dev:germany"
echo "    pnpm dev:nepal"
echo ""
echo "  Infrastructure:"
echo "    pnpm infra:up        # Start containers"
echo "    pnpm infra:down      # Stop containers"
echo "    pnpm infra:reset     # Remove containers + volumes (fresh start)"
echo ""
echo "  Database:"
echo "    pnpm db:migrate:germany / pnpm db:migrate:nepal"
echo "    pnpm db:studio:germany  / pnpm db:studio:nepal"
echo "    pnpm db:seed"
echo ""
