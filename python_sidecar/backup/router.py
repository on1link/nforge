# ============================================================
# Neural Forge — backup/router.py
# Git backup + Syncthing status endpoints
# ============================================================

from __future__ import annotations
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import asyncio

from .git import git_commit, git_push, git_log, git_status, snapshot_db, syncthing_status, syncthing_folders
from config import settings
from db import get_db

router = APIRouter()


class CommitIn(BaseModel):
    message: Optional[str] = None


@router.get("/status")
async def backup_status():
    data_dir = settings.BACKUP_DIR if hasattr(settings, "BACKUP_DIR") else str(__import__("pathlib").Path.home() / ".local/share/neural-forge")
    return git_status(data_dir)


@router.post("/commit")
async def backup_commit(body: CommitIn):
    data_dir = str(__import__("pathlib").Path.home() / ".local/share/neural-forge")
    result   = await asyncio.to_thread(git_commit, data_dir, body.message)
    db = await get_db()
    await db.execute(
        "INSERT INTO backup_log (backup_type, target, commit_hash, files_changed, status) VALUES (?,?,?,?,?)",
        ("git", "vault+db", result.commit_hash, result.files_changed, result.status)
    )
    await db.commit()
    return result


@router.post("/push")
async def backup_push():
    data_dir = str(__import__("pathlib").Path.home() / ".local/share/neural-forge")
    msg      = await asyncio.to_thread(git_push, data_dir)
    return {"result": msg}


@router.get("/log")
async def backup_log_endpoint(limit: int = 20):
    data_dir = str(__import__("pathlib").Path.home() / ".local/share/neural-forge")
    return git_log(data_dir, limit)


@router.post("/snapshot-db")
async def snapshot_database():
    from config import settings
    data_dir = str(__import__("pathlib").Path.home() / ".local/share/neural-forge")
    path     = await snapshot_db(settings.DB_PATH, data_dir)
    return {"snapshot": path}


@router.get("/syncthing/status")
async def get_syncthing_status(api_key: str = "", url: str = "http://localhost:8384"):
    return syncthing_status(api_key, url)


@router.get("/syncthing/folders")
async def get_syncthing_folders(api_key: str = "", url: str = "http://localhost:8384"):
    return syncthing_folders(api_key, url)
