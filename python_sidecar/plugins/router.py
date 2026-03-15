# ============================================================
# Neural Forge — plugins/router.py
# ============================================================

from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json

from .loader import get_all_plugins, set_plugin_enabled, fire_hook
from db import get_db

router = APIRouter()


class ToggleIn(BaseModel):
    plugin_id: str
    enabled:   bool


class FireHookIn(BaseModel):
    hook:    str
    payload: dict = {}


@router.get("/")
async def list_plugins():
    return get_all_plugins()


@router.get("/events")
async def plugin_events(limit: int = 50):
    db = await get_db()
    async with db.execute(
        "SELECT * FROM plugin_events ORDER BY fired_at DESC LIMIT ?", (limit,)
    ) as cur:
        return [dict(r) for r in await cur.fetchall()]


@router.post("/toggle")
async def toggle_plugin(body: ToggleIn):
    ok = set_plugin_enabled(body.plugin_id, body.enabled)
    if not ok:
        raise HTTPException(404, f"Plugin '{body.plugin_id}' not found")
    db = await get_db()
    await db.execute(
        "UPDATE plugins SET enabled=? WHERE id=?",
        (int(body.enabled), body.plugin_id)
    )
    await db.commit()
    return {"plugin_id": body.plugin_id, "enabled": body.enabled}


@router.post("/fire")
async def fire_hook_endpoint(body: FireHookIn):
    """Manually fire a hook (for testing plugins)."""
    results = await fire_hook(body.hook, body.payload)
    return {"hook": body.hook, "results": results}


@router.get("/config/{plugin_id}")
async def get_plugin_config(plugin_id: str):
    db = await get_db()
    async with db.execute("SELECT config FROM plugins WHERE id=?", (plugin_id,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Plugin not found")
    return json.loads(row["config"])


@router.put("/config/{plugin_id}")
async def update_plugin_config(plugin_id: str, config: dict):
    db = await get_db()
    await db.execute(
        "UPDATE plugins SET config=? WHERE id=?",
        (json.dumps(config), plugin_id)
    )
    await db.commit()
    return {"updated": plugin_id}
