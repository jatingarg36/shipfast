#!/usr/bin/env bash
# setup-local.sh — install and start Redis + MinIO via Homebrew for local dev
set -e

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[setup]${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
error() { echo -e "${RED}[error]${NC} $*"; exit 1; }

# ── Homebrew check ────────────────────────────────────────────────────────────
if ! command -v brew &>/dev/null; then
  error "Homebrew not found. Install it from https://brew.sh then re-run this script."
fi

# ── Redis ─────────────────────────────────────────────────────────────────────
info "Checking Redis..."
if ! brew list redis &>/dev/null; then
  info "Installing redis via Homebrew..."
  brew install redis
else
  info "redis already installed."
fi

if brew services list | grep redis | grep -q started; then
  info "Redis is already running."
else
  info "Starting Redis service..."
  brew services start redis
fi

# Verify
if redis-cli ping | grep -q PONG; then
  info "Redis is up at redis://127.0.0.1:6379 ✓"
else
  warn "Redis didn't respond to PING — check 'brew services list'"
fi

# ── MinIO (local S3) ──────────────────────────────────────────────────────────
info "Checking MinIO..."
if ! brew list minio &>/dev/null; then
  info "Installing minio via Homebrew..."
  brew install minio/stable/minio
else
  info "minio already installed."
fi

if ! brew list minio/stable/mc &>/dev/null 2>&1 && ! command -v mc &>/dev/null; then
  info "Installing MinIO CLI (mc)..."
  brew install minio/stable/mc
fi

# Create data directory
MINIO_DATA="$HOME/.local/share/minio"
mkdir -p "$MINIO_DATA"

# Launch MinIO in background if not running
if pgrep -x minio &>/dev/null; then
  info "MinIO is already running."
else
  info "Starting MinIO on port 9000 (console: 9001)..."
  MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin \
    minio server "$MINIO_DATA" --address ":9000" --console-address ":9001" \
    > /tmp/minio.log 2>&1 &
  sleep 2
fi

# Create bucket
if mc alias set local http://127.0.0.1:9000 minioadmin minioadmin &>/dev/null; then
  mc mb --ignore-existing local/shipfast-local &>/dev/null && info "Bucket 'shipfast-local' ready ✓"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
info "All local services are running:"
echo "  Redis  → redis://127.0.0.1:6379"
echo "  MinIO  → http://127.0.0.1:9000  (S3 API)"
echo "  MinIO  → http://127.0.0.1:9001  (Web console — login: minioadmin / minioadmin)"
echo ""
info "Your .env.local is already configured for these. Run: npm run dev"
w