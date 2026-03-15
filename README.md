# ⬡ Neural Forge — v1.0.0-beta

> Gamified ML skill acquisition OS — Tauri 2.0 desktop app

A fullscreen, game-like learning environment for machine learning engineers, data engineers, and data scientists. Inspired by Ragnarok Online skill trees and spaced-repetition science.

---

## What's in the Beta

| Phase | Features |
|-------|----------|
| **P1 Foundation** | Skill trees (MLE/DE/DS), XP economy, tasks, projects, grind sessions, sleep vitals, Obsidian vault watcher, site blocker |
| **P2 Intelligence** | SM-2 spaced repetition, FAISS semantic vault search, local Ollama AI tutor + paper digest, analytics with sleep correlation |
| **P3 Ecosystem** | Knowledge graph (NetworkX + D3), WebSocket study rooms, plugin system, git auto-backup, Obsidian bidirectional sync, mobile REST API |

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Rust + Cargo | stable | Tauri 2.0 backend |
| Node.js | 20+ | Frontend build |
| Python | 3.11+ | Sidecar |
| [uv](https://docs.astral.sh/uv/) | latest | Python package manager |
| [Ollama](https://ollama.ai) | latest | Local LLM (optional) |
| [Obsidian](https://obsidian.md) | any | Vault notes (optional) |

---

## Quick Start

```bash
# 1. Clone and setup
git clone https://github.com/your-org/neural-forge
cd neural-forge
chmod +x scripts/setup.sh && ./scripts/setup.sh

# 2. Dev mode (starts sidecar + Tauri window)
./scripts/dev.sh

# 3. Or manually:
cd python_sidecar && uv run uvicorn main:app --port 7731 --reload &
cargo tauri dev
```

---

## Tauri 2.0 Migration Notes

This beta migrates from Tauri 1.x to Tauri 2.0. Key changes:

### Rust API
```rust
// Tauri 1.x — OLD
use tauri::{ SystemTray, SystemTrayMenu, ... };
tauri::api::path::data_dir()
app.get_window("main")

// Tauri 2.0 — NEW
use tauri::tray::{ TrayIconBuilder, TrayIcon };
app.path().app_data_dir()
app.get_webview_window("main")
```

### Configuration (`tauri.conf.json`)
```jsonc
// Tauri 1.x — OLD
{ "tauri": { "allowlist": { "fs": { "all": true } } } }

// Tauri 2.0 — NEW
{ "plugins": { "fs": { "scope": { "allow": ["$APPDATA/**"] } } } }
```

### Plugins
Tauri 2.0 uses an official plugin ecosystem. All former allowlist features are now separate crates:
```toml
tauri-plugin-fs           = "2"
tauri-plugin-dialog       = "2"
tauri-plugin-shell        = "2"
tauri-plugin-notification = "2"
tauri-plugin-updater      = "2"
tauri-plugin-autostart    = "2"
tauri-plugin-global-shortcut = "2"
```

### Frontend
```typescript
// Tauri 1.x — OLD
import { invoke } from "@tauri-apps/api/tauri";
import { appWindow } from "@tauri-apps/api/window";

// Tauri 2.0 — NEW
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
```

### Events
```typescript
// Tauri 2.0
import { listen } from "@tauri-apps/api/event";
const unlisten = await listen<{ status: string }>("sidecar-status", (e) => {
  console.log(e.payload.status);
});
```

---

## Architecture

```
neural-forge/
├── src-tauri/                  # Rust / Tauri 2.0 backend
│   └── src/
│       ├── main.rs             # App entry — all plugins registered here
│       ├── commands.rs         # Phase 1 IPC commands
│       ├── commands_p2.rs      # Phase 2 — sidecar proxy
│       ├── commands_p3.rs      # Phase 3 — sidecar proxy
│       ├── sidecar.rs          # Python process manager + HTTP client
│       ├── db.rs               # SQLite pool (WAL mode)
│       ├── watcher.rs          # Vault file watcher (notify crate)
│       ├── scheduler.rs        # Cron jobs (streak, SR reminder)
│       ├── blocker.rs          # /etc/hosts site blocker
│       └── backup.rs           # Git auto-commit on startup
│
├── python_sidecar/             # FastAPI — intelligence layer
│   ├── main.py                 # Unified router + lifespan
│   ├── config.py               # Pydantic settings (env vars)
│   ├── db.py                   # aiosqlite + all schema migrations
│   ├── sm2/                    # Spaced repetition (SM-2 algorithm)
│   ├── search/                 # FAISS semantic search
│   ├── llm/                    # Ollama chat, practice, paper digest
│   ├── analytics/              # XP trends, sleep correlation, forecasting
│   ├── sync/                   # Obsidian bidirectional sync + conflict resolution
│   ├── graph/                  # NetworkX knowledge graph → D3 JSON
│   ├── collab/                 # WebSocket study rooms
│   ├── plugins/                # Plugin base class + loader + hook dispatcher
│   ├── backup/                 # GitPython auto-backup + Syncthing bridge
│   └── mobile/                 # Bearer-auth REST API for companion app
│
├── src/                        # React + TypeScript frontend
│   ├── App.tsx                 # Root with all view routing
│   ├── api.ts                  # Typed Tauri 2.0 invoke() wrappers
│   ├── components/             # Phase 1 UI components
│   │   ├── Sidebar.tsx         # Full 3-phase navigation
│   │   ├── Dashboard.tsx       # XP / streak / activity overview
│   │   ├── Skills.tsx          # Skill tree canvas
│   │   ├── Grind.tsx           # Grind session logger
│   │   ├── Projects.tsx        # Kanban project board
│   │   ├── Vitals.tsx          # Sleep + energy tracker
│   │   └── Vault.tsx           # Obsidian note browser
│   └── views/                  # Phase 2 + 3 full-screen views
│       ├── SpacedRepetition.tsx
│       ├── AITutor.tsx
│       ├── Analytics.tsx
│       ├── KnowledgeGraph.tsx
│       ├── StudyRoom.tsx
│       ├── PluginManager.tsx
│       ├── Settings.tsx
│       └── Onboarding.tsx
│
├── migrations/                 # SQLite — applied by Rust sqlx migrate!
│   ├── 001_initial.sql         # Phase 1 schema
│   ├── 002_phase2.sql          # SR cards, embeddings, LLM tables
│   └── 003_phase3.sql          # Graph, rooms, plugins, backup, mobile
│
├── plugins/                    # Example plugins (copy to ~/.local/share/neural-forge/plugins/)
│   ├── daily_digest.py
│   ├── xp_webhook.py
│   └── github_tracker.py
│
└── scripts/
    ├── setup.sh                # One-time setup
    └── dev.sh                  # Start dev environment
```

---

## XP Economy

| Action | XP | SP |
|--------|----|----|
| Complete task | `xp_reward` (default 50) | +1 |
| Grind session | `min(problems×50, 500)` + 100 if ≥60min | +1 |
| Level up skill node | +200 | — |
| Complete project | +400 | +2 |
| Log sleep | +30 | — |
| Level up (every 1000 XP) | — | +3 |

SP (Skill Points) are spent to level up skill tree nodes (1 SP per level).

---

## Plugin System

Drop a `.py` file into `~/.local/share/neural-forge/plugins/`:

```python
from plugins.base import BasePlugin, PluginManifest

class MyPlugin(BasePlugin):
    manifest = PluginManifest(
        id    = "my-plugin",
        name  = "My Plugin",
        hooks = ["on_level_up", "on_task_complete"],
    )

    async def on_level_up(self, payload: dict):
        await self.notify("Level up!", f"Reached level {payload['level']}")

    async def on_task_complete(self, payload: dict):
        if payload["xp"] >= 200:
            await self.award_xp(50, "High-value task bonus")
```

Available hooks: `on_startup`, `on_skill_levelup`, `on_task_complete`, `on_grind_session_end`, `on_sr_review`, `on_vault_note_change`, `on_daily_reset`, `on_xp_gain`, `on_level_up`

---

## Running Tests

```bash
cd python_sidecar

# All tests
uv run pytest tests/ -v

# Specific suites
uv run pytest tests/test_beta.py   -v   # Full beta integration
uv run pytest tests/test_sm2.py    -v   # SM-2 algorithm
uv run pytest tests/test_phase3.py -v   # Phase 3 ecosystem
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NF_VAULT_PATH` | `""` | Obsidian vault directory |
| `NF_OLLAMA_URL` | `http://localhost:11434` | Ollama server |
| `NF_OLLAMA_MODEL` | `llama3` | Default model |
| `NF_EMBED_MODEL` | `all-MiniLM-L6-v2` | Embedding model |
| `NF_PORT` | `7731` | Sidecar HTTP port |
| `NF_DEBUG` | `false` | Enable `/docs` endpoint |
| `NF_DATA_DIR` | `~/.local/share/neural-forge` | DB + index dir |
| `NF_PLUGIN_DIR` | `~/.local/share/neural-forge/plugins` | Plugin directory |

---

## Building for Distribution

```bash
# macOS universal binary
cargo tauri build --target universal-apple-darwin

# Linux .deb + .AppImage
cargo tauri build

# Windows .msi + .exe
cargo tauri build
```

Artifacts appear in `src-tauri/target/release/bundle/`.

---

## License

MIT © Neural Forge Team
