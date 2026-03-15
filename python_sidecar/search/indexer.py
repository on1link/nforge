# ============================================================
# Neural Forge — search/indexer.py
# Builds and maintains a FAISS index over Obsidian vault notes.
# Uses IVFFlat index for fast ANN search over large vaults.
# ============================================================

from __future__ import annotations
import asyncio
import json
import os
from pathlib import Path
from typing import List, Tuple

import faiss
import numpy as np
import structlog

from config import settings
from db import get_db
from .embedder import get_embedder

log = structlog.get_logger()

_index:      faiss.IndexFlatIP | None = None
_id_to_path: List[Tuple[str, int]]    = []  # [(note_path, chunk_index)]


# ── Chunking ──────────────────────────────────────────────────────────────────
def chunk_text(text: str, max_tokens: int = 256, overlap: int = 32) -> List[str]:
    """Split text into overlapping chunks by word count."""
    words  = text.split()
    chunks = []
    step   = max_tokens - overlap
    for i in range(0, len(words), step):
        chunk = " ".join(words[i : i + max_tokens])
        if chunk:
            chunks.append(chunk)
    return chunks or [text[:1024]]   # fallback: first 1024 chars


# ── Build / refresh index ─────────────────────────────────────────────────────
async def build_index_if_stale() -> None:
    """Rebuild FAISS index if vault has new/modified notes."""
    global _index, _id_to_path

    db        = await get_db()
    embedder  = await get_embedder()
    faiss_path = Path(settings.FAISS_PATH)

    # Count notes in DB
    async with db.execute("SELECT COUNT(*) as n FROM vault_index") as cur:
        note_count = (await cur.fetchone())["n"]

    if note_count == 0:
        log.info("No vault notes to index")
        return

    # Check if index is fresh
    async with db.execute("SELECT COUNT(*) as n FROM vault_embeddings") as cur:
        embed_count = (await cur.fetchone())["n"]

    if embed_count > 0 and faiss_path.exists():
        log.info("FAISS index is fresh", notes=note_count, embeddings=embed_count)
        _load_index(faiss_path)
        await _load_id_map()
        return

    log.info("Building FAISS index", notes=note_count)
    await _rebuild_index(db, embedder, faiss_path)


async def _rebuild_index(db, embedder, faiss_path: Path) -> None:
    global _index, _id_to_path

    # Clear old embeddings
    await db.execute("DELETE FROM vault_embeddings")

    # Fetch all notes
    async with db.execute("SELECT path FROM vault_index ORDER BY modified_at DESC") as cur:
        note_rows = await cur.fetchall()

    all_chunks: List[str]              = []
    all_meta:   List[Tuple[str, int]]  = []

    for row in note_rows:
        try:
            content = Path(row["path"]).read_text(encoding="utf-8", errors="ignore")
            chunks  = chunk_text(content)
            for i, chunk in enumerate(chunks):
                all_chunks.append(chunk)
                all_meta.append((row["path"], i))
        except (OSError, IOError):
            continue

    if not all_chunks:
        log.warning("No text chunks to embed")
        return

    # Embed all chunks in batches
    loop       = asyncio.get_event_loop()
    embeddings = await loop.run_in_executor(None, embedder.embed, all_chunks)

    # Build FAISS flat inner-product index (normalised vectors → cosine sim)
    dim    = embeddings.shape[1]
    index  = faiss.IndexFlatIP(dim)
    index.add(embeddings)

    # Persist index to disk
    faiss_path.parent.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, str(faiss_path))

    # Persist metadata to DB
    for faiss_id, (path, chunk_idx) in enumerate(all_meta):
        chunk_text_ = all_chunks[faiss_id]
        await db.execute(
            """INSERT OR REPLACE INTO vault_embeddings
               (note_path, faiss_id, chunk_index, chunk_text)
               VALUES (?,?,?,?)""",
            (path, faiss_id, chunk_idx, chunk_text_[:2000])
        )
    await db.commit()

    _index     = index
    _id_to_path = all_meta
    log.info("FAISS index built", chunks=len(all_chunks), dim=dim)


def _load_index(path: Path) -> None:
    global _index
    _index = faiss.read_index(str(path))
    log.info("FAISS index loaded from disk", ntotal=_index.ntotal)


async def _load_id_map() -> None:
    global _id_to_path
    db = await get_db()
    async with db.execute(
        "SELECT note_path, chunk_index FROM vault_embeddings ORDER BY faiss_id ASC"
    ) as cur:
        rows = await cur.fetchall()
    _id_to_path = [(r["note_path"], r["chunk_index"]) for r in rows]


# ── Search ────────────────────────────────────────────────────────────────────
async def semantic_search(query: str, top_k: int = 8) -> List[dict]:
    """Return top-k most semantically similar vault chunks."""
    global _index, _id_to_path

    if _index is None or _index.ntotal == 0:
        return []

    embedder = await get_embedder()
    loop     = asyncio.get_event_loop()
    q_vec    = await loop.run_in_executor(None, embedder.embed_one, query)
    q_vec    = q_vec.reshape(1, -1)

    scores, indices = _index.search(q_vec, min(top_k * 2, _index.ntotal))

    db     = await get_db()
    result = []

    for score, faiss_id in zip(scores[0], indices[0]):
        if faiss_id < 0 or faiss_id >= len(_id_to_path):
            continue

        note_path, chunk_idx = _id_to_path[faiss_id]

        async with db.execute(
            "SELECT title, tags, word_count FROM vault_index WHERE path=?", (note_path,)
        ) as cur:
            meta = await cur.fetchone()

        async with db.execute(
            "SELECT chunk_text FROM vault_embeddings WHERE faiss_id=?", (faiss_id,)
        ) as cur:
            chunk_row = await cur.fetchone()

        result.append({
            "path":        note_path,
            "title":       meta["title"]      if meta else Path(note_path).stem,
            "tags":        json.loads(meta["tags"]) if meta else [],
            "word_count":  meta["word_count"] if meta else 0,
            "chunk_index": chunk_idx,
            "chunk_text":  chunk_row["chunk_text"] if chunk_row else "",
            "score":       float(score),
        })

    # Deduplicate by note path (keep highest score)
    seen     = {}
    deduped  = []
    for r in result:
        if r["path"] not in seen:
            seen[r["path"]] = True
            deduped.append(r)

    return deduped[:top_k]
