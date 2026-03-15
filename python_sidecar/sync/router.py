# ============================================================
# Neural Forge — sync/router.py
# Obsidian sync endpoints: status, write-back, conflicts
# ============================================================

from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .watcher import check_conflict, resolve_conflict, index_note, deindex_note
from db import get_db
from pathlib import Path

router = APIRouter()


class WriteNoteIn(BaseModel):
    path:    str
    content: str
    force:   bool = False   # skip conflict check


class ConflictResolution(BaseModel):
    note_path:  str
    resolution: str   # 'local' | 'remote' | 'merge'


@router.get("/status")
async def sync_status():
    db = await get_db()
    async with db.execute("SELECT COUNT(*) as n FROM vault_index") as cur:
        note_count = (await cur.fetchone())["n"]
    async with db.execute("SELECT COUNT(*) as n FROM sync_conflicts WHERE resolution='pending'") as cur:
        conflict_count = (await cur.fetchone())["n"]
    async with db.execute(
        "SELECT created_at FROM backup_log ORDER BY created_at DESC LIMIT 1"
    ) as cur:
        last_backup = await cur.fetchone()
    return {
        "indexed_notes":    note_count,
        "pending_conflicts": conflict_count,
        "last_backup":      last_backup["created_at"] if last_backup else None,
        "watcher_active":   True,
    }


@router.post("/write")
async def write_note(body: WriteNoteIn):
    """
    Write content back to Obsidian vault.
    Used by the app to save AI-generated notes, paper digests, etc.
    Checks for conflicts unless force=True.
    """
    path = Path(body.path)
    if not body.force:
        conflict = await check_conflict(body.path, body.content)
        if conflict.get("conflict"):
            raise HTTPException(409, detail=conflict)

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body.content, encoding="utf-8")
    await index_note(path)
    return {"written": body.path, "bytes": len(body.content)}


@router.get("/conflicts")
async def list_conflicts():
    db = await get_db()
    async with db.execute(
        "SELECT * FROM sync_conflicts WHERE resolution='pending' ORDER BY created_at DESC"
    ) as cur:
        return [dict(r) for r in await cur.fetchall()]


@router.post("/resolve")
async def resolve(body: ConflictResolution):
    return await resolve_conflict(body.note_path, body.resolution)


@router.post("/reindex-vault")
async def reindex_vault():
    """Force re-index of all vault notes."""
    from config import settings
    from pathlib import Path as P
    vault = P(settings.VAULT_PATH)
    if not vault.exists():
        raise HTTPException(400, "Vault path not configured or doesn't exist")
    count = 0
    for md in vault.rglob("*.md"):
        await index_note(md)
        count += 1
    return {"reindexed": count}


@router.get("/recent")
async def recent_changes(limit: int = 20):
    db = await get_db()
    async with db.execute(
        "SELECT path, title, modified_at FROM vault_index ORDER BY modified_at DESC LIMIT ?",
        (limit,)
    ) as cur:
        return [dict(r) for r in await cur.fetchall()]
