#!/usr/bin/env bash
set -euo pipefail

PORT="${MARTS_PORT:-8090}"
curl --fail --silent --show-error "http://127.0.0.1:${PORT}/api/health"
printf '\n'