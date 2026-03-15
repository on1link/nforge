-- ===========================================================;
-- Neural Forge — migrations/001_initial.sql
-- Core schemas: Users, Skill Paths, Skill Nodes, and Progress
-- ===========================================================;

-- ── Users ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    name TEXT NOT NULL DEFAULT 'Learner',
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    sp INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    last_active TEXT,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

INSERT OR IGNORE INTO users (id, name) VALUES ('default', 'Learner');

-- ── Skill Paths ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skill_paths (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL
);

INSERT
    OR IGNORE INTO skill_paths (id, label, icon, color)
VALUES (
        'mle',
        'Machine Learning Engineer',
        '⚡',
        '#00e5ff'
    ),
    (
        'de',
        'Data Engineer',
        '🗄',
        '#9b59ff'
    ),
    (
        'ds',
        'Data Scientist',
        '📊',
        '#ffc107'
    ),
    (
        'aie',
        'AI Engineer',
        '🤖',
        '#f50057'
    );

-- ── Skill Node Definitions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS skill_node_defs (
    id TEXT NOT NULL,
    path_id TEXT NOT NULL REFERENCES skill_paths (id),
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    description TEXT NOT NULL,
    canvas_x REAL NOT NULL,
    canvas_y REAL NOT NULL,
    prereqs TEXT NOT NULL DEFAULT '[]',
    shared TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (id, path_id)
);

-- Seed Data (MLE, DS, DE, AIE)
INSERT
    OR IGNORE INTO skill_node_defs (
        id,
        path_id,
        name,
        icon,
        description,
        canvas_x,
        canvas_y,
        prereqs,
        shared
    )
VALUES
    -- MLE
    (
        'python',
        'mle',
        'Python Engineering',
        '🐍',
        'Advanced Python: memory management, GIL, async, type-hints.',
        360,
        100,
        '[]',
        '["mle", "ds", "de", "aie"]'
    ),
    (
        'sql',
        'mle',
        'SQL & Databases',
        '🗄️',
        'Advanced querying, query execution plans, indexing strategies.',
        200,
        100,
        '[]',
        '["mle", "ds", "de", "aie"]'
    ),
    (
        'ml_core',
        'mle',
        'ML Fundamentals',
        '📈',
        'Statistical learning, bias-variance tradeoff, cross-validation.',
        360,
        220,
        '["python"]',
        '["mle", "ds", "aie"]'
    ),
    (
        'pytorch',
        'mle',
        'Deep Learning (PyTorch)',
        '🔥',
        'Dynamic graphs, custom nn.Modules, Distributed Data Parallel.',
        200,
        340,
        '["ml_core"]',
        '["mle", "ds", "aie"]'
    ),
    (
        'spark',
        'mle',
        'Apache Spark',
        '⚡',
        'Distributed processing, Catalyst optimizer, handling data skew.',
        520,
        340,
        '["python", "sql"]',
        '["mle", "de"]'
    ),
    (
        'k8s',
        'mle',
        'Docker & Kubernetes',
        '🐳',
        'Containerizing workloads, writing manifests, cluster networking.',
        520,
        460,
        '["python"]',
        '["mle", "de"]'
    ),
    -- DS
    (
        'stats',
        'ds',
        'Probability & Stats',
        '🎲',
        'Hypothesis testing, Bayesian inference, A/B testing rigor.',
        520,
        100,
        '[]',
        '["ds", "mle", "aie"]'
    ),
    (
        'timeseries',
        'ds',
        'Time Series Modeling',
        '📉',
        'ARIMA, state-space models, seasonality, transformer forecasting.',
        520,
        340,
        '["ml_core", "stats"]',
        '["ds"]'
    ),
    (
        'causal',
        'ds',
        'Causal Inference',
        '🔗',
        'DAGs, instrumental variables, propensity score matching.',
        360,
        580,
        '["ml_core", "stats"]',
        '["ds"]'
    ),
    -- DE
    (
        'data_model',
        'de',
        'Data Modeling',
        '🏗️',
        'Kimball dimensional modeling, star/snowflake schemas, SCDs.',
        360,
        220,
        '["sql"]',
        '["de"]'
    ),
    (
        'kafka',
        'de',
        'Event Streaming (Kafka)',
        '📨',
        'Distributed commit logs, topic partitioning, exactly-once semantics.',
        200,
        340,
        '["python"]',
        '["de", "mle"]'
    ),
    (
        'lakehouse',
        'de',
        'Lakehouse Architecture',
        '🌊',
        'Apache Iceberg, Delta Lake, ACID transactions on object storage.',
        360,
        580,
        '["spark", "kafka", "data_model"]',
        '["de"]'
    ),
    -- AIE
    (
        'cv_nlp',
        'aie',
        'CV & NLP Pipelines',
        '👁️',
        'Vision transformers, tokenization strategies, applying foundation models.',
        520,
        340,
        '["pytorch"]',
        '["aie", "mle"]'
    ),
    (
        'llms',
        'aie',
        'Large Language Models',
        '🧠',
        'Attention mechanisms, PEFT/LoRA, KV caching, deploying quantized models.',
        360,
        460,
        '["pytorch", "ml_core"]',
        '["aie"]'
    ),
    (
        'rag_agents',
        'aie',
        'RAG & AI Agents',
        '🤖',
        'Vector DBs, semantic search routing, multi-agent orchestration.',
        360,
        580,
        '["llms", "cv_nlp"]',
        '["aie"]'
    );

-- ── User Progress & Activity ───────────────────────────────────
CREATE TABLE IF NOT EXISTS user_skill_levels (
    user_id TEXT NOT NULL DEFAULT 'default',
    node_id TEXT NOT NULL,
    path_id TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT(datetime('now')),
    PRIMARY KEY (user_id, node_id, path_id)
);

CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE TABLE IF NOT EXISTS sr_cards (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    node_id TEXT NOT NULL,
    path_id TEXT NOT NULL,
    ease_factor REAL NOT NULL DEFAULT 2.5,
    interval INTEGER NOT NULL DEFAULT 1,
    repetitions INTEGER NOT NULL DEFAULT 0,
    due_date TEXT NOT NULL DEFAULT(date('now', '+1 day')),
    last_review TEXT
);

CREATE TABLE IF NOT EXISTS vault_index (
    path TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    word_count INTEGER NOT NULL DEFAULT 0,
    modified_at TEXT NOT NULL,
    indexed_at TEXT NOT NULL DEFAULT(datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_skills_user ON user_skill_levels (user_id, path_id);

CREATE INDEX IF NOT EXISTS idx_sr_cards_due ON sr_cards (user_id, due_date);