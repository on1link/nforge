// src-tauri/src/backup.rs
// Checks if auto-commit is enabled and calls sidecar to do git commit.

use anyhow::Result;
use sqlx::SqlitePool;

pub async fn maybe_auto_commit(pool: SqlitePool) -> Result<()> {
    // Wait for sidecar to be ready
    tokio::time::sleep(std::time::Duration::from_secs(10)).await;

    let auto: Option<String> = sqlx::query_scalar(
        "SELECT value FROM config WHERE key='auto_git_commit'"
    ).fetch_optional(&pool).await.ok().flatten();

    if auto.as_deref() == Some("true") {
        let _ = crate::sidecar::post("/backup/commit",
            serde_json::json!({"message": "neural-forge auto-commit on startup"})
        ).await;
        tracing::info!("Auto git-commit triggered on startup");
    }
    Ok(())
}
