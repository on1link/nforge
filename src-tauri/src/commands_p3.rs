// ============================================================
// Neural Forge — src-tauri/src/commands_p3.rs
// Phase 3 IPC commands: backup, sync, graph, collab, plugins,
// mobile API key management. Proxy to Python sidecar.
// ============================================================

use serde_json::{json, Value};
use crate::error::{NfError, Result};
use crate::sidecar::{get, post};

macro_rules! proxy_get {
    ($name:ident, $path:expr) => {
        #[tauri::command]
        pub async fn $name() -> Result<Value> {
            get($path).await.map_err(|e| NfError::Sidecar(e.to_string()))
        }
    };
}

// ════════════════════════════════════════════════════════════════════════════
// BACKUP
// ════════════════════════════════════════════════════════════════════════════

proxy_get!(backup_status,      "/backup/status");
proxy_get!(backup_log,         "/backup/log");
proxy_get!(backup_snapshot_db, "/backup/snapshot-db");

#[tauri::command]
pub async fn backup_commit(message: Option<String>) -> Result<Value> {
    post("/backup/commit", json!({"message":message}))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

#[tauri::command]
pub async fn backup_push() -> Result<Value> {
    post("/backup/push", json!({})).await.map_err(|e| NfError::Sidecar(e.to_string()))
}

#[tauri::command]
pub async fn backup_set_remote(url: String) -> Result<Value> {
    post("/backup/set-remote", json!({"url":url}))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

// ════════════════════════════════════════════════════════════════════════════
// OBSIDIAN SYNC
// ════════════════════════════════════════════════════════════════════════════

proxy_get!(sync_status,        "/sync/status");
proxy_get!(sync_conflicts,     "/sync/conflicts");
proxy_get!(sync_reindex_vault, "/sync/reindex-vault");

#[tauri::command]
pub async fn sync_write_note(path: String, content: String, force: Option<bool>) -> Result<Value> {
    post("/sync/write", json!({"path":path,"content":content,"force":force.unwrap_or(false)}))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

#[tauri::command]
pub async fn sync_resolve(note_path: String, resolution: String) -> Result<Value> {
    post("/sync/resolve", json!({"note_path":note_path,"resolution":resolution}))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

// ════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE GRAPH
// ════════════════════════════════════════════════════════════════════════════

proxy_get!(graph_data,    "/graph/data");
proxy_get!(graph_stats,   "/graph/stats");
proxy_get!(graph_rebuild, "/graph/rebuild");

#[tauri::command]
pub async fn graph_neighbours(node_id: String, depth: Option<u32>) -> Result<Value> {
    let d = depth.unwrap_or(2);
    get(&format!("/graph/neighbours/{node_id}?depth={d}"))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

#[tauri::command]
pub async fn graph_find_path(src: String, dst: String) -> Result<Value> {
    get(&format!("/graph/path?src={src}&dst={dst}"))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

// ════════════════════════════════════════════════════════════════════════════
// STUDY ROOMS
// ════════════════════════════════════════════════════════════════════════════

proxy_get!(collab_list_rooms, "/collab/rooms");

#[tauri::command]
pub async fn collab_create_room(room_id: Option<String>, name: String, topic: Option<String>, is_public: Option<bool>) -> Result<Value> {
    post("/collab/rooms", json!({"room_id":room_id,"name":name,"topic":topic.unwrap_or_default(),"is_public":is_public.unwrap_or(true)}))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

#[tauri::command]
pub async fn collab_delete_room(room_id: String) -> Result<Value> {
    // DELETE via post workaround (sidecar supports DELETE natively)
    reqwest::Client::new()
        .delete(format!("http://localhost:7731/collab/rooms/{room_id}"))
        .send().await.map_err(|_| NfError::SidecarUnavailable)?
        .json::<Value>().await.map_err(|e| NfError::Sidecar(e.to_string()))
}

#[tauri::command]
pub async fn collab_room_messages(room_id: String, limit: Option<u32>) -> Result<Value> {
    let l = limit.unwrap_or(50);
    get(&format!("/collab/rooms/{room_id}/messages?limit={l}"))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

// ════════════════════════════════════════════════════════════════════════════
// PLUGINS
// ════════════════════════════════════════════════════════════════════════════

proxy_get!(plugins_list,   "/plugins/");
proxy_get!(plugins_events, "/plugins/events");

#[tauri::command]
pub async fn plugins_toggle(plugin_id: String, enabled: bool) -> Result<Value> {
    post("/plugins/toggle", json!({"plugin_id":plugin_id,"enabled":enabled}))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

#[tauri::command]
pub async fn plugins_fire_hook(hook: String, payload: Option<Value>) -> Result<Value> {
    post("/plugins/fire", json!({"hook":hook,"payload":payload.unwrap_or(json!({}))}))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

#[tauri::command]
pub async fn plugins_get_config(plugin_id: String) -> Result<Value> {
    get(&format!("/plugins/config/{plugin_id}"))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

#[tauri::command]
pub async fn plugins_set_config(plugin_id: String, config: Value) -> Result<Value> {
    reqwest::Client::new()
        .put(format!("http://localhost:7731/plugins/config/{plugin_id}"))
        .json(&config).send().await.map_err(|_| NfError::SidecarUnavailable)?
        .json::<Value>().await.map_err(|e| NfError::Sidecar(e.to_string()))
}

// ════════════════════════════════════════════════════════════════════════════
// MOBILE API KEYS
// ════════════════════════════════════════════════════════════════════════════

proxy_get!(mobile_list_keys, "/mobile/keys");

#[tauri::command]
pub async fn mobile_generate_key(label: Option<String>) -> Result<Value> {
    post("/mobile/keys/generate", json!({"label":label.unwrap_or_else(||"Mobile companion".into()),"user_id":"default"}))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}

#[tauri::command]
pub async fn mobile_revoke_key(key_id: String) -> Result<Value> {
    reqwest::Client::new()
        .delete(format!("http://localhost:7731/mobile/keys/{key_id}"))
        .send().await.map_err(|_| NfError::SidecarUnavailable)?
        .json::<Value>().await.map_err(|e| NfError::Sidecar(e.to_string()))
}

// ════════════════════════════════════════════════════════════════════════════
// SYNCTHING
// ════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn syncthing_status(api_key: Option<String>) -> Result<Value> {
    let k = api_key.unwrap_or_default();
    get(&format!("/backup/syncthing/status?api_key={k}"))
        .await.map_err(|e| NfError::Sidecar(e.to_string()))
}
