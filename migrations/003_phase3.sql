-- ===========================================================;
-- Neural Forge — migrations/003_phase3.sql
-- Systems: Knowledge Graph, Syncing, Plugins, App State
-- ===========================================================;

-- ── Onboarding ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding (
    user_id TEXT PRIMARY KEY DEFAULT 'default',
    completed INTEGER NOT NULL DEFAULT 0,
    step INTEGER NOT NULL DEFAULT 0,
    vault_set INTEGER NOT NULL DEFAULT 0,
    ollama_ok INTEGER NOT NULL DEFAULT 0,
    path_chosen TEXT NOT NULL DEFAULT '',
    completed_at TEXT
);

INSERT OR IGNORE INTO onboarding (user_id) VALUES ('default');

-- ── Knowledge Graph ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kg_nodes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    label TEXT NOT NULL,
    node_type TEXT NOT NULL CHECK (
        node_type IN (
            'skill',
            'note',
            'concept',
            'paper',
            'project'
        )
    ),
    path_id TEXT,
    weight REAL NOT NULL DEFAULT 1.0,
    metadata TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE TABLE IF NOT EXISTS kg_edges (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    source_id TEXT NOT NULL REFERENCES kg_nodes (id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES kg_nodes (id) ON DELETE CASCADE,
    rel_type TEXT NOT NULL DEFAULT 'relates_to',
    weight REAL NOT NULL DEFAULT 1.0
);

-- ── Syncing & APIs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_conflicts (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    note_path TEXT NOT NULL,
    local_hash TEXT NOT NULL,
    remote_hash TEXT NOT NULL,
    resolution TEXT NOT NULL DEFAULT 'pending',
    diff_preview TEXT,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE TABLE IF NOT EXISTS mobile_api_keys (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    key_hash TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL DEFAULT 'Mobile companion',
    user_id TEXT NOT NULL DEFAULT 'default',
    last_used TEXT,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

-- ── App State & Plugins ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS plugins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    manifest TEXT NOT NULL DEFAULT '{}',
    install_path TEXT NOT NULL DEFAULT '',
    installed_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_sessions (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    started_at TEXT NOT NULL DEFAULT(datetime('now')),
    ended_at TEXT,
    duration_s INTEGER,
    views_visited TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS crash_reports (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    error_type TEXT NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT NOT NULL DEFAULT '',
    context TEXT NOT NULL DEFAULT '{}',
    app_version TEXT NOT NULL DEFAULT '0.3.0',
    os_info TEXT NOT NULL DEFAULT '',
    reported INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);