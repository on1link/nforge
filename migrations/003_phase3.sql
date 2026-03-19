-- =============================================================
-- Neural Forge — migrations/003_phase3.sql
-- Phase 3: Ecosystem additions.
-- Requires 001_initial.sql and 002_phase2.sql to have run first.
--
-- Tables already declared in 001_initial.sql (not redefined):
--   sync_conflicts, mobile_api_keys, notifications
--   (onboarding state lives in users.onboarding_done)
--
-- New tables added here:
--   graph_edges        — knowledge graph edge store
--   kg_nodes           — knowledge graph persistent node store
--   kg_edges           — knowledge graph named-edge store
--   sync_queue         — outbound sync work queue
--   sync_conflicts     — vault merge conflicts
--   mobile_api_keys    — bearer-auth keys for companion app
--   plugins            — installed plugin registry
--   plugin_events      — hook dispatch audit log
--   backup_log         — git commit history
--   app_sessions       — session duration telemetry
--   crash_reports      — error reporting
-- =============================================================

-- ── Knowledge graph — edge store (used by graph/builder.py) ──────────────────
-- builder.py writes to this table directly via:
--   INSERT OR IGNORE INTO graph_edges (src, dst, edge_type, weight)
-- The Python NetworkX graph is rebuilt from vault_index +
-- skill_node_defs + this table on each /graph/rebuild call.
CREATE TABLE IF NOT EXISTS graph_edges (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    src TEXT NOT NULL,
    dst TEXT NOT NULL,
    edge_type TEXT NOT NULL DEFAULT 'relates_to',
    weight REAL NOT NULL DEFAULT 1.0,
    created_at TEXT NOT NULL DEFAULT(datetime('now')),
    UNIQUE (src, dst, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_graph_edges_src ON graph_edges (src);

CREATE INDEX IF NOT EXISTS idx_graph_edges_dst ON graph_edges (dst);

-- ── Knowledge graph — persistent node store ───────────────────────────────────
-- Optional richer node metadata beyond what skill_node_defs
-- and vault_index already store (papers, external concepts, etc.)
CREATE TABLE IF NOT EXISTS kg_nodes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    label TEXT NOT NULL,
    node_type TEXT NOT NULL DEFAULT 'concept' CHECK (
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
    weight REAL NOT NULL DEFAULT 1.0,
    UNIQUE (
        source_id,
        target_id,
        rel_type
    )
);

CREATE INDEX IF NOT EXISTS idx_kg_edges_src ON kg_edges (source_id);

CREATE INDEX IF NOT EXISTS idx_kg_edges_dst ON kg_edges (target_id);

-- ── Sync queue ────────────────────────────────────────────────────────────────
-- Outbound work queue for Obsidian bidirectional sync.
-- Rows are processed by sync/watcher.py and deleted on success.
CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (
        action IN ('create', 'update', 'delete')
    ),
    payload TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN (
            'pending',
            'processing',
            'done',
            'failed'
        )
    ),
    error TEXT,
    created_at TEXT NOT NULL DEFAULT(datetime('now')),
    processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue (status, created_at ASC);

-- ── Sync conflicts ────────────────────────────────────────────────────────────
-- Created when local and remote vault notes diverge.
-- sync/router.py queries: WHERE resolution='pending'
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    note_path TEXT NOT NULL,
    local_hash TEXT NOT NULL,
    remote_hash TEXT NOT NULL,
    resolution TEXT NOT NULL DEFAULT 'pending' CHECK (
        resolution IN (
            'pending',
            'local',
            'remote',
            'merge'
        )
    ),
    diff_preview TEXT,
    created_at TEXT NOT NULL DEFAULT(datetime('now')),
    resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_pending ON sync_conflicts (resolution, created_at DESC);

-- ── Mobile API keys ───────────────────────────────────────────────────────────
-- Bearer-token auth for the React Native companion app.
-- mobile/router.py queries: WHERE key_hash=?
--   and INSERTs: (key_hash, label, user_id)
CREATE TABLE IF NOT EXISTS mobile_api_keys (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    key_hash TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL DEFAULT 'Mobile companion',
    user_id TEXT NOT NULL DEFAULT 'default',
    last_used TEXT,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

-- ── Plugins ───────────────────────────────────────────────────────────────────
-- Column contract (must match plugins/loader.py):
--   INSERT INTO plugins (id,name,version,description,author,file_path,hooks)
--   SELECT config, enabled FROM plugins WHERE id=?
--   UPDATE plugins SET config=? WHERE id=?
CREATE TABLE IF NOT EXISTS plugins (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '0.1.0',
    description TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    file_path TEXT NOT NULL DEFAULT '',
    hooks TEXT NOT NULL DEFAULT '[]', -- JSON array of hook names
    config TEXT NOT NULL DEFAULT '{}', -- JSON config blob
    installed_at TEXT NOT NULL DEFAULT(datetime('now'))
);

-- ── Plugin event log ──────────────────────────────────────────────────────────
-- Column contract (must match plugins/loader.py):
--   INSERT INTO plugin_events
--     (plugin_id, hook, payload, result, error, duration_ms)
CREATE TABLE IF NOT EXISTS plugin_events (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    plugin_id TEXT NOT NULL REFERENCES plugins (id) ON DELETE CASCADE,
    hook TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    result TEXT,
    error TEXT,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    fired_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_plugin_events_plugin ON plugin_events (plugin_id, fired_at DESC);

CREATE INDEX IF NOT EXISTS idx_plugin_events_hook ON plugin_events (hook, fired_at DESC);

-- ── Backup log ────────────────────────────────────────────────────────────────
-- Column contract (must match backup/router.py):
--   INSERT INTO backup_log
--     (backup_type, target, commit_hash, files_changed, status)
CREATE TABLE IF NOT EXISTS backup_log (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    backup_type TEXT NOT NULL DEFAULT 'git',
    target TEXT NOT NULL,
    commit_hash TEXT,
    files_changed INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ok' CHECK (
        status IN (
            'ok',
            'nothing_to_commit',
            'error'
        )
    ),
    error TEXT,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_backup_log_date ON backup_log (created_at DESC);

-- ── App sessions ──────────────────────────────────────────────────────────────
-- Tracks desktop session start/end for usage analytics.
CREATE TABLE IF NOT EXISTS app_sessions (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    started_at TEXT NOT NULL DEFAULT(datetime('now')),
    ended_at TEXT,
    duration_s INTEGER,
    views_visited TEXT NOT NULL DEFAULT '[]' -- JSON array of view ids
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user ON app_sessions (user_id, started_at DESC);

-- ── Crash reports ─────────────────────────────────────────────────────────────
-- Written by the Rust backend on unhandled panics. Optional
-- telemetry; reported=0 means not yet sent upstream.
CREATE TABLE IF NOT EXISTS crash_reports (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    error_type TEXT NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT NOT NULL DEFAULT '',
    context TEXT NOT NULL DEFAULT '{}',
    app_version TEXT NOT NULL DEFAULT '1.0.0-beta',
    os_info TEXT NOT NULL DEFAULT '',
    reported INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);