# ============================================================
# Neural Forge — python_sidecar/db.py
# Async SQLite via aiosqlite. Applies all migrations in order.
# Shared read/write with Rust via WAL mode.
# ============================================================

from __future__ import annotations
import os
import aiosqlite
from pathlib import Path
from config import settings
import structlog

# Make sure this path correctly points to where your .sql files live 
# relative to this python script.
MIGRATIONS_DIR = Path(__file__).parent.parent / "migrations"

log = structlog.get_logger()

_db: aiosqlite.Connection | None = None


async def get_db() -> aiosqlite.Connection:
    global _db
    if _db is None:
        raise RuntimeError("DB not initialised — call init_db() first")
    return _db


async def init_db() -> None:
    global _db
    
    db_file = Path(settings.DB_PATH)
    
    db_file.parent.mkdir(parents=True, exist_ok=True)
    
    db_file.touch(exist_ok=True)  # ensure file exists for WAL mode

    _db = await aiosqlite.connect(settings.DB_PATH)
    _db.row_factory = aiosqlite.Row

    # Match Rust PRAGMA settings
    await _db.execute("PRAGMA journal_mode = WAL")
    await _db.execute("PRAGMA foreign_keys = ON")
    await _db.execute("PRAGMA synchronous = NORMAL")
    await _db.execute("PRAGMA cache_size = -16000")
    await _db.commit()

    await run_sql_migrations()

    log.info("DB initialised", path=settings.DB_PATH)


async def run_sql_migrations() -> None:
    """
    Scans the migrations directory, sorts the .sql files, and executes them in order.
    Uses a tracking table to ensure idempotency and prevent split-brain schema issues.
    """
    # 1. Create a tracking table to record which migrations have already run
    await _db.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    """)
    await _db.commit()

    if not MIGRATIONS_DIR.exists():
        log.warning(f"Migrations directory not found at {MIGRATIONS_DIR}. Skipping migrations.")
        return

    # 2. Grab all .sql files and sort them alphabetically (001 -> 002 -> 003)
    sql_files = sorted(MIGRATIONS_DIR.glob("*.sql"))

    for sql_file in sql_files:
        version = sql_file.name
        
        # 3. Check if this specific migration has already been applied
        async with _db.execute("SELECT 1 FROM schema_migrations WHERE version = ?", (version,)) as cursor:
            if await cursor.fetchone():
                log.debug(f"Migration {version} already applied. Skipping.")
                continue

        log.info(f"Applying migration: {version}")
        
        # 4. Read the raw SQL from the file
        sql_script = sql_file.read_text(encoding="utf-8")
        
        try:
            # 5. Execute the entire file as a single script
            await _db.executescript(sql_script)
            
            # 6. Record the success in the tracking table
            await _db.execute("INSERT INTO schema_migrations (version) VALUES (?)", (version,))
            await _db.commit()
            
            log.info(f"Successfully applied {version}")
            
        except Exception as e:
            log.error(f"Failed to apply migration {version}: {e}")
            # If a migration fails, we must halt the application startup immediately 
            # to prevent data corruption.
            raise RuntimeError(f"Database migration failed on {version}") from e

    