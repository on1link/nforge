// ============================================================
// Neural Forge — src-tauri/src/error.rs
// Unified error type. All #[tauri::command] handlers return Result<T, NfError>.
// NfError implements serde::Serialize so Tauri can send it to the frontend.
// ============================================================

use serde::Serialize;
use thiserror::Error;

pub type Result<T> = std::result::Result<T, NfError>;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum NfError {
    #[error("Database error: {0}")]
    Db(String),

    #[error("SQLx error: {0}")]
    Sqlx(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("Sidecar error: {0}")]
    Sidecar(String),

    #[error("Sidecar unavailable — is the Python sidecar running?")]
    SidecarUnavailable,

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Backup error: {0}")]
    Backup(String),

    #[error("Plugin error: {0}")]
    Plugin(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<sqlx::Error> for NfError {
    fn from(e: sqlx::Error) -> Self {
        match e {
            sqlx::Error::RowNotFound => NfError::NotFound("Row not found".into()),
            other => NfError::Sqlx(other.to_string()),
        }
    }
}

impl From<anyhow::Error> for NfError {
    fn from(e: anyhow::Error) -> Self {
        NfError::Internal(e.to_string())
    }
}

impl From<std::io::Error> for NfError {
    fn from(e: std::io::Error) -> Self {
        NfError::Io(e.to_string())
    }
}

impl From<reqwest::Error> for NfError {
    fn from(e: reqwest::Error) -> Self {
        if e.is_connect() {
            NfError::SidecarUnavailable
        } else {
            NfError::Sidecar(e.to_string())
        }
    }
}
