# ============================================================
# Neural Forge — llm/router.py
# Ollama LLM endpoints:
#   - /chat           → conversational Q&A with context injection
#   - /practice       → generate practice problems for a skill
#   - /explain        → explain a concept at target level
#   - /paper-digest   → summarise arXiv / uploaded paper
#   - /models         → list available Ollama models
# ============================================================

from __future__ import annotations
import uuid
from typing import List, Optional, AsyncGenerator

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import settings
from db import get_db
from search.indexer import semantic_search

router = APIRouter()

OLLAMA_BASE = settings.OLLAMA_URL


# ── Schemas ───────────────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role:    str      # "user" | "assistant" | "system"
    content: str


class ChatIn(BaseModel):
    messages:     List[ChatMessage]
    session_id:   Optional[str] = None
    model:        Optional[str] = None
    context_type: str = "general"     # "general" | "skill" | "vault"
    skill_id:     Optional[str] = None
    stream:       bool = False


class PracticeIn(BaseModel):
    skill_id:   str
    path_id:    str
    skill_name: str
    level:      int = 1         # 1-10 current skill level
    difficulty: str = "Medium"  # Easy | Medium | Hard
    count:      int = 3
    model:      Optional[str] = None


class ExplainIn(BaseModel):
    concept:        str
    target_level:   str = "intermediate"   # beginner | intermediate | expert
    analogy_domain: Optional[str] = None   # e.g. "cooking", "gaming"
    model:          Optional[str] = None


class DigestIn(BaseModel):
    text:   str        # paper content (pre-extracted)
    title:  Optional[str] = None
    model:  Optional[str] = None


# ── Ollama helpers ────────────────────────────────────────────────────────────
async def _ollama_chat(
    messages: list[dict],
    model:    str,
    stream:   bool = False,
) -> str | AsyncGenerator[str, None]:
    """Call Ollama /api/chat. Returns full text or async generator for streaming."""
    payload = {
        "model":    model,
        "messages": messages,
        "stream":   stream,
        "options": {
            "temperature":  0.7,
            "num_predict":  1024,
            "num_ctx":      4096,
        },
    }
    async with httpx.AsyncClient(timeout=120) as client:
        if stream:
            async def _gen():
                async with client.stream("POST", f"{OLLAMA_BASE}/api/chat", json=payload) as resp:
                    async for line in resp.aiter_lines():
                        if line:
                            import json
                            data = json.loads(line)
                            if token := data.get("message", {}).get("content", ""):
                                yield token
            return _gen()

        resp = await client.post(f"{OLLAMA_BASE}/api/chat", json=payload)
        resp.raise_for_status()
        return resp.json()["message"]["content"]


def _resolve_model(requested: Optional[str]) -> str:
    return requested or settings.OLLAMA_MODEL


# ── /models ───────────────────────────────────────────────────────────────────
@router.get("/models")
async def list_models():
    """List models available in the local Ollama instance."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{OLLAMA_BASE}/api/tags")
            r.raise_for_status()
            data = r.json()
            return {"models": [m["name"] for m in data.get("models", [])]}
    except Exception as e:
        return {"models": [], "error": str(e), "hint": "Is Ollama running? `ollama serve`"}


# ── /chat ─────────────────────────────────────────────────────────────────────
@router.post("/chat")
async def chat(body: ChatIn):
    """
    Conversational endpoint with optional vault context injection.
    If context_type='vault', retrieves relevant notes and prepends them.
    """
    model      = _resolve_model(body.model)
    session_id = body.session_id or str(uuid.uuid4())
    db         = await get_db()

    # ── Build system prompt ───────────────────────────────────────────────
    system = _system_prompt(body.context_type, body.skill_id)

    # ── Vault RAG context injection ───────────────────────────────────────
    vault_context = ""
    if body.context_type == "vault" and body.messages:
        last_query = body.messages[-1].content
        results    = await semantic_search(last_query, top_k=4)
        if results:
            vault_context = "\n\n## Relevant vault notes:\n" + "\n---\n".join(
                f"**{r['title']}** (score:{r['score']:.2f})\n{r['chunk_text']}"
                for r in results
            )
            system += vault_context

    # ── Load conversation history from DB ─────────────────────────────────
    async with db.execute(
        """SELECT role, content FROM llm_conversations
           WHERE session_id=? ORDER BY created_at ASC LIMIT 20""",
        (session_id,)
    ) as cur:
        history = [{"role": r["role"], "content": r["content"]} for r in await cur.fetchall()]

    messages = [{"role": "system", "content": system}]
    messages += history
    messages += [{"role": m.role, "content": m.content} for m in body.messages]

    if body.stream:
        gen = await _ollama_chat(messages, model, stream=True)
        return StreamingResponse(gen, media_type="text/event-stream")

    try:
        reply = await _ollama_chat(messages, model, stream=False)
    except httpx.HTTPError as e:
        raise HTTPException(503, f"Ollama unavailable: {e}. Ensure `ollama serve` is running.")

    # ── Persist to DB ─────────────────────────────────────────────────────
    for msg in body.messages:
        await db.execute(
            """INSERT INTO llm_conversations
               (id,user_id,role,content,model,context_type,session_id)
               VALUES (?,?,?,?,?,?,?)""",
            (str(uuid.uuid4()), "default", msg.role, msg.content,
             model, body.context_type, session_id)
        )
    await db.execute(
        """INSERT INTO llm_conversations
           (id,user_id,role,content,model,context_type,session_id)
           VALUES (?,?,?,?,?,?,?)""",
        (str(uuid.uuid4()), "default", "assistant", reply,
         model, body.context_type, session_id)
    )
    await db.commit()

    return {"reply": reply, "session_id": session_id, "model": model}


# ── /practice ─────────────────────────────────────────────────────────────────
@router.post("/practice")
async def generate_practice(body: PracticeIn):
    """Generate N practice problems for a skill node at its current level."""
    model = _resolve_model(body.model)
    diff_desc = {
        "Easy":   "conceptual or recall-based",
        "Medium": "application or implementation",
        "Hard":   "synthesis, edge-case, or system design",
    }.get(body.difficulty, "application")

    prompt = f"""You are an expert ML engineering tutor.
Generate exactly {body.count} practice problems for the skill: **{body.skill_name}**
- Skill level: {body.level}/10
- Difficulty: {body.difficulty} ({diff_desc})
- Path: {body.path_id.upper()}

Return ONLY a JSON array (no markdown, no preamble) with this structure:
[
  {{
    "question": "...",
    "answer": "...",
    "hint": "...",
    "difficulty": "{body.difficulty}"
  }}
]
"""

    messages = [
        {"role": "system", "content": "You are a precise ML tutor. Always respond with valid JSON only."},
        {"role": "user",   "content": prompt},
    ]

    try:
        raw = await _ollama_chat(messages, model)
    except httpx.HTTPError as e:
        raise HTTPException(503, f"Ollama unavailable: {e}")

    # Parse and persist
    import json, re
    # Strip any accidental markdown fences
    clean = re.sub(r"```json?|```", "", raw).strip()
    try:
        problems = json.loads(clean)
    except json.JSONDecodeError:
        # Fallback: extract JSON array from response
        match = re.search(r"\[.*\]", clean, re.DOTALL)
        problems = json.loads(match.group()) if match else []

    db = await get_db()
    for p in problems:
        await db.execute(
            """INSERT INTO practice_problems
               (id,user_id,skill_id,path_id,question,answer,difficulty,model)
               VALUES (?,?,?,?,?,?,?,?)""",
            (str(uuid.uuid4()), "default", body.skill_id, body.path_id,
             p.get("question",""), p.get("answer",""), body.difficulty, model)
        )
    await db.commit()

    return {"problems": problems, "count": len(problems), "model": model}


# ── /explain ──────────────────────────────────────────────────────────────────
@router.post("/explain")
async def explain_concept(body: ExplainIn):
    """Explain a concept at a specific depth level, optionally with analogy."""
    model = _resolve_model(body.model)
    analogy_hint = f" Use a {body.analogy_domain} analogy." if body.analogy_domain else ""
    level_map = {
        "beginner":     "Use simple language, no assumed math background.",
        "intermediate": "Assume basic Python and linear algebra knowledge.",
        "expert":       "Use precise technical terminology and mathematical notation.",
    }
    prompt = f"""Explain the concept of **{body.concept}** for a {body.target_level} level ML learner.
{level_map.get(body.target_level, "")}
{analogy_hint}
Structure your answer:
1. Core idea (2-3 sentences)
2. Why it matters in ML/DS
3. A concrete example or code snippet
4. Common misconceptions or gotchas
"""
    messages = [
        {"role": "system", "content": "You are a world-class ML educator. Be precise and clear."},
        {"role": "user",   "content": prompt},
    ]
    try:
        reply = await _ollama_chat(messages, model)
    except httpx.HTTPError as e:
        raise HTTPException(503, f"Ollama unavailable: {e}")

    return {"explanation": reply, "concept": body.concept, "level": body.target_level, "model": model}


# ── /paper-digest ─────────────────────────────────────────────────────────────
@router.post("/paper-digest")
async def digest_paper(body: DigestIn):
    """
    Summarise a research paper into structured notes.
    Input: pre-extracted text (use /ingest/pdf to extract first).
    """
    model = _resolve_model(body.model)
    title_hint = f'Title: "{body.title}"' if body.title else ""
    # Truncate to ~6000 words to fit context window
    text_truncated = " ".join(body.text.split()[:6000])

    prompt = f"""Analyse this ML research paper and produce structured notes.
{title_hint}

PAPER TEXT:
{text_truncated}

Produce a JSON response with:
{{
  "title": "...",
  "one_liner": "One sentence summary",
  "problem": "What problem does it solve?",
  "method": "Key technical approach",
  "results": "Main results / benchmarks",
  "contributions": ["contribution 1", "contribution 2", ...],
  "limitations": "Known limitations",
  "relevance": "Why this matters for ML practitioners",
  "key_concepts": ["concept1", "concept2", ...],
  "obsidian_tags": ["#paper", "#attention", ...]
}}
Respond with valid JSON only. No preamble."""

    messages = [
        {"role": "system", "content": "You are an ML research analyst. Always respond with valid JSON."},
        {"role": "user",   "content": prompt},
    ]
    try:
        raw = await _ollama_chat(messages, model)
    except httpx.HTTPError as e:
        raise HTTPException(503, f"Ollama unavailable: {e}")

    import json, re
    clean = re.sub(r"```json?|```", "", raw).strip()
    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError:
        parsed = {"raw": raw, "parse_error": True}

    return {"digest": parsed, "model": model}


# ── System prompts ────────────────────────────────────────────────────────────
def _system_prompt(context_type: str, skill_id: Optional[str]) -> str:
    base = """You are Neural Forge's AI tutor — an expert in machine learning engineering,
data engineering, and data science. You are precise, encouraging, and pedagogically sound.
You follow Barbara Oakley's learning principles: chunking, spaced repetition, interleaving,
and recall over re-reading. Keep responses concise and actionable."""

    if context_type == "skill" and skill_id:
        return base + f"\n\nCurrent focus skill: {skill_id}. Tailor your answers to help the learner master this skill."
    if context_type == "vault":
        return base + "\n\nYou have access to the learner's Obsidian vault notes (provided below). Use them to give personalised, context-aware answers."
    return base
