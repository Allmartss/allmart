#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"
exec python3 -m uvicorn src.api.main:app \
  --host "${MARTS_HOST:-0.0.0.0}" \
  --port "${MARTS_PORT:-8090}"