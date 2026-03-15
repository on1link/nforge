# ============================================================
# Neural Forge — mobile/router.py
# Compact REST API for React Native mobile companion.
# Auth: Bearer token (API key) in Authorization header.
# ============================================================

from __future__ import annotations
import hashlib
import secrets
from typing import Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from db import get_db

router = APIRouter()


# ── Auth ──────────────────────────────────────────────────────────────────────

def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def _verify_key(authorization: Optional[str]) -> str:
    """Verify Bearer token, return user_id."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    raw     = authorization.split(" ", 1)[1]
    hashed  = _hash_key(raw)
    db      = await get_db()
    async with db.execute(
        "SELECT user_id FROM mobile_api_keys WHERE key_hash=?", (hashed,)
    ) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(401, "Invalid API key")
    await db.execute(
        "UPDATE mobile_api_keys SET last_used=datetime('now') WHERE key_hash=?", (hashed,)
    )
    await db.commit()
    return row["user_id"]


# ── Key management ────────────────────────────────────────────────────────────

class GenerateKeyIn(BaseModel):
    label:   str = "Mobile companion"
    user_id: str = "default"


@router.post("/keys/generate")
async def generate_api_key(body: GenerateKeyIn):
    """Generate a new mobile API key. Show once — store it securely."""
    raw    = secrets.token_urlsafe(32)
    hashed = _hash_key(raw)
    db     = await get_db()
    await db.execute(
        "INSERT INTO mobile_api_keys (key_hash, label, user_id) VALUES (?,?,?)",
        (hashed, body.label, body.user_id)
    )
    await db.commit()
    return {
        "key":     raw,
        "warning": "Store this key securely — it will not be shown again.",
        "label":   body.label,
    }


@router.get("/keys")
async def list_keys():
    db = await get_db()
    async with db.execute(
        "SELECT id, label, last_used, created_at FROM mobile_api_keys"
    ) as cur:
        return [dict(r) for r in await cur.fetchall()]


@router.delete("/keys/{key_id}")
async def revoke_key(key_id: str):
    db = await get_db()
    await db.execute("DELETE FROM mobile_api_keys WHERE id=?", (key_id,))
    await db.commit()
    return {"revoked": key_id}


# ── Mobile endpoints ──────────────────────────────────────────────────────────

@router.get("/dashboard")
async def mobile_dashboard(authorization: Optional[str] = Header(None)):
    user_id = await _verify_key(authorization)
    db      = await get_db()

    async with db.execute(
        "SELECT xp, level, sp, streak FROM users WHERE id=?", (user_id,)
    ) as cur:
        user = dict(await cur.fetchone() or {})

    async with db.execute(
        "SELECT COUNT(*) as n FROM sr_cards WHERE user_id=? AND due_date<=date('now')",
        (user_id,)
    ) as cur:
        sr_due = (await cur.fetchone())["n"]

    async with db.execute(
        "SELECT COUNT(*) as n FROM tasks WHERE user_id=? AND done=0",
        (user_id,)
    ) as cur:
        tasks_pending = (await cur.fetchone())["n"]

    async with db.execute(
        "SELECT SUM(xp) as xp FROM activity_log WHERE user_id=? AND created_at>=date('now')",
        (user_id,)
    ) as cur:
        xp_today = int((await cur.fetchone())["xp"] or 0)

    return {
        "user":          user,
        "sr_due":        sr_due,
        "tasks_pending": tasks_pending,
        "xp_today":      xp_today,
    }


@router.get("/sr/due")
async def mobile_sr_due(authorization: Optional[str] = Header(None), limit: int = 10):
    user_id = await _verify_key(authorization)
    from sm2.router import get_due_cards
    return await get_due_cards(user_id=user_id, limit=limit)


@router.post("/sr/review")
async def mobile_sr_review(
    card_id: str, quality: int,
    authorization: Optional[str] = Header(None)
):
    await _verify_key(authorization)
    from sm2.router import submit_review
    from sm2.router import ReviewIn
    return await submit_review(ReviewIn(card_id=card_id, quality=quality))


@router.get("/goals")
async def mobile_goals(authorization: Optional[str] = Header(None)):
    user_id = await _verify_key(authorization)
    db      = await get_db()
    async with db.execute(
        """SELECT g.title, g.description, g.target_date, g.progress, g.total
           FROM goals g WHERE g.user_id=? AND g.done=0
           ORDER BY g.target_date ASC LIMIT 5""",
        (user_id,)
    ) as cur:
        return [dict(r) for r in await cur.fetchall()]


@router.post("/log/sleep")
async def mobile_log_sleep(
    hours:   float,
    quality: int,
    energy:  int,
    authorization: Optional[str] = Header(None),
):
    user_id = await _verify_key(authorization)
    db      = await get_db()
    await db.execute(
        """INSERT INTO sleep_logs (user_id, log_date, hours, quality, energy)
           VALUES (?,date('now'),?,?,?)
           ON CONFLICT(user_id, log_date) DO UPDATE
           SET hours=excluded.hours, quality=excluded.quality, energy=excluded.energy""",
        (user_id, hours, quality, energy)
    )
    await db.execute(
        "UPDATE users SET xp=xp+30 WHERE id=?", (user_id,)
    )
    await db.commit()
    return {"logged": True, "xp_awarded": 30}


@router.get("/vault/search")
async def mobile_vault_search(
    query: str,
    authorization: Optional[str] = Header(None),
    top_k: int = 5,
):
    await _verify_key(authorization)
    from search.indexer import semantic_search
    return await semantic_search(query, top_k)
