#!/usr/bin/env bash
# deploy.sh — Full setup: install dependencies, build, push DB schema, and seed.
# Run this on a fresh environment or after pulling new code.
# After this completes, run start.sh to launch the server.
#
# Environment variables:
#   STOREFRONT_PORT — port used when building the storefront (default: 18539)
#   BASE_PATH       — URL base path for the storefront   (default: /)
set -euo pipefail

export STOREFRONT_PORT="${STOREFRONT_PORT:-18539}"
export BASE_PATH="${BASE_PATH:-/}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------------------------------------------------------------------------
# 1. Install dependencies
# ---------------------------------------------------------------------------
echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# 2. Build API server
# ---------------------------------------------------------------------------
echo "==> Building API server..."
pnpm --filter @workspace/api-server run build

# ---------------------------------------------------------------------------
# 3. Build storefront
# ---------------------------------------------------------------------------
echo "==> Building storefront..."
PORT="${STOREFRONT_PORT}" BASE_PATH="${BASE_PATH}" \
  pnpm --filter @workspace/storefront run build

# ---------------------------------------------------------------------------
# 4. Push database schema
# ---------------------------------------------------------------------------
echo "==> Pushing database schema..."
pnpm --filter @workspace/db run push

# ---------------------------------------------------------------------------
# 5. Seed database (admin user + default settings — safe to re-run)
# ---------------------------------------------------------------------------
echo "==> Seeding database (admin user + default settings)..."
pnpm --filter @workspace/db run seed

# ---------------------------------------------------------------------------
echo ""
echo "✓ Deploy complete."
echo "  Run ./start.sh to launch the server."
