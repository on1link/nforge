// ============================================================
// Neural Forge — src-tauri/src/db.rs
// SQLite pool init, WAL config, migrations 001–003, skill seed.
// Tauri 2.0 — no tauri::api::path; paths resolved via app.path().
// ============================================================

use anyhow::Result;
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use tracing::info;

/// Tauri managed state.
pub struct DbPool(pub SqlitePool);

// ── Pool ──────────────────────────────────────────────────────────────────────
pub async fn init_pool(db_url: &str) -> Result<SqlitePool> {
    let pool = SqlitePoolOptions::new()
        .max_connections(16)
        .connect(db_url)
        .await?;

    // WAL mode for concurrent Python sidecar + Rust access
    sqlx::query("PRAGMA journal_mode = WAL;")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA foreign_keys = ON;")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA synchronous = NORMAL;")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA wal_autocheckpoint = 1000;")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA cache_size = -32000;")
        .execute(&pool)
        .await?; // 32MB cache
    Ok(pool)
}

// ── Migrations ────────────────────────────────────────────────────────────────
/// Runs embedded SQL migrations in order: 001 → 002 → 003.
/// Uses sqlx::migrate! which embeds the files at compile time.
pub async fn run_migrations(pool: &SqlitePool) -> Result<()> {
    sqlx::migrate!("../migrations").run(pool).await?;
    info!("All migrations applied");
    Ok(())
}

// ── Skill node seed ───────────────────────────────────────────────────────────
pub async fn seed_skill_nodes(pool: &SqlitePool) -> Result<()> {
    let existing: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM skill_node_defs")
        .fetch_one(pool)
        .await?;
    if existing > 0 {
        return Ok(());
    }

    info!("Seeding skill nodes…");

    // (id, path_id, name, icon, description, x, y, prereqs_json, shared_paths)
    let mle: &[(&str, &str, &str, f32, f32, &str)] = &[
        ("python", "Python", "🐍", 180.0, 50.0, "[]"),
        ("git", "Git & Linux", "🐧", 520.0, 50.0, "[]"),
        ("numpy", "NumPy", "🔢", 60.0, 170.0, r#"["python"]"#),
        (
            "linalg",
            "Linear Algebra",
            "📐",
            260.0,
            170.0,
            r#"["python"]"#,
        ),
        ("stats", "Statistics", "📊", 460.0, 170.0, r#"["python"]"#),
        ("mlbasics", "ML Concepts", "📚", 640.0, 170.0, r#"["git"]"#),
        (
            "pytorch",
            "PyTorch",
            "🔥",
            80.0,
            290.0,
            r#"["numpy","linalg"]"#,
        ),
        (
            "sklearn",
            "Scikit-learn",
            "🤖",
            310.0,
            290.0,
            r#"["numpy","stats"]"#,
        ),
        (
            "mlops",
            "MLOps/Docker",
            "🐳",
            560.0,
            290.0,
            r#"["git","mlbasics"]"#,
        ),
        (
            "transformers",
            "Transformers",
            "⚡",
            150.0,
            410.0,
            r#"["pytorch"]"#,
        ),
        (
            "rl",
            "Reinforcement Learning",
            "🎮",
            400.0,
            410.0,
            r#"["sklearn","pytorch"]"#,
        ),
        (
            "infra",
            "ML Infrastructure",
            "☁",
            640.0,
            410.0,
            r#"["mlops"]"#,
        ),
        (
            "research",
            "Research Methods",
            "🔬",
            290.0,
            530.0,
            r#"["transformers","rl"]"#,
        ),
        (
            "deployment",
            "Model Deployment",
            "🚀",
            500.0,
            530.0,
            r#"["infra"]"#,
        ),
    ];

    let de: &[(&str, &str, &str, f32, f32, &str)] = &[
        ("python", "Python", "🐍", 180.0, 50.0, "[]"),
        ("git", "Git & Linux", "🐧", 520.0, 50.0, "[]"),
        ("sql", "SQL", "🗄", 80.0, 170.0, r#"["python"]"#),
        ("pandas", "Pandas", "🐼", 300.0, 170.0, r#"["python"]"#),
        ("stats", "Statistics", "📊", 520.0, 170.0, r#"["python"]"#),
        (
            "spark",
            "Apache Spark",
            "✨",
            80.0,
            290.0,
            r#"["sql","pandas"]"#,
        ),
        (
            "airflow",
            "Airflow/Prefect",
            "🌊",
            300.0,
            290.0,
            r#"["pandas","git"]"#,
        ),
        ("dbt", "dbt/ELT", "🔄", 520.0, 290.0, r#"["sql","stats"]"#),
        (
            "streaming",
            "Kafka/Streaming",
            "📡",
            80.0,
            410.0,
            r#"["spark"]"#,
        ),
        (
            "lakehouse",
            "Data Lakehouse",
            "🏠",
            300.0,
            410.0,
            r#"["airflow","dbt"]"#,
        ),
        ("olap", "OLAP/ClickHouse", "📊", 520.0, 410.0, r#"["dbt"]"#),
        (
            "dataops",
            "DataOps/Terraform",
            "⚙",
            80.0,
            530.0,
            r#"["streaming"]"#,
        ),
        (
            "platform",
            "Data Platform",
            "🏗",
            300.0,
            530.0,
            r#"["lakehouse","olap"]"#,
        ),
        (
            "governance",
            "Data Governance",
            "📋",
            520.0,
            530.0,
            r#"["platform"]"#,
        ),
    ];

    let ds: &[(&str, &str, &str, f32, f32, &str)] = &[
        ("python", "Python", "🐍", 180.0, 50.0, "[]"),
        ("stats", "Statistics", "📊", 460.0, 50.0, "[]"),
        ("pandas", "Pandas", "🐼", 80.0, 170.0, r#"["python"]"#),
        ("numpy", "NumPy", "🔢", 280.0, 170.0, r#"["python"]"#),
        ("viz", "Data Viz", "📈", 480.0, 170.0, r#"["stats"]"#),
        (
            "sklearn",
            "Scikit-learn",
            "🤖",
            80.0,
            290.0,
            r#"["pandas","numpy"]"#,
        ),
        (
            "xgboost",
            "Gradient Boosting",
            "⬡",
            300.0,
            290.0,
            r#"["sklearn"]"#,
        ),
        ("sql", "SQL", "🗄", 520.0, 290.0, r#"["stats","viz"]"#),
        (
            "bayes",
            "Bayesian Methods",
            "🎲",
            80.0,
            410.0,
            r#"["sklearn"]"#,
        ),
        (
            "timeseries",
            "Time Series",
            "📉",
            300.0,
            410.0,
            r#"["xgboost"]"#,
        ),
        (
            "causal",
            "Causal Inference",
            "🔮",
            520.0,
            410.0,
            r#"["sql"]"#,
        ),
        (
            "storytell",
            "Data Storytelling",
            "🎨",
            190.0,
            530.0,
            r#"["bayes","timeseries"]"#,
        ),
        (
            "ab_testing",
            "A/B Testing",
            "🧪",
            430.0,
            530.0,
            r#"["causal"]"#,
        ),
    ];

    for (id, name, icon, x, y, prereqs) in mle {
        sqlx::query(
            "INSERT OR IGNORE INTO skill_node_defs (id,path_id,name,icon,description,canvas_x,canvas_y,prereqs)
             VALUES (?,?,?,?,?,?,?,?)"
        ).bind(id).bind("mle").bind(name).bind(icon)
         .bind(format!("MLE: {name}")).bind(x).bind(y).bind(prereqs)
         .execute(pool).await?;
    }
    for (id, name, icon, x, y, prereqs) in de {
        sqlx::query(
            "INSERT OR IGNORE INTO skill_node_defs (id,path_id,name,icon,description,canvas_x,canvas_y,prereqs)
             VALUES (?,?,?,?,?,?,?,?)"
        ).bind(id).bind("de").bind(name).bind(icon)
         .bind(format!("DE: {name}")).bind(x).bind(y).bind(prereqs)
         .execute(pool).await?;
    }
    for (id, name, icon, x, y, prereqs) in ds {
        sqlx::query(
            "INSERT OR IGNORE INTO skill_node_defs (id,path_id,name,icon,description,canvas_x,canvas_y,prereqs)
             VALUES (?,?,?,?,?,?,?,?)"
        ).bind(id).bind("ds").bind(name).bind(icon)
         .bind(format!("DS: {name}")).bind(x).bind(y).bind(prereqs)
         .execute(pool).await?;
    }

    // Default user
    sqlx::query(
        "INSERT OR IGNORE INTO users (id,username,xp,level,sp,streak,active_paths)
         VALUES ('default','Learner',0,1,0,0,'[\"mle\"]')",
    )
    .execute(pool)
    .await?;

    // Seed skill path metadata
    for (id, name, col) in [
        ("mle", "Machine Learning Engineer", "#00e5ff"),
        ("de", "Data Engineer", "#9b59ff"),
        ("ds", "Data Scientist", "#ffc107"),
    ] {
        sqlx::query("INSERT OR IGNORE INTO skill_paths (id,name,color) VALUES (?,?,?)")
            .bind(id)
            .bind(name)
            .bind(col)
            .execute(pool)
            .await?;
    }

    info!("Skill nodes seeded");
    Ok(())
}
