// src-tauri/src/plugins_rs.rs
// Rust-side plugin bridge: waits for sidecar ready, then loads all plugins.
// The actual Python plugin execution happens in the sidecar.

use anyhow::Result;
use tauri::AppHandle;

pub async fn load_plugins(_app: AppHandle) -> Result<()> {
    // Wait for sidecar to be ready before loading plugins
    tokio::time::sleep(std::time::Duration::from_secs(15)).await;

    match crate::sidecar::post("/plugins/fire", serde_json::json!({
        "hook": "on_startup",
        "payload": { "version": "1.0.0-beta" }
    })).await {
        Ok(_)  => tracing::info!("Plugin on_startup hooks fired"),
        Err(e) => tracing::warn!("Plugin startup skipped: {e}"),
    }
    Ok(())
}
