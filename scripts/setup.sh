#!/usr/bin/env bash
# ============================================================
# Neural Forge v1.0.0-beta — scripts/setup.sh
# One-time setup: install all dependencies
# ============================================================
set -euo pipefail

CYAN='\033[0;36m'; GOLD='\033[0;33m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'

info()  { echo -e "${CYAN}[NF]${NC} $*"; }
ok()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${GOLD}[!]${NC} $*"; }
error() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

info "Neural Forge v1.0.0-beta setup"
echo ""

# ── Check Rust ────────────────────────────────────────────────────────────────
if ! command -v cargo &>/dev/null; then
  warn "Rust not found — installing via rustup"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
fi
ok "Rust $(rustc --version | awk '{print $2}')"

# ── Check Node ────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  error "Node.js not found. Install from https://nodejs.org (v20+)"
fi
ok "Node $(node --version)"

# ── Check Python ──────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  error "Python 3 not found. Install Python 3.11+"
fi
PY_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
ok "Python $PY_VER"

# ── Install uv ────────────────────────────────────────────────────────────────
if ! command -v uv &>/dev/null; then
  info "Installing uv (Python package manager)…"
  pip install uv --quiet
fi
ok "uv $(uv --version 2>/dev/null | head -1)"

# ── Install Tauri CLI ─────────────────────────────────────────────────────────
info "Installing Tauri CLI v2…"
cargo install tauri-cli --version "^2" --locked 2>/dev/null || true
ok "Tauri CLI"

# ── Linux system deps ─────────────────────────────────────────────────────────
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # Verificamos si dnf existe para confirmar que es una distro tipo Fedora/RHEL
  if command -v dnf &> /dev/null; then
    echo "Installing Linux system dependencies (Fedora/DNF)..."
    
    # Actualizamos caché (el || true evita que el script falle por el exit code 100 de dnf)
    sudo dnf check-update -q || true
    
    sudo dnf install -y -q \
      webkit2gtk4.1-devel \
      libappindicator-gtk3-devel \
      librsvg2-devel \
      patchelf \
      libxdo-devel
      
    echo "Linux deps installed successfully."
  fi
fi
# ── Frontend deps ─────────────────────────────────────────────────────────────
info "Installing Node dependencies…"
npm ci
ok "Node deps"

# ── Python sidecar ────────────────────────────────────────────────────────────
info "Installing Python sidecar dependencies…"
cd python_sidecar
uv sync --extra cpu
cd ..
ok "Python sidecar"

# ── Ollama check ──────────────────────────────────────────────────────────────
echo ""
if command -v ollama &>/dev/null; then
  ok "Ollama found"
  info "Pulling recommended model (llama3)…"
  ollama pull llama3 2>/dev/null || warn "Could not pull llama3 — run 'ollama pull llama3' manually"
else
  warn "Ollama not found — AI features will be unavailable"
  warn "Install from https://ollama.ai then run: ollama pull llama3"
fi

echo ""
ok "Setup complete! Run: ./scripts/dev.sh"
