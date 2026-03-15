-- ============================================================
-- Neural Forge — migrations/002_phase2.sql
-- Phase 2: SR reviews, embeddings, practice problems,
--          LLM history, analytics snapshots
-- All tables are idempotent (IF NOT EXISTS)
-- ============================================================

-- ── SR review log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sr_reviews (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    card_id TEXT NOT NULL REFERENCES sr_cards (id) ON DELETE CASCADE,
    user_id TEXT NOT NULL DEFAULT 'default',
    quality INTEGER NOT NULL CHECK (quality BETWEEN 0 AND 5),
    prev_ef REAL NOT NULL,
    new_ef REAL NOT NULL,
    prev_interval INTEGER NOT NULL,
    new_interval INTEGER NOT NULL,
    reviewed_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sr_reviews_card ON sr_reviews (card_id, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_sr_reviews_user ON sr_reviews (user_id, reviewed_at DESC);

-- ── Vault note embeddings (FAISS metadata) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS vault_embeddings (
    note_path TEXT NOT NULL,
    faiss_id INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    chunk_text TEXT NOT NULL,
    indexed_at TEXT NOT NULL DEFAULT(datetime('now')),
    PRIMARY KEY (note_path, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_vault_embed_faiss ON vault_embeddings (faiss_id);

-- ── LLM-generated practice problems ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS practice_problems (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    skill_id TEXT NOT NULL,
    path_id TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'Medium',
    model TEXT NOT NULL DEFAULT 'llama3',
    attempted INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_problems_skill ON practice_problems (user_id, skill_id, path_id);

-- ── LLM conversation history ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS llm_conversations (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
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

-- ── Weekly analytics snapshots & Forecasts ────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    week_start TEXT NOT NULL,
    xp_gained INTEGER NOT NULL DEFAULT 0,
    tasks_done INTEGER NOT NULL DEFAULT 0,
    sessions INTEGER NOT NULL DEFAULT 0,
    skills_leveled INTEGER NOT NULL DEFAULT 0,
    sleep_avg REAL NOT NULL DEFAULT 0,
    top_skill TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT(datetime('now')),
    UNIQUE (user_id, week_start)
);

CREATE TABLE IF NOT EXISTS forecast_data (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    week_start TEXT NOT NULL,
    actual_xp INTEGER,
    forecast_xp INTEGER NOT NULL,
    model TEXT NOT NULL DEFAULT 'linear',
    created_at TEXT NOT NULL DEFAULT(datetime('now')),
    UNIQUE (user_id, week_start)
);