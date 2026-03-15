// ============================================================
// Neural Forge — src-tauri/src/commands_p2.rs
// Phase 2 IPC commands — all proxy to Python sidecar via HTTP.
// Tauri 2.0: same #[tauri::command] pattern, no API changes.
// ============================================================

use serde_json::{json, Value};
use crate::error::{NfError, Result};
use crate::sidecar::{get, post, is_alive};

// ── Convenience macro ─────────────────────────────────────────────────────────
macro_rules! proxy_get {
    ($name:ident, $path:expr) => {
        #[tauri::command]
        pub async fn $name() -> Result<Value> {
            get($path).await.map_err(|e| NfError::Sidecar(e.to_string()))
        }
    };
}

// ════════════════════════════════════════════════════════════════════════════
// SPACED REPETITION (SM-2)
// ════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn sr_get_due(limit: Option<u32>) -> Result<Value> {
    let l = limit.unwrap_or(20);
    get(&format!("/sr/due?limit={l}")).await.map_err(|e| NfError::Sidecar(e.to_string()))
}

proxy_get!(sr_get_all,   "/sr/all");
proxy_get!(sr_get_stats, "/sr/stats");

#[tauri::command]
pub async fn sr_create_card(node_id: String, path_id: String, front: String, back: String) -> Result<Value> {
    post("/sr/create", json!({"node_id":node_id,"path_id":path_id,"front":front,"back":back}))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

#[tauri::command]
pub async fn sr_submit_review(card_id: String, quality: u8) -> Result<Value> {
    post("/sr/review", json!({"card_id":card_id,"quality":quality}))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

// ════════════════════════════════════════════════════════════════════════════
// SEMANTIC SEARCH
// ════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn search_vault(query: String, top_k: Option<u32>) -> Result<Value> {
    let k = top_k.unwrap_or(8);
    get(&format!("/search/query?q={}&top_k={k}", urlencoding::encode(&query)))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

#[tauri::command]
pub async fn search_related(skill_id: String, top_k: Option<u32>) -> Result<Value> {
    let k = top_k.unwrap_or(5);
    get(&format!("/search/related/{skill_id}?top_k={k}"))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

proxy_get!(search_reindex, "/search/reindex");
proxy_get!(search_stats,   "/search/stats");

// ════════════════════════════════════════════════════════════════════════════
// LLM / OLLAMA
// ════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn llm_chat(messages: Vec<Value>, model: Option<String>, vault_context: Option<bool>) -> Result<Value> {
    post("/llm/chat", json!({"messages":messages,"model":model,"vault_context":vault_context.unwrap_or(true)}))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

#[tauri::command]
pub async fn llm_practice(skill_id: String, difficulty: Option<String>) -> Result<Value> {
    post("/llm/practice", json!({"skill_id":skill_id,"difficulty":difficulty.unwrap_or_else(||"medium".into())}))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

#[tauri::command]
pub async fn llm_explain(concept: String, context: Option<String>) -> Result<Value> {
    post("/llm/explain", json!({"concept":concept,"context":context}))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

#[tauri::command]
pub async fn llm_ingest_paper(file_path: String, write_to_vault: Option<bool>) -> Result<Value> {
    post("/llm/paper-digest", json!({"file_path":file_path,"write_to_vault":write_to_vault.unwrap_or(true)}))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

proxy_get!(llm_list_models, "/llm/models");

// ════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ════════════════════════════════════════════════════════════════════════════

proxy_get!(analytics_overview,         "/analytics/overview");
proxy_get!(analytics_skill_velocity,   "/analytics/skill-velocity");
proxy_get!(analytics_sleep_correlation,"/analytics/sleep-correlation");
proxy_get!(analytics_weekly_snapshot,  "/analytics/snapshot/weekly");

// ════════════════════════════════════════════════════════════════════════════
// SIDECAR MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn sidecar_status() -> Result<Value> {
    let alive = is_alive().await;
    Ok(json!({"alive":alive,"port":7731}))
}

#[tauri::command]
pub async fn sidecar_restart(app: tauri::AppHandle) -> Result<()> {
    crate::sidecar::restart(app).await.map_err(|e| NfError::Sidecar(e.to_string()))
}

// Helper: URL encode
mod urlencoding {
    pub fn encode(s: &str) -> String {
        s.chars().map(|c| match c {
            'a'..='z'|'A'..='Z'|'0'..='9'|'-'|'_'|'.'|'~' => c.to_string(),
            ' ' => "%20".to_string(),
            c   => format!("%{:02X}", c as u32),
        }).collect()
    }
}
