# ============================================================
# Neural Forge — collab/rooms.py
# WebSocket study room manager.
# Rooms are in-memory; messages also persisted to DB.
# Up to 8 users per room on LAN.
# ============================================================

from __future__ import annotations
import json
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Set

from fastapi import WebSocket
import structlog

log = structlog.get_logger()


class RoomMember:
    def __init__(self, ws: WebSocket, user_id: str, display_name: str):
        self.ws           = ws
        self.user_id      = user_id
        self.display_name = display_name
        self.joined_at    = datetime.utcnow().isoformat()
        self.xp_this_room = 0


class StudyRoom:
    MAX_MEMBERS = 8

    def __init__(self, room_id: str, name: str, topic: str = ""):
        self.room_id = room_id
        self.name    = name
        self.topic   = topic
        self.members: Dict[str, RoomMember] = {}

    def is_full(self) -> bool:
        return len(self.members) >= self.MAX_MEMBERS

    async def add_member(self, member: RoomMember) -> bool:
        if self.is_full():
            return False
        self.members[member.user_id] = member
        await self._broadcast({
            "type":     "member_joined",
            "user_id":  member.user_id,
            "name":     member.display_name,
            "members":  self._member_list(),
            "ts":       datetime.utcnow().isoformat(),
        }, exclude=member.user_id)
        # Send room state to the new member
        await member.ws.send_json({
            "type":    "room_state",
            "room_id": self.room_id,
            "name":    self.name,
            "topic":   self.topic,
            "members": self._member_list(),
        })
        log.info("Member joined", room=self.room_id, user=member.user_id)
        return True

    async def remove_member(self, user_id: str):
        if user_id in self.members:
            del self.members[user_id]
            await self._broadcast({
                "type":    "member_left",
                "user_id": user_id,
                "members": self._member_list(),
                "ts":      datetime.utcnow().isoformat(),
            })

    async def broadcast_message(self, user_id: str, msg_type: str, payload: dict):
        member  = self.members.get(user_id)
        display = member.display_name if member else user_id
        msg = {
            "type":     msg_type,
            "user_id":  user_id,
            "name":     display,
            "ts":       datetime.utcnow().isoformat(),
            **payload,
        }
        await self._broadcast(msg)
        # Persist chat messages
        if msg_type == "chat":
            from db import get_db
            db = await get_db()
            await db.execute(
                "INSERT INTO room_messages (room_id, user_id, msg_type, content) VALUES (?,?,?,?)",
                (self.room_id, user_id, "chat", payload.get("content",""))
            )
            await db.commit()

    async def _broadcast(self, msg: dict, exclude: Optional[str] = None):
        dead = []
        for uid, member in self.members.items():
            if uid == exclude:
                continue
            try:
                await member.ws.send_json(msg)
            except Exception:
                dead.append(uid)
        for uid in dead:
            await self.remove_member(uid)

    def _member_list(self) -> list:
        return [
            {"user_id": m.user_id, "name": m.display_name, "xp": m.xp_this_room, "joined": m.joined_at}
            for m in self.members.values()
        ]


# ── Room registry ─────────────────────────────────────────────────────────────
_rooms: Dict[str, StudyRoom] = {}


def get_or_create_room(room_id: str, name: str = "", topic: str = "") -> StudyRoom:
    if room_id not in _rooms:
        _rooms[room_id] = StudyRoom(room_id, name or room_id, topic)
        log.info("Room created", room=room_id)
    return _rooms[room_id]


def list_rooms() -> list:
    return [
        {"room_id": r.room_id, "name": r.name, "topic": r.topic, "members": len(r.members), "full": r.is_full()}
        for r in _rooms.values()
    ]


def delete_room(room_id: str):
    _rooms.pop(room_id, None)
