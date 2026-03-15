# ============================================================
# Neural Forge — llm/ingest.py
# Paper ingestion: PDF → text → structured digest → Obsidian note
# ============================================================

from __future__ import annotations
import io
from pathlib import Path
from typing import Optional

import PyPDF2
from fastapi import APIRouter, UploadFile, File, HTTPException
import httpx
import structlog

from config import settings

router = APIRouter()
log    = structlog.get_logger()


def extract_pdf_text(data: bytes) -> str:
    """Extract text from a PDF byte stream."""
    reader = PyPDF2.PdfReader(io.BytesIO(data))
    pages  = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n\n".join(pages)


@router.post("/pdf")
async def ingest_pdf(
    file:         UploadFile = File(...),
    save_to_vault: bool = True,
    model:        Optional[str] = None,
):
    """
    Upload a PDF → extract text → LLM digest → optionally write to Obsidian vault.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files supported")

    data = await file.read()
    text = extract_pdf_text(data)

    if not text.strip():
        raise HTTPException(422, "Could not extract text from PDF — may be scanned/image-based")

    log.info("PDF extracted", filename=file.filename, chars=len(text))

    # Call the paper-digest endpoint via internal HTTP
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"http://localhost:{settings.PORT}/llm/paper-digest",
            json={
                "text":  text,
                "title": Path(file.filename).stem,
                "model": model,
            },
            timeout=120,
        )
        resp.raise_for_status()
        digest = resp.json()["digest"]

    # Optionally write structured note to Obsidian vault
    vault_path = None
    if save_to_vault and settings.VAULT_PATH:
        vault_path = await _write_paper_note(digest, file.filename)

    return {
        "filename":   file.filename,
        "char_count": len(text),
        "digest":     digest,
        "vault_note": vault_path,
    }


async def _write_paper_note(digest: dict, original_filename: str) -> Optional[str]:
    """Write structured paper digest as an Obsidian markdown note."""
    if not settings.VAULT_PATH:
        return None

    vault = Path(settings.VAULT_PATH)
    papers_dir = vault / "NeuralForge" / "Papers"
    papers_dir.mkdir(parents=True, exist_ok=True)

    title      = digest.get("title") or Path(original_filename).stem
    safe_title = "".join(c if c.isalnum() or c in " -_" else "_" for c in title)[:80]
    note_path  = papers_dir / f"{safe_title}.md"

    tags      = " ".join(digest.get("obsidian_tags", ["#paper"]))
    concepts  = "\n".join(f"- [[{c}]]" for c in digest.get("key_concepts", []))
    contribs  = "\n".join(f"- {c}" for c in digest.get("contributions", []))

    content = f"""---
tags: {tags}
source: {original_filename}
date: {__import__('datetime').date.today().isoformat()}
---

# {title}

> {digest.get("one_liner", "")}

## Problem
{digest.get("problem", "")}

## Method
{digest.get("method", "")}

## Results
{digest.get("results", "")}

## Key Contributions
{contribs}

## Limitations
{digest.get("limitations", "")}

## Relevance
{digest.get("relevance", "")}

## Key Concepts
{concepts}
"""

    note_path.write_text(content, encoding="utf-8")
    log.info("Paper note written", path=str(note_path))
    return str(note_path)
