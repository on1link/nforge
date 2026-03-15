#!/usr/bin/env bash
# ============================================================
# Neural Forge v1.0.0-beta — scripts/dev.sh
# Start full dev environment (sidecar + Tauri)
# ============================================================
set -euo pipefail

CYAN='\033[0;36m'; GOLD='\033[0;33m'; GREEN='\033[0;32m'; NC='\033[0m'
info() { echo -e "${CYAN}[NF]${NC} $*"; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── Start Python sidecar in background ───────────────────────────────────────
info "Starting Python sidecar on :7731…"
cd python_sidecar
uv run uvicorn main:app --host 127.0.0.1 --port 7731 --reload &
SIDECAR_PID=$!
cd "$ROOT"

# ── Wait for sidecar health ───────────────────────────────────────────────────
info "Waiting for sidecar…"
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:7731/health >/dev/null 2>&1; then
    echo -e "${GREEN}[✓]${NC} Sidecar ready"
    break
  fi
  sleep 1
done

# ── Start Tauri dev ───────────────────────────────────────────────────────────
info "Starting Tauri 2.0 dev window…"
cargo tauri dev

# ── Cleanup on exit ───────────────────────────────────────────────────────────
trap "kill $SIDECAR_PID 2>/dev/null; echo 'Dev stopped'" EXIT
