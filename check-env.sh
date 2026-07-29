#!/usr/bin/env bash
# check-env.sh — Validate environment variables before running deploy.sh
# Works in GitHub Codespaces, VPS, and local environments.
#
# Usage:
#   bash check-env.sh            # checks current shell env + auto-loads .env
#   bash check-env.sh .env.prod  # load a specific env file

set -euo pipefail

# ── Colours ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✓${RESET}  $1"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $1"; }
fail() { echo -e "  ${RED}✗${RESET}  $1"; ERRORS=$((ERRORS + 1)); }
info() { echo -e "  ${CYAN}ℹ${RESET}  $1"; }

ERRORS=0
ENV_FILE="${1:-}"   # optional: path passed as first argument

# ── Step 1: locate and load .env ────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━ Environment file detection ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

load_env() {
  local file="$1"
  if [ -f "$file" ]; then
    # Export every non-comment, non-blank line
    set -o allexport
    # shellcheck disable=SC1090
    source "$file"
    set +o allexport
    ok "Loaded env from: $file"
    return 0
  fi
  return 1
}

if [ -n "$ENV_FILE" ]; then
  # Explicit file passed on command line
  if ! load_env "$ENV_FILE"; then
    fail "File not found: $ENV_FILE"
  fi
else
  # Auto-detect: try .env, then .env.local, then .env.production
  LOADED=0
  for candidate in .env .env.local .env.production; do
    if load_env "$candidate"; then
      LOADED=1
      break
    fi
  done
  if [ "$LOADED" -eq 0 ]; then
    warn "No .env file found — using only shell environment variables."
    info "In GitHub Codespaces, secrets set in the UI are already in your shell."
    info "If variables are missing, create a .env file or export them manually:"
    info "  export DATABASE_URL=\"postgres://...\""
  fi
fi

# ── GitHub Codespaces notice ─────────────────────────────────────────────────
if [ -n "${CODESPACE_NAME:-}" ] || [ -n "${GITHUB_CODESPACE_TOKEN:-}" ]; then
  echo ""
  echo -e "${BOLD}━━━ GitHub Codespaces detected ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  info "Codespace: ${CODESPACE_NAME:-unknown}"
  warn "Codespace secrets are injected only into NEW terminal sessions."
  warn "If you set a secret recently, close this terminal and open a fresh one,"
  warn "then run this script again — old sessions don't see new secrets."
  info "To check what secrets are currently visible to this shell, run:"
  info "  printenv | grep -E 'DATABASE|SESSION|STRIPE|TELEGRAM|FILE_|SMTP|GROQ'"
fi

# ── Step 2: Required variables ───────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━ Required variables ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

check_required() {
  local name="$1"
  local val="${!name:-}"
  if [ -z "$val" ]; then
    fail "$name  ${RED}(missing)${RESET}"
  else
    # Mask everything after the first 6 characters
    local masked="${val:0:6}$(printf '%0.s*' {1..12})"
    ok "$name  = $masked"
  fi
}

# DATABASE_URL — accept either SUPABASE_DB_URL or DATABASE_URL
DB_URL="${DATABASE_URL:-${SUPABASE_DB_URL:-}}"
if [ -z "$DB_URL" ]; then
  fail "DATABASE_URL or SUPABASE_DB_URL  ${RED}(at least one is required)${RESET}"
else
  masked="${DB_URL:0:20}***"
  ok "DATABASE_URL / SUPABASE_DB_URL  = $masked"

  # Validate format
  if [[ "$DB_URL" =~ ^postgres(ql)?:// ]]; then
    ok "  → Format looks valid (postgres:// URI)"
  else
    warn "  → Unexpected format. Expected: postgres://user:pass@host/dbname"
  fi
fi

check_required SESSION_SECRET
# Warn if SESSION_SECRET is too short
SESSION_VAL="${SESSION_SECRET:-}"
if [ -n "$SESSION_VAL" ] && [ "${#SESSION_VAL}" -lt 32 ]; then
  warn "  → SESSION_SECRET is only ${#SESSION_VAL} characters. Use 32+ for security."
fi

# ── Step 3: Optional-but-important variables ─────────────────────────────────
echo ""
echo -e "${BOLD}━━━ Optional variables ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

check_optional() {
  local name="$1"
  local hint="${2:-}"
  local val="${!name:-}"
  if [ -z "$val" ]; then
    warn "$name  ${YELLOW}(not set${hint:+ — $hint})${RESET}"
  else
    local masked="${val:0:6}$(printf '%0.s*' {1..10})"
    ok "$name  = $masked"
  fi
}

echo -e "  ${CYAN}File storage (S3-compatible):${RESET}"
check_optional FILE_ENDPOINT_URL "images will be stored locally only"
check_optional FILE_BUCKET
check_optional FILE_ACCESS_KEY_ID
check_optional FILE_SECRET_ACCESS_KEY
check_optional FILE_REGION

echo ""
echo -e "  ${CYAN}Payments:${RESET}"
check_optional STRIPE_SECRET_KEY "checkout will not work"
check_optional STRIPE_WEBHOOK_SECRET "payment events will not be received"
if [ -n "${STRIPE_SECRET_KEY:-}" ]; then
  if [[ "${STRIPE_SECRET_KEY}" =~ ^sk_live_ ]]; then
    warn "  → STRIPE_SECRET_KEY is a LIVE key. Charges will be real."
  elif [[ "${STRIPE_SECRET_KEY}" =~ ^sk_test_ ]]; then
    ok  "  → STRIPE_SECRET_KEY is a TEST key."
  else
    warn "  → STRIPE_SECRET_KEY has an unexpected prefix."
  fi
fi

echo ""
echo -e "  ${CYAN}Telegram bot:${RESET}"
check_optional TELEGRAM_BOT_TOKEN "Telegram notifications will be disabled"
check_optional TELEGRAM_CHAT_ID
check_optional TELEGRAM_WEBHOOK_SECRET

echo ""
echo -e "  ${CYAN}Email — Brevo API (primary):${RESET}"
check_optional BREVO_API_KEY "Brevo email disabled; SMTP will be used as fallback"

echo ""
echo -e "  ${CYAN}Email — SMTP (fallback):${RESET}"
check_optional SMTP_HOST "SMTP email disabled"
check_optional SMTP_PORT
check_optional SMTP_USER
check_optional SMTP_PASSWORD

echo ""
echo -e "  ${CYAN}AI features:${RESET}"
check_optional GROQ_API_KEY "AI assistant will be disabled"
check_optional NVIDIA_API_KEY
check_optional AI_INTEGRATIONS_OPENAI_BASE_URL

echo ""
echo -e "  ${CYAN}GitHub:${RESET}"
check_optional GITHUB_TOKEN "GitHub API integration disabled"

echo ""
echo -e "  ${CYAN}Other:${RESET}"
check_optional APP_URL "used for absolute links in emails"
check_optional PORT_API "defaults to 8080"
check_optional NODE_ENV "defaults to production"

# ── Step 4: Connectivity test ────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━ Database connectivity test ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

if [ -n "$DB_URL" ]; then
  if command -v psql &>/dev/null; then
    if psql "$DB_URL" -c "SELECT 1;" &>/dev/null 2>&1; then
      ok "psql connected successfully"
    else
      fail "psql could not connect — check host, credentials, and firewall"
      info "  Try manually: psql \"$( echo "$DB_URL" | sed 's|:[^:@]*@|:***@|' )\""
    fi
  elif command -v node &>/dev/null; then
    # Lightweight node connectivity check (no extra packages needed)
    RESULT=$(node -e "
      const { URL } = require('url');
      const u = new URL(process.env.DB_URL || '');
      const net = require('net');
      const port = parseInt(u.port) || 5432;
      const socket = net.createConnection({ host: u.hostname, port }, () => {
        console.log('reachable');
        socket.destroy();
      });
      socket.on('error', e => { console.log('unreachable:' + e.message); socket.destroy(); });
      setTimeout(() => { console.log('timeout'); socket.destroy(); }, 5000);
    " DB_URL="$DB_URL" 2>/dev/null || echo "check-failed")

    if [[ "$RESULT" == "reachable" ]]; then
      ok "DB host is reachable on port 5432"
    elif [[ "$RESULT" == timeout ]]; then
      fail "DB host timed out — check firewall rules or the hostname"
    elif [[ "$RESULT" == unreachable:* ]]; then
      fail "DB host unreachable: ${RESULT#unreachable:}"
    else
      warn "Could not verify connectivity (psql not installed, node check failed)"
    fi
  else
    warn "Neither psql nor node found — skipping connectivity test"
  fi
else
  warn "Skipping connectivity test (no DATABASE_URL set)"
fi

# ── Step 5: Runtime checks ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━ Runtime checks ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
  if [ "$NODE_MAJOR" -ge 20 ]; then
    ok "Node.js $NODE_VER"
  else
    fail "Node.js $NODE_VER is too old — AllMart requires v20 or higher"
  fi
else
  fail "Node.js not found — install it before deploying"
fi

if command -v pnpm &>/dev/null; then
  ok "pnpm $(pnpm -v)"
else
  fail "pnpm not found — run: npm install -g pnpm"
fi

if [ -d "node_modules" ] || [ -d "artifacts/api-server/node_modules" ]; then
  ok "node_modules present — dependencies already installed"
else
  warn "node_modules not found — run pnpm install before deploy"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
if [ "$ERRORS" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}  ✓ All required checks passed. Safe to run deploy.sh${RESET}"
else
  echo -e "${RED}${BOLD}  ✗ $ERRORS required check(s) failed. Fix the issues above before deploying.${RESET}"
  echo ""
  echo -e "  ${CYAN}Tip — if your variables are set in Codespaces secrets but not visible:${RESET}"
  echo -e "  1. Open a brand-new terminal (the secret must have been added before this session)"
  echo -e "  2. Or export them manually for this session:"
  echo -e "     export DATABASE_URL=\"your-connection-string\""
  echo -e "  3. Or create a .env file in the project root and run:"
  echo -e "     bash check-env.sh .env"
  echo ""
  exit 1
fi
echo ""
