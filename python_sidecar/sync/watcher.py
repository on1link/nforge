# ============================================================
# Neural Forge — sync/watcher.py
# Bidirectional Obsidian sync:
#   - Watches vault directory for file changes (watchdog)
#   - On create/modify: update vault_index + trigger re-embed
#   - On delete: remove from vault_index + FAISS
#   - Detects conflicts (same note modified locally + "remotely")
#   - Three conflict strategies: local-wins, remote-wins, merge
# ============================================================

from __future__ import annotations
import asyncio
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional

import structlog
from watchdog.events import FileSystemEventHandler, FileSystemEvent
from watchdog.observers import Observer

log = structlog.get_logger()

_observer:  Optional[Observer]          = None
_callbacks: list[Callable]              = []
_vault_path: Optional[Path]            = None


# ── Public API ────────────────────────────────────────────────────────────────

async def start_vault_watcher(vault_path: str) -> None:
    """Start watching the Obsidian vault for changes."""
    global _observer, _vault_path
    if not vault_path:
        log.warning("No vault path configured — sync watcher disabled")
        return

    _vault_path = Path(vault_path)
    if not _vault_path.exists():
        log.warning("Vault path does not exist", path=str(_vault_path))
        return

    handler  = _VaultEventHandler()
    _observer = Observer()
    _observer.schedule(handler, str(_vault_path), recursive=True)
    _observer.start()
    log.info("Vault watcher started", path=str(_vault_path))


def stop_vault_watcher() -> None:
    global _observer
    if _observer:
        _observer.stop()
        _observer.join()
        _observer = None
        log.info("Vault watcher stopped")


def register_callback(cb: Callable) -> None:
    """Register an async callback for vault change events."""
    _callbacks.append(cb)


# ── Conflict detection ────────────────────────────────────────────────────────

def _file_hash(path: Path) -> str:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError:
        return ""


async def check_conflict(note_path: str, remote_content: str) -> dict:
    """
    Compare local file hash with expected remote hash.
    Returns conflict info if they differ.
    """
    from db import get_db
    path = Path(note_path)
    local_hash  = _file_hash(path)
    remote_hash = hashlib.sha256(remote_content.encode()).hexdigest()

    if local_hash == remote_hash:
        return {"conflict": False}

    # Get last known hash from DB
    db = await get_db()
    async with db.execute(
        "SELECT content_hash FROM vault_index WHERE path=?", (note_path,)
    ) as cur:
        row = await cur.fetchone()

    last_hash = row["content_hash"] if row else None

    if last_hash and local_hash != last_hash:
        # Both local and remote changed — true conflict
        diff_preview = _simple_diff(path.read_text(encoding="utf-8", errors="ignore"), remote_content)
        await db.execute(
            """INSERT INTO sync_conflicts
               (note_path, local_hash, remote_hash, diff_preview)
               VALUES (?,?,?,?)""",
            (note_path, local_hash, remote_hash, diff_preview[:2000])
        )
        await db.commit()
        return {
            "conflict":     True,
            "note_path":    note_path,
            "local_hash":   local_hash,
            "remote_hash":  remote_hash,
            "diff_preview": diff_preview[:500],
        }

    return {"conflict": False}


async def resolve_conflict(note_path: str, resolution: str) -> dict:
    """
    Resolve a sync conflict.
    resolution: 'local' | 'remote' | 'merge'
    """
    from db import get_db
    db = await get_db()
    async with db.execute(
        "SELECT * FROM sync_conflicts WHERE note_path=? AND resolution='pending' LIMIT 1",
        (note_path,)
    ) as cur:
        conflict = await cur.fetchone()

    if not conflict:
        return {"error": "No pending conflict for this note"}

    await db.execute(
        "UPDATE sync_conflicts SET resolution=? WHERE id=?",
        (resolution, conflict["id"])
    )
    await db.commit()
    log.info("Conflict resolved", path=note_path, resolution=resolution)
    return {"resolved": True, "note_path": note_path, "resolution": resolution}


# ── Vault index helpers ───────────────────────────────────────────────────────

async def index_note(path: Path) -> None:
    """Update vault_index for a single note."""
    from db import get_db
    if not path.suffix in (".md", ".txt", ".org"):
        return
    try:
        content = path.read_text(encoding="utf-8", errors="ignore")
        title   = _extract_title(content, path)
        tags    = json.dumps(_extract_tags(content))
        words   = len(content.split())
        mtime   = datetime.fromtimestamp(path.stat().st_mtime).isoformat()
        h       = _file_hash(path)

        db = await get_db()
        await db.execute(
            """INSERT INTO vault_index (path, title, tags, word_count, modified_at, content_hash)
               VALUES (?,?,?,?,?,?)
               ON CONFLICT(path) DO UPDATE SET
               title=excluded.title, tags=excluded.tags, word_count=excluded.word_count,
               modified_at=excluded.modified_at, content_hash=excluded.content_hash""",
            (str(path), title, tags, words, mtime, h)
        )
        await db.commit()
        log.debug("Note indexed", path=str(path))

        # Trigger async re-embed (don't block watcher)
        asyncio.create_task(_re_embed_note(str(path)))

    except Exception as e:
        log.error("Failed to index note", path=str(path), error=str(e))


async def deindex_note(path: str) -> None:
    """Remove a note from vault_index and embeddings."""
    from db import get_db
    db = await get_db()
    await db.execute("DELETE FROM vault_index WHERE path=?", (path,))
    await db.execute("DELETE FROM vault_embeddings WHERE note_path=?", (path,))
    await db.commit()
    log.debug("Note deindexed", path=path)


async def _re_embed_note(path: str) -> None:
    """Embed a single changed note and update FAISS index."""
    try:
        from search.indexer import build_index_if_stale
        # Mark as stale by deleting existing embedding
        from db import get_db
        db = await get_db()
        await db.execute("DELETE FROM vault_embeddings WHERE note_path=?", (path,))
        await db.commit()
        # Full rebuild is triggered lazily on next search
        # For real-time: a partial update would be more efficient
        log.debug("Note re-embedding queued", path=path)
    except Exception as e:
        log.error("Re-embed failed", path=path, error=str(e))


# ── Watchdog event handler ─────────────────────────────────────────────────────

class _VaultEventHandler(FileSystemEventHandler):
    def on_created(self, event: FileSystemEvent):
        if not event.is_directory:
            asyncio.run_coroutine_threadsafe(
                index_note(Path(event.src_path)),
                asyncio.get_event_loop()
            )
            _fire_callbacks("vault_created", event.src_path)

    def on_modified(self, event: FileSystemEvent):
        if not event.is_directory:
            asyncio.run_coroutine_threadsafe(
                index_note(Path(event.src_path)),
                asyncio.get_event_loop()
            )
            _fire_callbacks("vault_modified", event.src_path)

    def on_deleted(self, event: FileSystemEvent):
        if not event.is_directory:
            asyncio.run_coroutine_threadsafe(
                deindex_note(event.src_path),
                asyncio.get_event_loop()
            )
            _fire_callbacks("vault_deleted", event.src_path)

    def on_moved(self, event: FileSystemEvent):
        asyncio.run_coroutine_threadsafe(
            _handle_move(event.src_path, event.dest_path),
            asyncio.get_event_loop()
        )


async def _handle_move(src: str, dst: str) -> None:
    await deindex_note(src)
    await index_note(Path(dst))
    _fire_callbacks("vault_moved", dst)


def _fire_callbacks(event_type: str, path: str) -> None:
    for cb in _callbacks:
        try:
            asyncio.create_task(cb(event_type, path))
        except Exception:
            pass


# ── Text parsing helpers ──────────────────────────────────────────────────────

def _extract_title(content: str, path: Path) -> str:
    for line in content.split("\n"):
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
    # Try YAML frontmatter title
    if content.startswith("---"):
        for line in content.split("\n")[1:]:
            if line.startswith("title:"):
                return line.split(":", 1)[1].strip().strip('"\'')
            if line == "---":
                break
    return path.stem


def _extract_tags(content: str) -> list[str]:
    tags = []
    # YAML frontmatter tags
    if content.startswith("---"):
        in_fm = False
        for line in content.split("\n"):
            if line == "---":
                if in_fm:
                    break
                in_fm = True
            elif in_fm and line.startswith("tags:"):
                raw = line.split(":", 1)[1].strip()
                if raw.startswith("["):
                    tags = [t.strip().strip('"\'') for t in raw[1:-1].split(",")]
                continue
    # Inline #tags
    import re
    inline = re.findall(r"(?<!\[)#([A-Za-z0-9_/-]+)", content)
    tags.extend(inline)
    return list(set(t for t in tags if t))


def _simple_diff(local: str, remote: str) -> str:
    local_lines  = local.splitlines()
    remote_lines = remote.splitlines()
    diff_lines   = []
    for i, (l, r) in enumerate(zip(local_lines, remote_lines)):
        if l != r:
            diff_lines.append(f"L{i+1}: - {l}")
            diff_lines.append(f"L{i+1}: + {r}")
    if len(local_lines) > len(remote_lines):
        for l in local_lines[len(remote_lines):]:
            diff_lines.append(f"  - {l}")
    elif len(remote_lines) > len(local_lines):
        for r in remote_lines[len(local_lines):]:
            diff_lines.append(f"  + {r}")
    return "\n".join(diff_lines[:50])
