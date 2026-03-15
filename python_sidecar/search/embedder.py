# ============================================================
# Neural Forge — search/embedder.py
# Sentence-transformers embedding model — singleton.
# Uses all-MiniLM-L6-v2 (80MB, fast, good quality).
# For higher quality use all-mpnet-base-v2 (420MB).
# ============================================================

from __future__ import annotations
import asyncio
import numpy as np
from typing import List, Optional
from sentence_transformers import SentenceTransformer
from config import settings
import structlog

log = structlog.get_logger()
_embedder: Optional["Embedder"] = None


class Embedder:
    def __init__(self, model_name: str):
        self.model_name = model_name
        log.info("Loading embedding model", model=model_name)
        self._model = SentenceTransformer(model_name)
        self.dim = self._model.get_sentence_embedding_dimension()
        log.info("Embedding model loaded", dim=self.dim)

    def embed(self, texts: List[str], batch_size: int = 64) -> np.ndarray:
        """Embed a list of strings → float32 array (N, dim)."""
        return self._model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=True,   # cosine similarity via dot product
            show_progress_bar=len(texts) > 100,
            convert_to_numpy=True,
        ).astype(np.float32)

    def embed_one(self, text: str) -> np.ndarray:
        return self.embed([text])[0]


async def get_embedder() -> Embedder:
    global _embedder
    if _embedder is None:
        # Run blocking load in thread pool
        loop = asyncio.get_event_loop()
        _embedder = await loop.run_in_executor(
            None, Embedder, settings.EMBED_MODEL
        )
    return _embedder
