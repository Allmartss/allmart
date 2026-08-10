#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${MARTS_DATABASE_URL:-}" && -z "${DATABASE_URL:-}" ]]; then
  echo "MARTS_DATABASE_URL or DATABASE_URL must be configured." >&2
  exit 1
fi

if [[ -z "${MARTS_JWT_SECRET:-}" ]]; then
  echo "MARTS_JWT_SECRET must be configured." >&2
  exit 1
fi

echo "Marts environment variables are present."