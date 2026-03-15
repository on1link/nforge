# ============================================================
# Neural Forge v1.0.0-beta — python_sidecar/main.py
# Unified FastAPI sidecar — integrates all three phases:
#   Phase 1: Foundation (vault, config)
#   Phase 2: SM-2 · FAISS search · Ollama LLM · Analytics
#   Phase 3: Obsidian sync · Knowledge graph · Study rooms
#             Plugin system · Git backup · Mobile API
#
# Port: 7731  |  Shared SQLite DB in WAL mode
# ============================================================

from __future__ import annotations
import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

# ── Import routers ────────────────────────────────────────────────────────────
from sm2.router      import router as sr_router
from search.router   import router as search_router
from llm.router      import router as llm_router
from analytics.router import router as analytics_router
from sync.router     import router as sync_router
from graph.router    import router as graph_router
from collab.router   import router as collab_router
from plugins.router  import router as plugins_router
from backup.router   import router as backup_router
from mobile.router   import router as mobile_router
from config          import settings
from db              import init_db

log = structlog.get_logger()


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP ───────────────────────────────────────────────────────────────
    log.info("Neural Forge sidecar starting", version="1.0.0-beta")

    # Initialise DB (runs Phase 2 + 3 schema migrations)
    await init_db()

    # Vault watcher
    from sync.watcher import start_vault_watcher
    if settings.VAULT_PATH:
        await start_vault_watcher(settings.VAULT_PATH)

    # FAISS index (lazy rebuild if stale)
    try:
        from search.indexer import build_index_if_stale
        asyncio.create_task(build_index_if_stale())
    except Exception as e:
        log.warning("FAISS index skipped", error=str(e))

    # Knowledge graph (background build)
    try:
        from graph.builder import build_graph
        asyncio.create_task(build_graph())
    except Exception as e:
        log.warning("Graph build skipped", error=str(e))

    # Git backup repo init
    try:
        from backup.git import ensure_git_repo
        asyncio.create_task(ensure_git_repo(settings.DATA_DIR))
    except Exception as e:
        log.warning("Git init skipped", error=str(e))

    # Plugin loader
    try:
        from plugins.loader import load_all_plugins
        await load_all_plugins()
    except Exception as e:
        log.warning("Plugin load skipped", error=str(e))

    log.info("Neural Forge sidecar ready", port=settings.PORT)
    yield

    # ── SHUTDOWN ──────────────────────────────────────────────────────────────
    from sync.watcher import stop_vault_watcher
    stop_vault_watcher()
    log.info("Sidecar shut down cleanly")


# ── App factory ───────────────────────────────────────────────────────────────
app = FastAPI(
    title       = "Neural Forge Sidecar",
    version     = "1.0.0-beta",
    description = "Internal API for Neural Forge desktop app",
    lifespan    = lifespan,
    docs_url    = "/docs" if os.getenv("NF_DEBUG") else None,
    redoc_url   = None,
)

# CORS — only allow the Tauri webview origin
app.add_middleware(
    CORSMiddleware,
    allow_origins   = ["tauri://localhost", "http://localhost:5173", "http://localhost:1420"],
    allow_methods   = ["*"],
    allow_headers   = ["*"],
)

# ── Register routers ──────────────────────────────────────────────────────────
app.include_router(sr_router,        prefix="/sr",        tags=["Spaced Repetition"])
app.include_router(search_router,    prefix="/search",    tags=["Semantic Search"])
app.include_router(llm_router,       prefix="/llm",       tags=["LLM / Ollama"])
app.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])
app.include_router(sync_router,      prefix="/sync",      tags=["Obsidian Sync"])
app.include_router(graph_router,     prefix="/graph",     tags=["Knowledge Graph"])
app.include_router(collab_router,    prefix="/collab",    tags=["Study Rooms"])
app.include_router(plugins_router,   prefix="/plugins",   tags=["Plugins"])
app.include_router(backup_router,    prefix="/backup",    tags=["Backup"])
app.include_router(mobile_router,    prefix="/mobile",    tags=["Mobile API"])


# ── Health endpoint ───────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health():
    return {
        "status":  "ok",
        "version": "1.0.0-beta",
        "port":    settings.PORT,
    }


@app.get("/status", tags=["System"])
async def status():
    """Extended status — sidecar features summary."""
    from db import get_db
    db = await get_db()
    async with db.execute("SELECT COUNT(*) FROM vault_index") as cur:
        notes = (await cur.fetchone())[0]
    async with db.execute("SELECT COUNT(*) FROM sr_cards WHERE user_id='default'") as cur:
        cards = (await cur.fetchone())[0]
    async with db.execute("SELECT COUNT(*) FROM plugins WHERE enabled=1") as cur:
        plugins_on = (await cur.fetchone())[0]
    return {
        "indexed_notes":    notes,
        "sr_cards":         cards,
        "active_plugins":   plugins_on,
        "ollama_url":       settings.OLLAMA_URL,
        "vault_path":       settings.VAULT_PATH,
        "graph_built":      True,   # lazy; false until first /graph/data
        "version":          "1.0.0-beta",
    }
