-- =============================================================
-- Neural Forge — migrations/001_initial.sql
-- Complete schema — all phases consolidated.
-- No ALTER TABLE statements; every column is declared inline.
-- =============================================================

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    name TEXT NOT NULL DEFAULT 'Learner',
    username TEXT NOT NULL DEFAULT 'Learner',
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    sp INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    last_active TEXT,
    active_paths TEXT NOT NULL DEFAULT '["mle"]',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    daily_xp_goal INTEGER NOT NULL DEFAULT 200,
    onboarding_done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

INSERT
    OR IGNORE INTO users (id, name, username)
VALUES (
        'default',
        'Learner',
        'Learner'
    );

-- ── App Configuration ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);

INSERT
    OR IGNORE INTO config (key, value)
VALUES ('vault_path', ''),
    (
        'ollama_url',
        'http://localhost:11434'
    ),
    ('ollama_model', 'llama3'),
    ('auto_git_commit', 'false'),
    ('blocked_sites', '[]'),
    ('sr_daily_limit', '30'),
    ('theme', 'dark');

-- ── Skill Paths ───────────────────────────────────────────────────────────────
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

-- ── Skill Node Definitions ────────────────────────────────────────────────────
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
    -- ── MLE ──────────────────────────────────────────────────────────────────
    (
        'python',
        'mle',
        'Python',
        '🐍',
        'Advanced Python: memory management, GIL, async, type-hints.',
        360,
        100,
        '[]',
        '["mle","ds","de","aie"]'
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
        '["mle","ds","de","aie"]'
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
        '["mle","ds","aie"]'
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
        '["mle","ds","aie"]'
    ),
    (
        'spark',
        'mle',
        'Apache Spark',
        '⚡',
        'Distributed processing, Catalyst optimizer, handling data skew.',
        520,
        340,
        '["python","sql"]',
        '["mle","de"]'
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
        '["mle","de"]'
    ),
    -- ── DS ───────────────────────────────────────────────────────────────────
    (
        'stats',
        'ds',
        'Probability & Stats',
        '🎲',
        'Hypothesis testing, Bayesian inference, A/B testing rigor.',
        520,
        100,
        '[]',
        '["ds","mle","aie"]'
    ),
    (
        'timeseries',
        'ds',
        'Time Series Modeling',
        '📉',
        'ARIMA, state-space models, seasonality, transformer forecasting.',
        520,
        340,
        '["ml_core","stats"]',
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
        '["ml_core","stats"]',
        '["ds"]'
    ),
    -- ── DE ───────────────────────────────────────────────────────────────────
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
        '["de","mle"]'
    ),
    (
        'lakehouse',
        'de',
        'Lakehouse Architecture',
        '🌊',
        'Apache Iceberg, Delta Lake, ACID transactions on object storage.',
        360,
        580,
        '["spark","kafka","data_model"]',
        '["de"]'
    ),
    -- ── AIE ──────────────────────────────────────────────────────────────────
    (
        'cv_nlp',
        'aie',
        'CV & NLP Pipelines',
        '👁️',
        'Vision transformers, tokenization strategies, applying foundation models.',
        520,
        340,
        '["pytorch"]',
        '["aie","mle"]'
    ),
    (
        'llms',
        'aie',
        'Large Language Models',
        '🧠',
        'Attention mechanisms, PEFT/LoRA, KV caching, deploying quantized models.',
        360,
        460,
        '["pytorch","ml_core"]',
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
        '["llms","cv_nlp"]',
        '["aie"]'
    );

-- ── Skill Subtopic Definitions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skill_subtopics (
    id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    path_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    order_idx INTEGER NOT NULL DEFAULT 0,
    xp_value INTEGER NOT NULL DEFAULT 80,
    PRIMARY KEY (id, path_id),
    FOREIGN KEY (node_id, path_id) REFERENCES skill_node_defs (id, path_id)
);

INSERT
    OR IGNORE INTO skill_subtopics (
        id,
        node_id,
        path_id,
        name,
        description,
        order_idx,
        xp_value
    )
VALUES
    -- python (mle)
    (
        'python.gil',
        'python',
        'mle',
        'GIL & Concurrency',
        'threading vs multiprocessing, asyncio event loop, GIL limitations.',
        0,
        80
    ),
    (
        'python.async',
        'python',
        'mle',
        'Async / Await',
        'Coroutines, tasks, event loop internals, aiohttp, async generators.',
        1,
        80
    ),
    (
        'python.types',
        'python',
        'mle',
        'Type System & Protocols',
        'PEP 484/544, TypeVar, Protocols, runtime_checkable, mypy strictness.',
        2,
        80
    ),
    (
        'python.memory',
        'python',
        'mle',
        'Memory & Profiling',
        'Reference counting, gc module, tracemalloc, py-spy, memory leaks.',
        3,
        80
    ),
    (
        'python.meta',
        'python',
        'mle',
        'Metaprogramming',
        'Decorators, descriptors, __slots__, metaclasses, dataclasses internals.',
        4,
        80
    ),
    (
        'python.packaging',
        'python',
        'mle',
        'Packaging & Tooling',
        'pyproject.toml, uv/pip, src layout, wheels, publishing to PyPI.',
        5,
        80
    ),
    -- sql (mle)
    (
        'sql.window',
        'sql',
        'mle',
        'Window Functions',
        'OVER(), PARTITION BY, ROWS vs RANGE, gaps-and-islands patterns.',
        0,
        80
    ),
    (
        'sql.cte',
        'sql',
        'mle',
        'CTEs & Recursion',
        'WITH clause, recursive CTEs, hierarchical queries, factoring.',
        1,
        80
    ),
    (
        'sql.plans',
        'sql',
        'mle',
        'Query Plan Analysis',
        'EXPLAIN ANALYZE, seq scan vs index scan, planner hints, vacuuming.',
        2,
        80
    ),
    (
        'sql.indexing',
        'sql',
        'mle',
        'Indexing Strategies',
        'B-tree, hash, partial, covering indexes; index-only scans.',
        3,
        80
    ),
    (
        'sql.json',
        'sql',
        'mle',
        'JSON & Semi-structured',
        'JSON functions, jsonb in Postgres, unnesting, lateral joins.',
        4,
        80
    ),
    (
        'sql.txn',
        'sql',
        'mle',
        'Transactions & MVCC',
        'Isolation levels, MVCC, deadlocks, optimistic vs pessimistic locking.',
        5,
        80
    ),
    -- ml_core (mle)
    (
        'ml.bias_var',
        'ml_core',
        'mle',
        'Bias-Variance Tradeoff',
        'Underfitting/overfitting, learning curves, regularization effects.',
        0,
        80
    ),
    (
        'ml.reg',
        'ml_core',
        'mle',
        'Regularization',
        'L1/L2/ElasticNet, dropout, weight decay, early stopping.',
        1,
        80
    ),
    (
        'ml.cv',
        'ml_core',
        'mle',
        'Cross-Validation',
        'k-fold, stratified, time-series splits, nested CV, leakage prevention.',
        2,
        80
    ),
    (
        'ml.features',
        'ml_core',
        'mle',
        'Feature Engineering',
        'Encoding, scaling, interaction features, target encoding, imputation.',
        3,
        80
    ),
    (
        'ml.ensemble',
        'ml_core',
        'mle',
        'Ensemble Methods',
        'Bagging, boosting (XGBoost/LightGBM), stacking, blending.',
        4,
        80
    ),
    (
        'ml.metrics',
        'ml_core',
        'mle',
        'Evaluation Metrics',
        'AUC-ROC, precision@k, calibration, NDCG, regression metrics.',
        5,
        80
    ),
    -- pytorch (mle)
    (
        'pt.autograd',
        'pytorch',
        'mle',
        'Autograd & Tensors',
        'Computation graph, .grad_fn, detach, requires_grad, custom backward.',
        0,
        100
    ),
    (
        'pt.modules',
        'pytorch',
        'mle',
        'Custom nn.Modules',
        'Module subclassing, parameter registration, hooks, state_dict.',
        1,
        100
    ),
    (
        'pt.training',
        'pytorch',
        'mle',
        'Training Loops',
        'Optimizers, schedulers, gradient clipping, mixed-precision (AMP).',
        2,
        100
    ),
    (
        'pt.ddp',
        'pytorch',
        'mle',
        'Distributed Training',
        'DDP, FSDP, process groups, gradient sync, multi-node setup.',
        3,
        100
    ),
    (
        'pt.quant',
        'pytorch',
        'mle',
        'Quantization & Pruning',
        'PTQ, QAT, torch.ao.quantization, structured pruning, ONNX export.',
        4,
        100
    ),
    (
        'pt.cuda',
        'pytorch',
        'mle',
        'CUDA & Custom Ops',
        'torch.cuda, custom CUDA extensions, Triton kernels, memory pinning.',
        5,
        100
    ),
    -- spark (mle)
    (
        'spark.rdd',
        'spark',
        'mle',
        'RDDs vs DataFrames',
        'Lineage graph, lazy evaluation, actions vs transformations, catalyst.',
        0,
        80
    ),
    (
        'spark.catalyst',
        'spark',
        'mle',
        'Catalyst Optimizer',
        'Logical/physical plan, predicate pushdown, column pruning, AQE.',
        1,
        80
    ),
    (
        'spark.skew',
        'spark',
        'mle',
        'Data Skew Handling',
        'Salting, broadcast joins, skew hints, AQE skew join optimization.',
        2,
        80
    ),
    (
        'spark.streaming',
        'spark',
        'mle',
        'Structured Streaming',
        'Micro-batch vs continuous, watermarking, stateful ops, Kafka source.',
        3,
        80
    ),
    (
        'spark.memory',
        'spark',
        'mle',
        'Memory Tuning',
        'Execution vs storage memory, spill to disk, off-heap, caching tiers.',
        4,
        80
    ),
    (
        'spark.delta',
        'spark',
        'mle',
        'Spark + Delta Lake',
        'ACID on Spark, merge/upsert patterns, time travel, Z-ordering.',
        5,
        80
    ),
    -- k8s (mle)
    (
        'k8s.docker',
        'k8s',
        'mle',
        'Docker Fundamentals',
        'Layers, build cache, multi-stage builds, .dockerignore, healthchecks.',
        0,
        80
    ),
    (
        'k8s.manifests',
        'k8s',
        'mle',
        'K8s Manifests',
        'Pod, Deployment, Service, Ingress YAML; kubectl apply/rollout.',
        1,
        80
    ),
    (
        'k8s.networking',
        'k8s',
        'mle',
        'Networking',
        'ClusterIP/NodePort/LoadBalancer, DNS, NetworkPolicy, service mesh.',
        2,
        80
    ),
    (
        'k8s.config',
        'k8s',
        'mle',
        'Config & Secrets',
        'ConfigMaps, Secrets, env injection, external-secrets, Vault.',
        3,
        80
    ),
    (
        'k8s.resources',
        'k8s',
        'mle',
        'Resource Limits & HPA',
        'requests/limits, VPA, HPA, KEDA, resource quotas, QoS classes.',
        4,
        80
    ),
    (
        'k8s.storage',
        'k8s',
        'mle',
        'Persistent Volumes',
        'PV/PVC, StorageClass, CSI drivers, StatefulSets, backup strategies.',
        5,
        80
    ),
    -- stats (ds)
    (
        'stats.prob',
        'stats',
        'ds',
        'Probability Distributions',
        'Common families, MGFs, CLT, law of large numbers, simulation.',
        0,
        80
    ),
    (
        'stats.hypo',
        'stats',
        'ds',
        'Hypothesis Testing',
        't-test, ANOVA, chi-square, multiple comparisons, p-value pitfalls.',
        1,
        80
    ),
    (
        'stats.bayes',
        'stats',
        'ds',
        'Bayesian Inference',
        'Prior/posterior, conjugate families, MCMC, Stan/PyMC.',
        2,
        80
    ),
    (
        'stats.ab',
        'stats',
        'ds',
        'A/B Testing Rigor',
        'Sample size, SRM, CUPED, novelty effect, sequential testing.',
        3,
        80
    ),
    (
        'stats.power',
        'stats',
        'ds',
        'Power Analysis',
        'Effect size, Type I/II error, MDE, simulation-based power.',
        4,
        80
    ),
    (
        'stats.resample',
        'stats',
        'ds',
        'Resampling Methods',
        'Bootstrap, jackknife, permutation tests, BCA intervals.',
        5,
        80
    ),
    -- timeseries (ds)
    (
        'ts.station',
        'timeseries',
        'ds',
        'Stationarity',
        'ADF/KPSS tests, differencing, seasonal decomposition, unit roots.',
        0,
        80
    ),
    (
        'ts.arima',
        'timeseries',
        'ds',
        'ARIMA Family',
        'AR, MA, ARIMA, SARIMA, auto-ARIMA, model selection (AIC/BIC).',
        1,
        80
    ),
    (
        'ts.state',
        'timeseries',
        'ds',
        'State-Space Models',
        'Kalman filter, DLM, structural time series, BSTS.',
        2,
        80
    ),
    (
        'ts.prophet',
        'timeseries',
        'ds',
        'Prophet & Neural TS',
        'Facebook Prophet, NeuralProphet, N-BEATS, TiDE, PatchTST.',
        3,
        80
    ),
    (
        'ts.anomaly',
        'timeseries',
        'ds',
        'Anomaly Detection',
        'STL residuals, isolation forest, LSTM autoencoders, ADTK.',
        4,
        80
    ),
    (
        'ts.eval',
        'timeseries',
        'ds',
        'Forecast Evaluation',
        'MAE/RMSE/MAPE, SMAPE, backtesting strategy, coverage intervals.',
        5,
        80
    ),
    -- causal (ds)
    (
        'causal.dags',
        'causal',
        'ds',
        'DAGs & d-separation',
        'Causal graphs, backdoor criterion, Markov assumptions, DoWhy.',
        0,
        80
    ),
    (
        'causal.po',
        'causal',
        'ds',
        'Potential Outcomes',
        'ATE/ATT/ATC, SUTVA, ignorability, double ML.',
        1,
        80
    ),
    (
        'causal.psm',
        'causal',
        'ds',
        'Propensity Score Methods',
        'IPW, matching, overlap trimming, covariate balance checks.',
        2,
        80
    ),
    (
        'causal.iv',
        'causal',
        'ds',
        'Instrumental Variables',
        '2SLS, weak instruments, Wald estimator, local ATE.',
        3,
        80
    ),
    (
        'causal.did',
        'causal',
        'ds',
        'Difference-in-Differences',
        'Parallel trends, synthetic control, staggered adoption.',
        4,
        80
    ),
    (
        'causal.rdd',
        'causal',
        'ds',
        'Regression Discontinuity',
        'Sharp vs fuzzy RDD, bandwidth selection, continuity assumption.',
        5,
        80
    ),
    -- data_model (de)
    (
        'dm.kimball',
        'data_model',
        'de',
        'Dimensional Modeling',
        'Fact/dimension tables, grain declaration, conformed dimensions.',
        0,
        80
    ),
    (
        'dm.schemas',
        'data_model',
        'de',
        'Star vs Snowflake',
        'Denormalization tradeoffs, junk dimensions, degenerate dimensions.',
        1,
        80
    ),
    (
        'dm.scd',
        'data_model',
        'de',
        'Slowly Changing Dims',
        'SCD Types 1–6, effective-date patterns, surrogate keys.',
        2,
        80
    ),
    (
        'dm.vault',
        'data_model',
        'de',
        'Data Vault 2.0',
        'Hubs, links, satellites, business keys, pit/bridge tables.',
        3,
        80
    ),
    (
        'dm.norm',
        'data_model',
        'de',
        'Normalization',
        '1NF–5NF, BCNF, practical denorm for analytics, anti-patterns.',
        4,
        80
    ),
    (
        'dm.semantic',
        'data_model',
        'de',
        'Semantic Layer',
        'Metrics layer (MetricFlow, Cube), dbt semantic models, LookML.',
        5,
        80
    ),
    -- kafka (de)
    (
        'kafka.topics',
        'kafka',
        'de',
        'Topic & Partition Design',
        'Partition count, key selection, compaction, replication factor.',
        0,
        80
    ),
    (
        'kafka.groups',
        'kafka',
        'de',
        'Consumer Groups',
        'Offset management, rebalancing, cooperative sticky, lag monitoring.',
        1,
        80
    ),
    (
        'kafka.eos',
        'kafka',
        'de',
        'Exactly-Once Semantics',
        'Idempotent producers, transactions, read-process-write pattern.',
        2,
        80
    ),
    (
        'kafka.schema',
        'kafka',
        'de',
        'Schema Registry',
        'Avro/Protobuf, schema evolution, compatibility levels.',
        3,
        80
    ),
    (
        'kafka.streams',
        'kafka',
        'de',
        'Kafka Streams',
        'KTable/KStream, stateful joins, windowed aggregations.',
        4,
        80
    ),
    (
        'kafka.ops',
        'kafka',
        'de',
        'Operations & Monitoring',
        'Consumer lag, JMX metrics, MirrorMaker 2, tiered storage.',
        5,
        80
    ),
    -- lakehouse (de)
    (
        'lh.iceberg',
        'lakehouse',
        'de',
        'Apache Iceberg',
        'Metadata layers, snapshot isolation, hidden partitioning, catalog.',
        0,
        80
    ),
    (
        'lh.delta',
        'lakehouse',
        'de',
        'Delta Lake ACID',
        'Transaction log, optimistic concurrency, VACUUM, DML operations.',
        1,
        80
    ),
    (
        'lh.formats',
        'lakehouse',
        'de',
        'Table Format Comparison',
        'Iceberg vs Delta vs Hudi: write protocols, catalog, ecosystem.',
        2,
        80
    ),
    (
        'lh.merge',
        'lakehouse',
        'de',
        'Merge & Upsert Patterns',
        'CDC patterns, MERGE INTO, SCD2 via merge, deduplication.',
        3,
        80
    ),
    (
        'lh.partition',
        'lakehouse',
        'de',
        'Partition Evolution',
        'Hidden partitioning, partition transforms, late-arriving data.',
        4,
        80
    ),
    (
        'lh.compact',
        'lakehouse',
        'de',
        'Compaction & Vacuuming',
        'Small file problem, OPTIMIZE, Z-ordering, VACUUM, retention.',
        5,
        80
    ),
    -- cv_nlp (aie)
    (
        'cvnlp.tok',
        'cv_nlp',
        'aie',
        'Tokenization',
        'BPE, WordPiece, SentencePiece, tokenizer fast vs slow, special tokens.',
        0,
        100
    ),
    (
        'cvnlp.vit',
        'cv_nlp',
        'aie',
        'Vision Transformers',
        'ViT, DINO, SAM, patch embeddings, position encoding, CLS token.',
        1,
        100
    ),
    (
        'cvnlp.fm',
        'cv_nlp',
        'aie',
        'Foundation Model APIs',
        'CLIP, BLIP, Flamingo, zero/few-shot prompting, API rate limits.',
        2,
        100
    ),
    (
        'cvnlp.ft',
        'cv_nlp',
        'aie',
        'Fine-Tuning Techniques',
        'Full fine-tune, LoRA, adapter layers, frozen backbone, PEFT.',
        3,
        100
    ),
    (
        'cvnlp.multi',
        'cv_nlp',
        'aie',
        'Multimodal Models',
        'LLaVA, GPT-4V, image-text pairs, contrastive pre-training.',
        4,
        100
    ),
    (
        'cvnlp.infer',
        'cv_nlp',
        'aie',
        'Inference Optimization',
        'ONNX, TensorRT, batch inference, dynamic quantization, serving.',
        5,
        100
    ),
    -- llms (aie)
    (
        'llm.attn',
        'llms',
        'aie',
        'Attention Mechanisms',
        'Scaled dot-product, multi-head, GQA/MQA, Flash Attention 2, ALiBi.',
        0,
        100
    ),
    (
        'llm.peft',
        'llms',
        'aie',
        'PEFT & LoRA',
        'LoRA rank/alpha, DoRA, QLoRA, IA³, adapters, PEFT library.',
        1,
        100
    ),
    (
        'llm.kvcache',
        'llms',
        'aie',
        'KV Caching',
        'KV cache internals, prefix caching, paged attention, vLLM.',
        2,
        100
    ),
    (
        'llm.quant',
        'llms',
        'aie',
        'Quantization',
        'GPTQ, AWQ, GGUF, bitsandbytes, calibration data, perplexity tradeoffs.',
        3,
        100
    ),
    (
        'llm.prompt',
        'llms',
        'aie',
        'Prompt Engineering',
        'Chain-of-thought, few-shot, system prompts, structured output, DSPy.',
        4,
        100
    ),
    (
        'llm.eval',
        'llms',
        'aie',
        'LLM Evaluation',
        'MMLU, HumanEval, MT-Bench, LLM-as-judge, hallucination benchmarks.',
        5,
        100
    ),
    -- rag_agents (aie)
    (
        'rag.vectordb',
        'rag_agents',
        'aie',
        'Vector Databases',
        'Chroma, Qdrant, Pinecone, HNSW index, cosine vs dot similarity.',
        0,
        100
    ),
    (
        'rag.chunk',
        'rag_agents',
        'aie',
        'Chunking Strategies',
        'Fixed, sentence, semantic, recursive, parent-child chunking.',
        1,
        100
    ),
    (
        'rag.hybrid',
        'rag_agents',
        'aie',
        'Hybrid Search',
        'BM25 + dense, RRF fusion, reranking (CrossEncoder, Cohere), HyDE.',
        2,
        100
    ),
    (
        'rag.react',
        'rag_agents',
        'aie',
        'ReAct Agents',
        'Thought-Action-Observation loop, tool use, LangChain agents.',
        3,
        100
    ),
    (
        'rag.multi',
        'rag_agents',
        'aie',
        'Multi-Agent Systems',
        'Supervisor pattern, handoffs, shared state, CrewAI/AutoGen.',
        4,
        100
    ),
    (
        'rag.obs',
        'rag_agents',
        'aie',
        'Observability & Evals',
        'LangSmith, Arize, RAGAS, faithfulness/context recall, tracing.',
        5,
        100
    );

-- ── User Skill Levels ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_skill_levels (
    user_id TEXT NOT NULL DEFAULT 'default',
    node_id TEXT NOT NULL,
    path_id TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 0,
    xp_invested INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT(datetime('now')),
    PRIMARY KEY (user_id, node_id, path_id)
);

-- ── User Subtopic Progress ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_subtopic_progress (
    user_id TEXT NOT NULL DEFAULT 'default',
    subtopic_id TEXT NOT NULL,
    path_id TEXT NOT NULL,
    mastery INTEGER NOT NULL DEFAULT 0 CHECK (mastery BETWEEN 0 AND 100),
    practice_count INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    last_practiced_at TEXT,
    first_seen_at TEXT NOT NULL DEFAULT(datetime('now')),
    PRIMARY KEY (user_id, subtopic_id, path_id)
);

-- ── Computed Level View (mastery-driven, 0–5) ─────────────────────────────────
CREATE VIEW IF NOT EXISTS v_node_mastery AS
SELECT
    usp.user_id,
    st.node_id,
    st.path_id,
    COUNT(st.id) AS subtopic_count,
    ROUND(
        AVG(COALESCE(usp.mastery, 0)),
        1
    ) AS avg_mastery,
    SUM(
        CASE
            WHEN COALESCE(usp.mastery, 0) >= 80 THEN 1
            ELSE 0
        END
    ) AS mastered_count,
    CASE
        WHEN AVG(COALESCE(usp.mastery, 0)) >= 100 THEN 5
        WHEN AVG(COALESCE(usp.mastery, 0)) >= 80 THEN 4
        WHEN AVG(COALESCE(usp.mastery, 0)) >= 60 THEN 3
        WHEN AVG(COALESCE(usp.mastery, 0)) >= 40 THEN 2
        WHEN AVG(COALESCE(usp.mastery, 0)) >= 20 THEN 1
        ELSE 0
    END AS computed_level
FROM
    skill_subtopics st
    LEFT JOIN user_subtopic_progress usp ON usp.subtopic_id = st.id
    AND usp.path_id = st.path_id
    AND usp.user_id = 'default'
GROUP BY
    st.node_id,
    st.path_id;

-- ── Activity Log ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    action TEXT NOT NULL,
    details TEXT,
    xp INTEGER NOT NULL DEFAULT 0,
    node_id TEXT,
    path_id TEXT,
    subtopic_id TEXT,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

-- ── SR Cards ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sr_cards (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    node_id TEXT NOT NULL,
    path_id TEXT NOT NULL,
    subtopic_id TEXT,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    ease_factor REAL NOT NULL DEFAULT 2.5,
    interval INTEGER NOT NULL DEFAULT 1,
    repetitions INTEGER NOT NULL DEFAULT 0,
    due_date TEXT NOT NULL DEFAULT(date('now', '+1 day')),
    last_review TEXT,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE TABLE IF NOT EXISTS sr_reviews (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    card_id TEXT NOT NULL REFERENCES sr_cards (id) ON DELETE CASCADE,
    quality INTEGER NOT NULL CHECK (quality BETWEEN 0 AND 5),
    interval_before INTEGER NOT NULL DEFAULT 1,
    interval_after INTEGER NOT NULL DEFAULT 1,
    ease_before REAL NOT NULL DEFAULT 2.5,
    ease_after REAL NOT NULL DEFAULT 2.5,
    mastery_delta INTEGER NOT NULL DEFAULT 0,
    reviewed_at TEXT NOT NULL DEFAULT(datetime('now'))
);

-- ── Practice Problems & Attempts ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS practice_problems (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    subtopic_id TEXT NOT NULL,
    path_id TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (
        difficulty IN ('easy', 'medium', 'hard')
    ),
    problem_text TEXT NOT NULL,
    hints TEXT NOT NULL DEFAULT '[]',
    solution TEXT,
    explanation TEXT,
    source TEXT NOT NULL DEFAULT 'ai',
    created_at TEXT NOT NULL DEFAULT(datetime('now')),
    FOREIGN KEY (subtopic_id, path_id) REFERENCES skill_subtopics (id, path_id)
);

CREATE TABLE IF NOT EXISTS practice_attempts (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    problem_id TEXT NOT NULL REFERENCES practice_problems (id) ON DELETE CASCADE,
    subtopic_id TEXT NOT NULL,
    path_id TEXT NOT NULL,
    answer TEXT,
    correct INTEGER NOT NULL DEFAULT 0,
    time_taken_s INTEGER NOT NULL DEFAULT 0,
    hint_used INTEGER NOT NULL DEFAULT 0,
    xp_awarded INTEGER NOT NULL DEFAULT 0,
    mastery_delta INTEGER NOT NULL DEFAULT 0,
    attempted_at TEXT NOT NULL DEFAULT(datetime('now'))
);

-- ── Assessments ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    node_id TEXT NOT NULL,
    path_id TEXT NOT NULL,
    title TEXT NOT NULL,
    level_target INTEGER NOT NULL DEFAULT 1,
    pass_score INTEGER NOT NULL DEFAULT 70,
    time_limit_s INTEGER NOT NULL DEFAULT 600,
    question_count INTEGER NOT NULL DEFAULT 5,
    created_at TEXT NOT NULL DEFAULT(datetime('now')),
    FOREIGN KEY (node_id, path_id) REFERENCES skill_node_defs (id, path_id)
);

CREATE TABLE IF NOT EXISTS assessment_questions (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    assessment_id TEXT NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
    subtopic_id TEXT,
    question_text TEXT NOT NULL,
    options TEXT NOT NULL DEFAULT '[]',
    correct_index INTEGER NOT NULL DEFAULT 0,
    explanation TEXT,
    difficulty TEXT NOT NULL DEFAULT 'medium',
    order_idx INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS assessment_attempts (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    assessment_id TEXT NOT NULL REFERENCES assessments (id),
    node_id TEXT NOT NULL,
    path_id TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    passed INTEGER NOT NULL DEFAULT 0,
    answers TEXT NOT NULL DEFAULT '[]',
    time_taken_s INTEGER NOT NULL DEFAULT 0,
    xp_awarded INTEGER NOT NULL DEFAULT 0,
    attempted_at TEXT NOT NULL DEFAULT(datetime('now'))
);

-- ── Learning Resources ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learning_resources (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    node_id TEXT,
    subtopic_id TEXT,
    path_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'link' CHECK (
        type IN (
            'book',
            'course',
            'paper',
            'video',
            'blog',
            'tool'
        )
    ),
    title TEXT NOT NULL,
    url TEXT,
    author TEXT,
    description TEXT,
    difficulty TEXT NOT NULL DEFAULT 'medium',
    est_hours REAL NOT NULL DEFAULT 1.0,
    is_free INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE TABLE IF NOT EXISTS resource_progress (
    user_id TEXT NOT NULL DEFAULT 'default',
    resource_id TEXT NOT NULL REFERENCES learning_resources (id) ON DELETE CASCADE,
    pct_complete INTEGER NOT NULL DEFAULT 0 CHECK (
        pct_complete BETWEEN 0 AND 100
    ),
    notes TEXT,
    started_at TEXT,
    finished_at TEXT,
    updated_at TEXT NOT NULL DEFAULT(datetime('now')),
    PRIMARY KEY (user_id, resource_id)
);

INSERT
    OR IGNORE INTO learning_resources (
        id,
        node_id,
        path_id,
        type,
        title,
        url,
        author,
        est_hours,
        is_free
    )
VALUES (
        'res_pt_dl',
        'pytorch',
        'mle',
        'book',
        'Deep Learning with PyTorch',
        'https://pytorch.org/assets/deep-learning/Deep-Learning-with-PyTorch.pdf',
        'Viehmann et al.',
        20.0,
        1
    ),
    (
        'res_ml_hand',
        'ml_core',
        'mle',
        'book',
        'Hands-On ML with Scikit-Learn & TF',
        'https://oreilly.com/library/view/hands-on-machine-learning',
        'Aurélien Géron',
        40.0,
        0
    ),
    (
        'res_stats',
        'stats',
        'ds',
        'book',
        'Statistics for Data Scientists',
        'https://oreilly.com/library/view/statistics-for-data',
        'Bruce & Bruce',
        15.0,
        0
    ),
    (
        'res_attn',
        'llms',
        'aie',
        'paper',
        'Attention Is All You Need',
        'https://arxiv.org/abs/1706.03762',
        'Vaswani et al.',
        1.0,
        1
    ),
    (
        'res_lora',
        'llms',
        'aie',
        'paper',
        'LoRA: Low-Rank Adaptation',
        'https://arxiv.org/abs/2106.09685',
        'Hu et al.',
        1.0,
        1
    ),
    (
        'res_iceberg',
        'lakehouse',
        'de',
        'blog',
        'Apache Iceberg Docs',
        'https://iceberg.apache.org/docs/latest',
        'Apache',
        3.0,
        1
    ),
    (
        'res_kafka',
        'kafka',
        'de',
        'course',
        'Kafka: The Definitive Guide',
        'https://www.oreilly.com/library/view/kafka-the-definitive',
        'Shapira et al.',
        20.0,
        0
    ),
    (
        'res_causal',
        'causal',
        'ds',
        'book',
        'The Book of Why',
        'https://www.basicbooks.com/titles/judea-pearl/the-book-of-why',
        'Pearl & Mackenzie',
        12.0,
        0
    );

-- ── Tasks ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    title TEXT NOT NULL,
    description TEXT,
    node_id TEXT,
    subtopic_id TEXT,
    path_id TEXT,
    done INTEGER NOT NULL DEFAULT 0,
    xp_reward INTEGER NOT NULL DEFAULT 50,
    due_date TEXT,
    done_at TEXT,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

-- ── Goals ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    title TEXT NOT NULL,
    description TEXT,
    goal_type TEXT NOT NULL DEFAULT 'xp' CHECK (
        goal_type IN (
            'xp',
            'level',
            'mastery',
            'project',
            'custom'
        )
    ),
    node_id TEXT,
    subtopic_id TEXT,
    path_id TEXT,
    target INTEGER NOT NULL DEFAULT 100,
    progress INTEGER NOT NULL DEFAULT 0,
    target_date TEXT,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

-- ── Grind Sessions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grind_sessions (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    platform TEXT NOT NULL,
    node_id TEXT,
    path_id TEXT,
    subtopic_id TEXT,
    problems_solved INTEGER NOT NULL DEFAULT 0,
    duration_mins INTEGER NOT NULL DEFAULT 0,
    difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (
        difficulty IN (
            'easy',
            'medium',
            'hard',
            'mixed'
        )
    ),
    notes TEXT,
    xp_reward INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

-- ── Projects ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'backlog' CHECK (
        status IN (
            'backlog',
            'active',
            'review',
            'done'
        )
    ),
    repo_url TEXT,
    demo_url TEXT,
    xp_reward INTEGER NOT NULL DEFAULT 400,
    created_at TEXT NOT NULL DEFAULT(datetime('now')),
    done_at TEXT
);

CREATE TABLE IF NOT EXISTS project_skills (
    project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    path_id TEXT NOT NULL,
    PRIMARY KEY (project_id, node_id, path_id)
);

-- ── Vitals ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sleep_logs (
    user_id TEXT NOT NULL DEFAULT 'default',
    log_date TEXT NOT NULL,
    hours REAL NOT NULL,
    quality INTEGER NOT NULL CHECK (quality BETWEEN 1 AND 5),
    energy INTEGER NOT NULL CHECK (energy BETWEEN 1 AND 5),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT(datetime('now')),
    PRIMARY KEY (user_id, log_date)
);

CREATE TABLE IF NOT EXISTS focus_sessions (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    node_id TEXT,
    subtopic_id TEXT,
    path_id TEXT,
    duration_mins INTEGER NOT NULL DEFAULT 25,
    session_type TEXT NOT NULL DEFAULT 'pomodoro' CHECK (
        session_type IN (
            'pomodoro',
            'deep',
            'review',
            'assessment'
        )
    ),
    notes TEXT,
    xp_reward INTEGER NOT NULL DEFAULT 20,
    started_at TEXT NOT NULL DEFAULT(datetime('now')),
    ended_at TEXT
);

-- ── Vault Index ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vault_index (
    path TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    word_count INTEGER NOT NULL DEFAULT 0,
    modified_at TEXT NOT NULL,
    indexed_at TEXT NOT NULL DEFAULT(datetime('now'))
);

-- ── Node Unlocks ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS node_unlocks (
    user_id TEXT NOT NULL DEFAULT 'default',
    node_id TEXT NOT NULL,
    path_id TEXT NOT NULL,
    unlocked_at TEXT NOT NULL DEFAULT(datetime('now')),
    PRIMARY KEY (user_id, node_id, path_id)
);

INSERT
    OR IGNORE INTO node_unlocks (user_id, node_id, path_id)
VALUES ('default', 'python', 'mle'),
    ('default', 'sql', 'mle'),
    ('default', 'stats', 'ds'),
    ('default', 'python', 'de'),
    ('default', 'sql', 'de'),
    ('default', 'python', 'aie');

-- ── Skill Milestones ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skill_milestones (
    user_id TEXT NOT NULL DEFAULT 'default',
    node_id TEXT NOT NULL,
    path_id TEXT NOT NULL,
    level INTEGER NOT NULL,
    badge TEXT NOT NULL CHECK (
        badge IN (
            'bronze',
            'silver',
            'gold',
            'master',
            'legend'
        )
    ),
    earned_at TEXT NOT NULL DEFAULT(datetime('now')),
    PRIMARY KEY (
        user_id,
        node_id,
        path_id,
        level
    )
);

-- ── Notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY DEFAULT(lower(hex(randomblob (16)))),
    user_id TEXT NOT NULL DEFAULT 'default',
    type TEXT NOT NULL CHECK (
        type IN (
            'sr_due',
            'level_up',
            'streak',
            'goal',
            'milestone',
            'system'
        )
    ),
    title TEXT NOT NULL,
    body TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    action_url TEXT,
    created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

-- ── Analytics Snapshots ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    user_id TEXT NOT NULL DEFAULT 'default',
    week_start TEXT NOT NULL,
    xp_gained INTEGER NOT NULL DEFAULT 0,
    tasks_done INTEGER NOT NULL DEFAULT 0,
    grind_mins INTEGER NOT NULL DEFAULT 0,
    sr_reviews INTEGER NOT NULL DEFAULT 0,
    nodes_leveled INTEGER NOT NULL DEFAULT 0,
    avg_sleep_h REAL,
    avg_energy REAL,
    created_at TEXT NOT NULL DEFAULT(datetime('now')),
    PRIMARY KEY (user_id, week_start)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_skills_user ON user_skill_levels (user_id, path_id);

CREATE INDEX IF NOT EXISTS idx_sr_cards_due ON sr_cards (user_id, due_date);

CREATE INDEX IF NOT EXISTS idx_sr_reviews_card ON sr_reviews (card_id, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_sr_reviews_user ON sr_reviews (user_id, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_subtopic_prog ON user_subtopic_progress (
    user_id,
    path_id,
    mastery DESC
);

CREATE INDEX IF NOT EXISTS idx_practice_prob ON practice_problems (
    subtopic_id,
    path_id,
    difficulty
);

CREATE INDEX IF NOT EXISTS idx_attempts_user_sub ON practice_attempts (user_id, subtopic_id, path_id);

CREATE INDEX IF NOT EXISTS idx_attempts_node ON practice_attempts (
    user_id,
    path_id,
    attempted_at DESC
);

CREATE INDEX IF NOT EXISTS idx_assessment_node ON assessment_attempts (user_id, node_id, path_id);

CREATE INDEX IF NOT EXISTS idx_grind_user_date ON grind_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_grind_node ON grind_sessions (node_id, path_id);

CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks (user_id, done, due_date);

CREATE INDEX IF NOT EXISTS idx_tasks_node ON tasks (
    user_id,
    node_id,
    path_id,
    done
);

CREATE INDEX IF NOT EXISTS idx_goals_user ON goals (user_id, done, target_date);

CREATE INDEX IF NOT EXISTS idx_sleep_user ON sleep_logs (user_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_focus_user ON focus_sessions (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_resources_node    ON learning_resources     (node_id, path_id, type);

CREATE INDEX IF NOT EXISTS idx_assessments_node ON assessments (
    node_id,
    path_id,
    level_target
);

CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications (
    user_id,
    read,
    created_at DESC
);

-- ── Trigger: sync node level after every practice attempt ────────────────────
CREATE TRIGGER IF NOT EXISTS trg_sync_node_level_after_practice
AFTER INSERT ON practice_attempts
BEGIN
    INSERT INTO user_skill_levels (user_id, node_id, path_id, level, xp_invested, updated_at)
    SELECT
        NEW.user_id,
        st.node_id,
        NEW.path_id,
        nm.computed_level,
        COALESCE(
            (SELECT xp_invested FROM user_skill_levels usl2
              WHERE usl2.user_id = NEW.user_id
                AND usl2.node_id = st.node_id
                AND usl2.path_id = NEW.path_id),
            0
        ) + NEW.xp_awarded,
        datetime('now')
    FROM skill_subtopics st
    JOIN v_node_mastery nm
        ON  nm.node_id = st.node_id
        AND nm.path_id = NEW.path_id
        AND nm.user_id = NEW.user_id
    WHERE st.id      = NEW.subtopic_id
      AND st.path_id = NEW.path_id
    ON CONFLICT (user_id, node_id, path_id) DO UPDATE
        SET level       = excluded.level,
            xp_invested = excluded.xp_invested,
            updated_at  = excluded.updated_at;
END;