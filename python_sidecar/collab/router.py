# ============================================================
# Neural Forge — collab/router.py
# Study room REST + WebSocket endpoints
# WS URL: ws://localhost:7731/collab/ws/{room_id}?user_id=x&name=y
# ============================================================

from __future__ import annotations
import json
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from pydantic import BaseModel

from .rooms import get_or_create_room, list_rooms, delete_room, RoomMember
from db import get_db

router = APIRouter()


# ── REST ──────────────────────────────────────────────────────────────────────

class CreateRoomIn(BaseModel):
    room_id:  Optional[str] = None
    name:     str
    topic:    str = ""
    is_public: bool = True


@router.get("/rooms")
async def get_rooms():
    """List active rooms."""
    return list_rooms()


@router.post("/rooms")
async def create_room(body: CreateRoomIn):
    import uuid
    room_id = body.room_id or str(uuid.uuid4())[:8]
    room    = get_or_create_room(room_id, body.name, body.topic)
    db = await get_db()
    await db.execute(
        "INSERT OR IGNORE INTO study_rooms (id,name,topic,is_public) VALUES (?,?,?,?)",
        (room_id, body.name, body.topic, int(body.is_public))
    )
    await db.commit()
    return {"room_id": room_id, "name": body.name, "topic": body.topic}


@router.get("/rooms/{room_id}/messages")
async def get_messages(room_id: str, limit: int = 50):
    db = await get_db()
    async with db.execute(
        "SELECT * FROM room_messages WHERE room_id=? ORDER BY created_at DESC LIMIT ?",
        (room_id, limit)
    ) as cur:
        rows = await cur.fetchall()
    return list(reversed([dict(r) for r in rows]))


@router.delete("/rooms/{room_id}")
async def remove_room(room_id: str):
    delete_room(room_id)
    return {"deleted": room_id}


# ── WebSocket ─────────────────────────────────────────────────────────────────

@router.websocket("/ws/{room_id}")
async def websocket_endpoint(
    ws:      WebSocket,
    room_id: str,
    user_id: str = Query("default"),
    name:    str = Query("Learner"),
):
    await ws.accept()
    room   = get_or_create_room(room_id)
    member = RoomMember(ws, user_id, name)

    if not await room.add_member(member):
        await ws.send_json({"type": "error", "message": "Room is full (max 8 members)"})
        await ws.close()
        return

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type", "chat")

            # ── Chat ──────────────────────────────────────────────────────────
            if msg_type == "chat":
                await room.broadcast_message(user_id, "chat", {"content": msg.get("content","")})

            # ── Grind ping (share a solved problem) ───────────────────────────
            elif msg_type == "grind_ping":
                await room.broadcast_message(user_id, "grind_ping", {
                    "platform": msg.get("platform",""),
                    "problem":  msg.get("problem",""),
                    "xp":       msg.get("xp", 0),
                })
                if member:
                    member.xp_this_room += msg.get("xp", 0)

            # ── Task update ───────────────────────────────────────────────────
            elif msg_type == "task_update":
                await room.broadcast_message(user_id, "task_update", {
                    "task_name":  msg.get("task_name",""),
                    "done":       msg.get("done", False),
                })

            # ── XP celebrate ──────────────────────────────────────────────────
            elif msg_type == "celebrate":
                await room.broadcast_message(user_id, "celebrate", {
                    "event": msg.get("event",""),
                    "xp":    msg.get("xp", 0),
                    "emoji": msg.get("emoji","⭐"),
                })

            # ── Cursor (for real-time presence indicator) ─────────────────────
            elif msg_type == "cursor":
                await room.broadcast_message(user_id, "cursor", {
                    "view":    msg.get("view",""),
                    "section": msg.get("section",""),
                }, )  # Don't persist cursor events

            # ── Sync state request ────────────────────────────────────────────
            elif msg_type == "sync_state":
                await ws.send_json({
                    "type":    "room_state",
                    "members": room._member_list(),
                    "room_id": room_id,
                })

    except WebSocketDisconnect:
        await room.remove_member(user_id)
        log.info = lambda *a, **k: None  # Suppress after-disconnect logging
    except Exception as e:
        await room.remove_member(user_id)

    import structlog
    structlog.get_logger().info("Member left", room=room_id, user=user_id)
