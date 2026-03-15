# ============================================================
# Neural Forge — plugins/base.py
# Base class and manifest for all Neural Forge plugins.
# ============================================================

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Callable, Optional


@dataclass
class PluginManifest:
    id:          str
    name:        str
    version:     str
    description: str  = ""
    author:      str  = ""
    hooks:       list[str] = field(default_factory=list)
    config_schema: dict    = field(default_factory=dict)  # JSON schema for settings


class BasePlugin:
    """
    Base class for all Neural Forge plugins.
    Override hook methods you care about.
    """
    manifest: PluginManifest

    def __init__(self, config: dict | None = None):
        self.config  = config or {}
        self.enabled = True

    # ── Available hooks (override any) ───────────────────────────────────────

    async def on_startup(self)                        -> None: pass
    async def on_skill_levelup(self, payload: dict)   -> Any:  pass
    async def on_task_complete(self, payload: dict)   -> Any:  pass
    async def on_grind_session_end(self, payload: dict)-> Any: pass
    async def on_sr_review(self, payload: dict)       -> Any:  pass
    async def on_vault_note_change(self, payload: dict)-> Any: pass
    async def on_daily_reset(self, payload: dict)     -> Any:  pass
    async def on_xp_gain(self, payload: dict)         -> Any:  pass
    async def on_level_up(self, payload: dict)        -> Any:  pass

    # ── Utility helpers available to all plugins ──────────────────────────────

    async def write_vault_note(self, path: str, content: str) -> None:
        """Write a note to the Obsidian vault."""
        from sync.watcher import index_note
        from pathlib import Path
        from config import settings
        full_path = Path(settings.VAULT_PATH) / path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content, encoding="utf-8")
        await index_note(full_path)

    async def award_xp(self, amount: int, reason: str) -> None:
        """Award XP to the default user."""
        from db import get_db
        db = await get_db()
        await db.execute(
            "UPDATE users SET xp=xp+? WHERE id='default'", (amount,)
        )
        await db.execute(
            "INSERT INTO activity_log (user_id, entry_type, description, xp) VALUES ('default','plugin',?,?)",
            (reason, amount)
        )
        await db.commit()

    async def notify(self, title: str, body: str) -> None:
        """Send a desktop notification (Tauri handles delivery)."""
        # The sidecar can't send Tauri notifications directly;
        # instead queue in a notifications table polled by the frontend.
        from db import get_db
        db = await get_db()
        try:
            await db.execute(
                "INSERT INTO notifications (title, body) VALUES (?,?)",
                (title, body)
            )
            await db.commit()
        except Exception:
            pass  # notifications table may not exist; graceful fail
