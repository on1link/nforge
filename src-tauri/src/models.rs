// src-tauri/src/models.rs
// Shared serde types used across command modules.

use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id:           String,
    pub username:     String,
    pub xp:           i64,
    pub level:        i64,
    pub sp:           i64,
    pub streak:       i64,
    pub active_paths: String,   // JSON array
    pub last_active:  Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Task {
    pub id:            String,
    pub title:         String,
    pub description:   Option<String>,
    pub done:          bool,
    pub xp_reward:     i64,
    pub due_date:      Option<String>,
    pub skill_node_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct XpResult {
    pub xp_gained:  i64,
    pub total_xp:   i64,
    pub new_level:  i64,
    pub leveled_up: bool,
    pub sp_gained:  i64,
    pub total_sp:   i64,
}
