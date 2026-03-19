-- =============================================================
-- Neural Forge — migrations/002_phase2.sql
-- Phase 2: Intelligence layer additions.
-- Requires 001_initial.sql to have run first.
--
-- Tables already declared in 001_initial.sql (not redefined):
--   sr_reviews, practice_problems, practice_attempts,
--   analytics_snapshots
--
-- New tables added here:
--   vault_embeddings   — FAISS chunk metadata for semantic search
--   llm_conversations  — per-message AI chat history
--   forecast_data      — XP forecast model output
-- =============================================================

-- ── Vault embeddings ──────────────────────────────────────────────────────────
-- Stores FAISS position metadata for each text chunk extracted
-- from Obsidian vault notes. The actual float vectors live in
-- the FAISS index file on disk; this table maps faiss_id back
-- to the source text so results can be hydrated after search.
--
-- Column contract (must match search/indexer.py):
--   INSERT OR REPLACE INTO vault_embeddings
--     (note_path, faiss_id, chunk_index, chunk_text)
CREATE TABLE IF NOT EXISTS vault_embeddings (
    note_path TEXT NOT NULL,
    faiss_id INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    chunk_text TEXT NOT NULL,
    indexed_at TEXT NOT NULL DEFAULT(datetime('now')),
    PRIMARY KEY (note_path, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_vault_embed_faiss ON vault_embeddings (faiss_id);

CREATE INDEX IF NOT EXISTS idx_vault_embed_path ON vault_embeddings (note_path);

-- ── LLM conversation history ──────────────────────────────────────────────────
-- One row per message (user, assistant, or system). Rows are
-- grouped into sessions via session_id so the sidecar can
-- replay context on follow-up calls.
--
-- Column contract (must match llm/router.py):
--   INSERT INTO llm_conversations
--     (id, user_id, role, content, model, context_type, session_id)
CREATE TABLE IF NOT EXISTS llm_conversations (
    id TEXT NOT NULL PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    role TEXT NOT NULL CHECK (
        role IN ('user', 'assistant', 'system')
    ),
    content TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'llama3',
    context_type TEXT NOT NULL DEFAULT 'general',
    session_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_llm_session ON llm_conversations (session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_llm_user ON llm_conversations (user_id, created_at DESC);

-- ── XP forecast data ──────────────────────────────────────────────────────────
-- Stores model predictions alongside actuals once the week
-- closes. Used by the analytics view to plot a forecast ribbon.
CREATE TABLE IF NOT EXISTS forecast_data (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    week_start TEXT NOT NULL,
    actual_xp INTEGER, -- NULL until week closes
    forecast_xp INTEGER NOT NULL,
    model TEXT NOT NULL DEFAULT 'linear',
    created_at TEXT NOT NULL DEFAULT(datetime('now')),
    UNIQUE (user_id, week_start)
);