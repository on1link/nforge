// ============================================================
// Neural Forge — src-tauri/src/sidecar.rs
// Launches the Python sidecar (FastAPI on port 7731),
// monitors it, and restarts if it crashes.
// Tauri 2.0: uses std::process::Command (sidecar API is used
// for bundled binaries; here we use the raw process approach
// since we ship the Python source and require uv/python3).
// ============================================================

use std::{
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::Duration,
};

use anyhow::Result;
use tauri::{AppHandle, Emitter, Manager};
use tracing::{error, info, warn};

const SIDECAR_PORT: u16 = 7731;
const HEALTH_URL: &str = "http://localhost:7731/health";
const MAX_RETRIES: u32 = 30;
const RETRY_DELAY: u64 = 2; // seconds

static SIDECAR_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

// ── Public API ────────────────────────────────────────────────────────────────

/// Launch the sidecar and watch it, restarting on crash.
/// Emits "sidecar-status" events to the frontend.
pub async fn launch_and_watch(app: AppHandle) -> Result<()> {
    let sidecar_dir = resolve_sidecar_dir(&app)?;

    loop {
        info!("Starting Python sidecar in {}", sidecar_dir.display());
        emit(&app, "starting");

        match spawn_sidecar(&sidecar_dir) {
            Ok(child) => {
                {
                    let mut lock = SIDECAR_PROCESS.lock().unwrap();
                    *lock = Some(child);
                }
                // Wait for health check
                if wait_for_health().await {
                    info!("Sidecar healthy on :{}", SIDECAR_PORT);
                    emit(&app, "ready");
                } else {
                    error!("Sidecar failed health check — restarting");
                    emit(&app, "unhealthy");
                    kill_sidecar();
                    tokio::time::sleep(Duration::from_secs(3)).await;
                    continue;
                }

                // Poll process until it exits
                loop {
                    tokio::time::sleep(Duration::from_secs(5)).await;
                    let exited = {
                        let mut lock = SIDECAR_PROCESS.lock().unwrap();
                        if let Some(child) = lock.as_mut() {
                            matches!(child.try_wait(), Ok(Some(_)))
                        } else {
                            true
                        }
                    };
                    if exited {
                        warn!("Sidecar process exited — restarting in 5s");
                        emit(&app, "crashed");
                        break;
                    }
                }
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
            Err(e) => {
                error!("Failed to spawn sidecar: {e}");
                emit(&app, "error");
                tokio::time::sleep(Duration::from_secs(10)).await;
            }
        }
    }
}

/// Check if the sidecar is alive (called from commands).
pub async fn is_alive() -> bool {
    let client = reqwest::Client::new();
    client
        .get(HEALTH_URL)
        .timeout(Duration::from_millis(800))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

/// Kill and restart the sidecar (triggered from UI settings).
pub async fn restart(app: AppHandle) -> Result<()> {
    kill_sidecar();
    tokio::time::sleep(Duration::from_millis(500)).await;
    let dir = resolve_sidecar_dir(&app)?;
    match spawn_sidecar(&dir) {
        Ok(child) => {
            let mut lock = SIDECAR_PROCESS.lock().unwrap();
            *lock = Some(child);
            Ok(())
        }
        Err(e) => Err(e),
    }
}

/// Make a GET request to the sidecar.
pub async fn get(path: &str) -> Result<serde_json::Value> {
    let url = format!("http://localhost:{SIDECAR_PORT}{path}");
    let res = reqwest::get(&url).await?.error_for_status()?;
    Ok(res.json().await?)
}

/// Make a POST request to the sidecar with a JSON body.
pub async fn post(path: &str, body: serde_json::Value) -> Result<serde_json::Value> {
    let url = format!("http://localhost:{SIDECAR_PORT}{path}");
    let res = reqwest::Client::new()
        .post(&url)
        .json(&body)
        .send()
        .await?
        .error_for_status()?;
    Ok(res.json().await?)
}

// ── Internals ─────────────────────────────────────────────────────────────────

fn spawn_sidecar(dir: &PathBuf) -> Result<Child> {
    // Try `uv run` first (fast, manages its own venv)
    // Fall back to `python3 -m uvicorn`
    let child = if which::which("uv").is_ok() {
        Command::new("uv")
            .args([
                "run",
                "uvicorn",
                "main:app",
                "--host",
                "127.0.0.1",
                "--port",
                &SIDECAR_PORT.to_string(),
                "--log-level",
                "warning",
            ])
            .current_dir(dir)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()?
    } else {
        Command::new("python3")
            .args([
                "-m",
                "uvicorn",
                "main:app",
                "--host",
                "127.0.0.1",
                "--port",
                &SIDECAR_PORT.to_string(),
                "--log-level",
                "warning",
            ])
            .current_dir(dir)
            .env("PYTHONPATH", dir.to_str().unwrap_or("."))
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()?
    };
    Ok(child)
}

async fn wait_for_health() -> bool {
    let client = reqwest::Client::new();
    for attempt in 1..=MAX_RETRIES {
        tokio::time::sleep(Duration::from_secs(RETRY_DELAY)).await;
        if let Ok(r) = client
            .get(HEALTH_URL)
            .timeout(Duration::from_secs(2))
            .send()
            .await
        {
            if r.status().is_success() {
                return true;
            }
        }
        info!("Waiting for sidecar health… attempt {attempt}/{MAX_RETRIES}");
    }
    false
}

fn kill_sidecar() {
    let mut lock = SIDECAR_PROCESS.lock().unwrap();
    if let Some(mut child) = lock.take() {
        let _ = child.kill();
    }
}

fn resolve_sidecar_dir(app: &AppHandle) -> Result<PathBuf> {
    // In dev: project root / python_sidecar
    // In release: app resource dir / python_sidecar
    let resource = app
        .path()
        .resource_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let candidates = [
        resource.join("python_sidecar"),
        PathBuf::from("./python_sidecar"),
        PathBuf::from("../python_sidecar"),
    ];
    for c in &candidates {
        if c.join("main.py").exists() {
            return Ok(c.clone());
        }
    }
    // Default — let it fail at spawn time with a clear error
    Ok(PathBuf::from("./python_sidecar"))
}

fn emit(app: &AppHandle, status: &str) {
    let _ = app.emit("sidecar-status", serde_json::json!({ "status": status }));
}
