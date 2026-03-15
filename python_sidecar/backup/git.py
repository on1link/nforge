# ============================================================
# Neural Forge — backup/git.py
# Git-based auto-backup for vault + SQLite DB snapshots.
# Uses GitPython.
# ============================================================

from __future__ import annotations
import asyncio
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

import structlog

log = structlog.get_logger()


@dataclass
class CommitResult:
    status:        str   # 'ok' | 'nothing_to_commit' | 'error'
    message:       str
    commit_hash:   Optional[str] = None
    files_changed: int = 0


def _get_repo(data_dir: Path):
    """Get or init a git repo at data_dir."""
    import git
    repo_path = data_dir
    if not (repo_path / ".git").exists():
        repo = git.Repo.init(str(repo_path))
        # Create .gitignore
        (repo_path / ".gitignore").write_text(
            "*.index\n*.faiss\n__pycache__/\n.venv/\n"
        )
        log.info("Git repo initialised", path=str(repo_path))
    return git.Repo(str(repo_path))


def git_commit(data_dir: str, message: Optional[str] = None) -> CommitResult:
    """Stage all changes and create a commit."""
    try:
        import git
        path = Path(data_dir)
        repo = _get_repo(path)

        repo.git.add(A=True)
        if not repo.is_dirty(index=True, working_tree=True, untracked_files=True):
            return CommitResult(status="nothing_to_commit", message="Nothing to commit")

        changed = len(repo.index.diff("HEAD")) if repo.head.is_valid() else 1
        msg     = message or f"neural-forge auto-backup {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
        commit  = repo.index.commit(msg)
        log.info("Git commit", hash=commit.hexsha[:8], files=changed)
        return CommitResult(
            status        = "ok",
            message       = msg,
            commit_hash   = commit.hexsha,
            files_changed = changed,
        )
    except Exception as e:
        log.error("Git commit failed", error=str(e))
        return CommitResult(status="error", message=str(e))


def git_push(data_dir: str) -> str:
    """Push to remote if configured."""
    try:
        import git
        repo = _get_repo(Path(data_dir))
        if not repo.remotes:
            return "No remote configured. Add one: git -C <path> remote add origin <url>"
        origin = repo.remotes.origin
        origin.push()
        return "pushed"
    except Exception as e:
        return f"push failed: {e}"


def git_log(data_dir: str, limit: int = 20) -> list[dict]:
    """Return recent commit history."""
    try:
        import git
        repo    = _get_repo(Path(data_dir))
        commits = []
        for commit in list(repo.iter_commits())[:limit]:
            commits.append({
                "hash":    commit.hexsha[:8],
                "message": commit.message.strip(),
                "author":  str(commit.author),
                "date":    datetime.fromtimestamp(commit.committed_date).isoformat(),
            })
        return commits
    except Exception:
        return []


def git_status(data_dir: str) -> dict:
    """Return working tree status."""
    try:
        import git
        repo = _get_repo(Path(data_dir))
        return {
            "dirty":       repo.is_dirty(),
            "untracked":   len(repo.untracked_files),
            "branch":      str(repo.active_branch),
            "has_remote":  bool(repo.remotes),
            "last_commit": git_log(data_dir, 1)[0] if repo.head.is_valid() else None,
        }
    except Exception as e:
        return {"error": str(e)}


async def snapshot_db(db_path: str, backup_dir: str) -> str:
    """Copy SQLite DB to backup directory with timestamp."""
    src  = Path(db_path)
    dst  = Path(backup_dir) / "snapshots"
    dst.mkdir(parents=True, exist_ok=True)
    name = f"neural_forge_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.db"
    await asyncio.to_thread(shutil.copy2, str(src), str(dst / name))
    log.info("DB snapshot created", file=name)
    # Keep only last 10 snapshots
    snapshots = sorted(dst.glob("neural_forge_*.db"))
    for old in snapshots[:-10]:
        old.unlink(missing_ok=True)
    return str(dst / name)


async def ensure_git_repo(data_dir: str) -> None:
    """Ensure git repo exists at data_dir (called on startup)."""
    await asyncio.to_thread(_get_repo, Path(data_dir))


# ── Syncthing helpers ─────────────────────────────────────────────────────────

def syncthing_status(api_key: str, url: str = "http://localhost:8384") -> dict:
    """Query Syncthing REST API for sync status."""
    try:
        import httpx
        r = httpx.get(f"{url}/rest/system/status",
                      headers={"X-API-Key": api_key}, timeout=5)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return {"error": str(e), "hint": "Start Syncthing and check API key in Settings"}


def syncthing_folders(api_key: str, url: str = "http://localhost:8384") -> list:
    """List Syncthing-synced folders."""
    try:
        import httpx
        r = httpx.get(f"{url}/rest/config/folders",
                      headers={"X-API-Key": api_key}, timeout=5)
        r.raise_for_status()
        return r.json()
    except Exception:
        return []
