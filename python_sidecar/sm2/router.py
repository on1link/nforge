# ============================================================
# Neural Forge — sm2/router.py
# FastAPI routes for spaced repetition card management.
# ============================================================

from __future__ import annotations
import uuid
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .engine import SRCard, review_card, initial_schedule
from db import get_db

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────
class CardOut(BaseModel):
    id:           str
    user_id:      str
    node_id:      str
    path_id:      str
    ease_factor:  float
    interval:     int
    repetitions:  int
    due_date:     str


class ReviewIn(BaseModel):
    card_id: str
    quality: int   # 0-5


class ReviewOut(BaseModel):
    card_id:       str
    quality:       int
    new_ef:        float
    new_interval:  int
    due_date:      str
    again:         bool


class CreateCardIn(BaseModel):
    node_id: str
    path_id: str
    user_id: str = "default"


# ── Helpers ───────────────────────────────────────────────────────────────────
async def _row_to_card(row) -> SRCard:
    return SRCard(
        id           = row["id"],
        user_id      = row["user_id"],
        node_id      = row["node_id"],
        path_id      = row["path_id"],
        ease_factor  = row["ease_factor"],
        interval     = row["interval"],
        repetitions  = row["repetitions"],
        due_date     = date.fromisoformat(row["due_date"]),
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/due", response_model=List[CardOut])
async def get_due_cards(user_id: str = "default", limit: int = 20):
    """Return cards due for review today (sorted by overdue first)."""
    db = await get_db()
    today = date.today().isoformat()
    async with db.execute(
        """SELECT * FROM sr_cards
           WHERE user_id = ? AND due_date <= ?
           ORDER BY due_date ASC LIMIT ?""",
        (user_id, today, limit)
    ) as cur:
        rows = await cur.fetchall()
    return [CardOut(**dict(r)) for r in rows]


@router.get("/all", response_model=List[CardOut])
async def get_all_cards(user_id: str = "default"):
    db = await get_db()
    async with db.execute(
        "SELECT * FROM sr_cards WHERE user_id = ? ORDER BY due_date ASC",
        (user_id,)
    ) as cur:
        rows = await cur.fetchall()
    return [CardOut(**dict(r)) for r in rows]


@router.post("/create", response_model=CardOut)
async def create_card(body: CreateCardIn):
    """Create a new SR card for a skill node (called after first level-up)."""
    db = await get_db()
    card = SRCard(
        id      = str(uuid.uuid4()),
        user_id = body.user_id,
        node_id = body.node_id,
        path_id = body.path_id,
    )
    initial_schedule(card)
    await db.execute(
        """INSERT INTO sr_cards
           (id, user_id, node_id, path_id, ease_factor, interval, repetitions, due_date)
           VALUES (?,?,?,?,?,?,?,?)""",
        (card.id, card.user_id, card.node_id, card.path_id,
         card.ease_factor, card.interval, card.repetitions,
         card.due_date.isoformat())
    )
    await db.commit()
    return CardOut(**{
        "id": card.id, "user_id": card.user_id, "node_id": card.node_id,
        "path_id": card.path_id, "ease_factor": card.ease_factor,
        "interval": card.interval, "repetitions": card.repetitions,
        "due_date": card.due_date.isoformat(),
    })


@router.post("/review", response_model=ReviewOut)
async def submit_review(body: ReviewIn):
    """Submit a review result and update card schedule."""
    db = await get_db()

    async with db.execute(
        "SELECT * FROM sr_cards WHERE id = ?", (body.card_id,)
    ) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, f"Card {body.card_id} not found")

    card   = await _row_to_card(row)
    result = review_card(card, body.quality)

    # Persist updated card state
    await db.execute(
        """UPDATE sr_cards
           SET ease_factor = ?, interval = ?, repetitions = ?, due_date = ?, last_review = datetime('now')
           WHERE id = ?""",
        (card.ease_factor, card.interval, card.repetitions,
         card.due_date.isoformat(), card.id)
    )
    # Log the review
    await db.execute(
        """INSERT INTO sr_reviews
           (card_id, user_id, quality, prev_ef, new_ef, prev_interval, new_interval)
           VALUES (?,?,?,?,?,?,?)""",
        (result.card_id, row["user_id"], result.quality,
         result.prev_ef, result.new_ef,
         result.prev_interval, result.new_interval)
    )
    await db.commit()

    return ReviewOut(
        card_id       = result.card_id,
        quality       = result.quality,
        new_ef        = result.new_ef,
        new_interval  = result.new_interval,
        due_date      = result.due_date.isoformat(),
        again         = result.again,
    )


@router.get("/stats")
async def card_stats(user_id: str = "default"):
    """Return SR system statistics for the analytics dashboard."""
    db = await get_db()
    today = date.today().isoformat()
    async with db.execute(
        "SELECT COUNT(*) as total FROM sr_cards WHERE user_id=?", (user_id,)
    ) as cur:
        total = (await cur.fetchone())["total"]
    async with db.execute(
        "SELECT COUNT(*) as due FROM sr_cards WHERE user_id=? AND due_date<=?",
        (user_id, today)
    ) as cur:
        due = (await cur.fetchone())["due"]
    async with db.execute(
        "SELECT AVG(ease_factor) as avg_ef FROM sr_cards WHERE user_id=?", (user_id,)
    ) as cur:
        avg_ef = (await cur.fetchone())["avg_ef"] or 2.5
    async with db.execute(
        "SELECT COUNT(*) as reviews FROM sr_reviews WHERE user_id=?", (user_id,)
    ) as cur:
        reviews = (await cur.fetchone())["reviews"]

    return {
        "total_cards":    total,
        "due_today":      due,
        "avg_ease_factor": round(avg_ef, 3),
        "total_reviews":  reviews,
        "retention_target": "90%",
    }
