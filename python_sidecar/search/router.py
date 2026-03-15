# ============================================================
# Neural Forge — search/router.py
# Semantic search over Obsidian vault using FAISS + embeddings
# ============================================================

from __future__ import annotations
from typing import List
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

from .indexer import semantic_search, build_index_if_stale

router = APIRouter()


class SearchResult(BaseModel):
    path:        str
    title:       str
    tags:        List[str]
    word_count:  int
    chunk_index: int
    chunk_text:  str
    score:       float


class SearchQuery(BaseModel):
    query: str
    top_k: int = 6


@router.post("/query", response_model=List[SearchResult])
async def search_vault(body: SearchQuery):
    """Semantic search over all indexed vault notes."""
    results = await semantic_search(body.query, body.top_k)
    return [SearchResult(**r) for r in results]


@router.get("/related/{skill_id}", response_model=List[SearchResult])
async def find_related_notes(skill_id: str, top_k: int = 5):
    """Find vault notes semantically related to a skill."""
    results = await semantic_search(skill_id.replace("-", " ").replace("_", " "), top_k)
    return [SearchResult(**r) for r in results]


@router.post("/reindex")
async def trigger_reindex(background_tasks: BackgroundTasks):
    """Force a full vault reindex (runs in background)."""
    background_tasks.add_task(build_index_if_stale)
    return {"status": "reindex started in background"}


@router.get("/stats")
async def index_stats():
    from .indexer import _index, _id_to_path
    return {
        "indexed_chunks": _index.ntotal if _index else 0,
        "unique_notes":   len(set(p for p, _ in _id_to_path)),
    }
