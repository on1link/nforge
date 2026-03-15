// ============================================================
// Neural Forge — src-tauri/src/watcher.rs (Tauri 2.0)
// Vault file watcher — notify crate, same logic as Phase 1.
// ============================================================

use anyhow::Result;
use sqlx::SqlitePool;
use tauri::AppHandle;
use walkdir::WalkDir;

pub async fn start_vault_watcher(pool: SqlitePool, _app: AppHandle) -> Result<()> {
    use std::time::Duration;
    loop {
        let vault_path: Option<String> = sqlx::query_scalar(
            "SELECT value FROM config WHERE key='vault_path'"
        ).fetch_optional(&pool).await.ok().flatten();

        match vault_path {
            None => { tokio::time::sleep(Duration::from_secs(30)).await; }
            Some(path) => {
                tracing::info!("Vault watcher on: {path}");
                // Index existing notes
                let _ = index_vault_full(&pool, &path).await;
                // Watch for changes (simplified — production uses notify crate)
                tokio::time::sleep(Duration::from_secs(60)).await;
            }
        }
    }
}

async fn index_vault_full(pool: &SqlitePool, path: &str) -> Result<()> {
    use std::path::Path;
    let vault = Path::new(path);
    if !vault.exists() { return Ok(()); }

    for entry in WalkDir::new(vault).into_iter().flatten() {
        if entry.path().extension().and_then(|e| e.to_str()) == Some("md") {
            let p = entry.path().to_string_lossy().to_string();
            let content = std::fs::read_to_string(entry.path()).unwrap_or_default();
            let title   = content.lines().find(|l| l.starts_with("# "))
                .map(|l| l[2..].trim().to_string())
                .unwrap_or_else(|| entry.path().file_stem().unwrap_or_default().to_string_lossy().to_string());
            let words   = content.split_whitespace().count() as i64;
            let mtime   = entry.metadata().ok()
                .and_then(|m| m.modified().ok())
                .map(|t| chrono::DateTime::<chrono::Utc>::from(t).format("%Y-%m-%dT%H:%M:%S").to_string())
                .unwrap_or_default();

            let _ = sqlx::query(
                "INSERT INTO vault_index (path,title,word_count,modified_at)
                 VALUES (?,?,?,?)
                 ON CONFLICT(path) DO UPDATE SET title=excluded.title,word_count=excluded.word_count,modified_at=excluded.modified_at"
            ).bind(&p).bind(&title).bind(words).bind(&mtime).execute(pool).await;
        }
    }
    Ok(())
}
