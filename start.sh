#!/usr/bin/env bash
# start.sh — Stop any running AllMart services and start the server.
# Run deploy.sh first on a fresh environment or after pulling new code.
#
# Environment variables:
#   PORT_API — port the API server listens on (default: 8080)
set -euo pipefail

export PORT_API="${PORT_API:-8080}"
export STOREFRONT_PORT="${STOREFRONT_PORT:-18539}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------------------------------------------------------------------------
# Kill all running AllMart services
# ---------------------------------------------------------------------------
echo "==> Stopping any running AllMart services..."

pkill -f "api-server" 2>/dev/null || true
pkill -f "storefront" 2>/dev/null || true
pkill -f "pnpm.*@workspace" 2>/dev/null || true

# Free the API port
if command -v fuser &>/dev/null; then
  fuser -k "${PORT_API}/tcp" 2>/dev/null || true
elif command -v lsof &>/dev/null; then
  lsof -ti:"${PORT_API}" | xargs kill -9 2>/dev/null || true
fi

# Free the storefront port (in case a dev server was running)
if command -v fuser &>/dev/null; then
  fuser -k "${STOREFRONT_PORT}/tcp" 2>/dev/null || true
elif command -v lsof &>/dev/null; then
  lsof -ti:"${STOREFRONT_PORT}" | xargs kill -9 2>/dev/null || true
fi

echo "==> All services stopped. Waiting for ports to clear..."
sleep 2

# ---------------------------------------------------------------------------
# Start the API server (serves both /api routes and pre-built storefront)
# ---------------------------------------------------------------------------
echo "==> Starting AllMart on port ${PORT_API}..."
PORT="${PORT_API}" pnpm --filter @workspace/api-server run start
