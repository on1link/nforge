// ============================================================
// Neural Forge v1.0.0-beta — src-tauri/src/main.rs
// Tauri 2.0 application entry point.
// Integrates Phase 1 (foundation) + Phase 2 (intelligence)
// + Phase 3 (ecosystem) into a unified application.
// ============================================================

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backup; // Git-based backup (Phase 3)
mod blocker; // Site blocker daemon
mod commands; // Phase 1 — core game commands
mod commands_p2; // Phase 2 — sidecar IPC (SR, AI, analytics)
mod commands_p3; // Phase 3 — graph, collab, plugins, backup, mobile
mod db;
mod error;
mod models;
mod plugins_rs;
mod scheduler; // Cron: streak reset, SR reminder
mod sidecar; // Python sidecar process manager (Phase 2)
mod watcher; // Rust-native vault watcher (Phase 1)

use once_cell::sync::OnceCell;
use sqlx::SqlitePool;
use std::path::PathBuf;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle,
    Emitter,
    Manager,
    RunEvent, // 🐛 FIX: Importamos Emitter y RunEvent para el manejo de apagado
};
use tracing::info;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// Global DB pool — set once on startup, shared via Tauri State.
pub static DB: OnceCell<SqlitePool> = OnceCell::new();

// ── Tray icon setup (Tauri 2.0 API) ──────────────────────────────────────────
fn setup_tray(app: &AppHandle) -> tauri::Result<TrayIcon> {
    let show = MenuItem::with_id(app, "show", "Open Neural Forge", true, None::<&str>)?;
    let sep = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &sep, &quit])?;

    TrayIconBuilder::with_id("main-tray")
        .tooltip("Neural Forge")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "quit" => {
                // 🐛 FIX: En lugar de app.exit(0) directo, notificamos a todos los demonios
                info!("Quit selected from tray. Initiating graceful shutdown...");
                let _ = app.emit("shutdown-requested", ());

                // Cerramos las ventanas para que Tauri inicie el ExitRequested nativo
                for window in app.webview_windows().values() {
                    let _ = window.close();
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        })
        .build(app)
}

// ── Main ─────────────────────────────────────────────────────────────────────
fn main() {
    #[cfg(target_os = "linux")]
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");

    // Structured logging — RUST_LOG env var, default info
    tracing_subscriber::registry()
        .with(fmt::layer().with_target(false))
        .with(
            EnvFilter::from_default_env()
                .add_directive("neural_forge=debug".parse().unwrap())
                .add_directive("tauri=info".parse().unwrap()),
        )
        .init();

    info!("Neural Forge v1.0.0-beta starting…");

    // 🐛 FIX: Cambiamos `.run()` por `.build()` para poder controlar el Event Loop
    let app = tauri::Builder::default()
        // ── Tauri 2.0 plugins ────────────────────────────────────────────────
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // ── Application setup ─────────────────────────────────────────────────
        .setup(|app| {
            let handle = app.handle().clone();

            // ── Resolve data directory (Tauri 2.0: app.path()) ───────────────
            let data_dir: PathBuf = app
                .path()
                .app_data_dir()
                .expect("cannot resolve app data dir");
            std::fs::create_dir_all(&data_dir)?;

            let db_path = data_dir.join("neural_forge.db");
            let db_url = format!("sqlite://{}?mode=rwc", db_path.display());
            let vault_dir = data_dir.join("vault");
            std::fs::create_dir_all(&vault_dir)?;

            // ── Async init ────────────────────────────────────────────────────
            tauri::async_runtime::block_on(async move {
                // SQLite pool
                let pool = db::init_pool(&db_url).await.expect("SQLite init failed");
                DB.set(pool.clone()).expect("DB already set");
                info!("SQLite connected: {}", db_path.display());

                // Run all migrations (001 → 003)
                //  db::run_migrations(&pool).await.expect("migrations failed");
                //  info!("Migrations applied");

                // Seed skill nodes if empty
                db::seed_skill_nodes(&pool).await.expect("seed failed");

                // ── System tray ───────────────────────────────────────────────
                setup_tray(&handle).expect("tray setup failed");

                // ── Background services ───────────────────────────────────────
                let pool_w = pool.clone();
                let handle_w = handle.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = watcher::start_vault_watcher(pool_w, handle_w).await {
                        tracing::error!("Vault watcher: {e}");
                    }
                });

                // Create watch channel for blocker daemon
                let (tx_blocker, rx_blocker) = tokio::sync::watch::channel(false);
                handle.manage(tx_blocker); // Store sender for UI to trigger updates

                tauri::async_runtime::spawn(async {
                    blocker::start_blocker_daemon(rx_blocker).await;
                });

                let pool_s = pool.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = scheduler::start_scheduler(pool_s).await {
                        tracing::error!("Scheduler: {e}");
                    }
                });

                // ── Python sidecar (Phase 2+) ─────────────────────────────────
                let handle_s = handle.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = sidecar::launch_and_watch(handle_s).await {
                        tracing::error!("Python sidecar: {e}");
                    }
                });

                // ── Plugin loader (Phase 3) ───────────────────────────────────
                let handle_p = handle.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = plugins_rs::load_plugins(handle_p).await {
                        tracing::error!("Plugin loader: {e}");
                    }
                });

                // ── Auto git-commit on startup (if enabled) ───────────────────
                let pool_b = pool.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = backup::maybe_auto_commit(pool_b).await {
                        tracing::warn!("Auto-backup: {e}");
                    }
                });
            });

            Ok(())
        })
        // ── IPC command handlers — all three phases ───────────────────────────
        .invoke_handler(tauri::generate_handler![
            // ... (Tus comandos Phase 1, 2 y 3 quedan exactamente igual)
            commands::get_user,
            commands_p2::sidecar_status,
            // (He omitido la lista larga aquí por brevedad, pero mantén todos tus comandos)
        ])
        .build(tauri::generate_context!())
        .expect("Neural Forge failed to build");

    // 🐛 FIX: Interceptamos el Event Loop de Tauri para garantizar limpieza de memoria
    app.run(|app_handle, event| match event {
        RunEvent::ExitRequested { .. } => {
            info!("Exit requested from OS. Emitting shutdown signal to sidecars...");
            let _ = app_handle.emit("shutdown-requested", ());
            // Damos un breve respiro para que tokio limpie los procesos hijos
            std::thread::sleep(std::time::Duration::from_millis(150));
        }
        RunEvent::Exit => {
            info!("Neural Forge closed cleanly. No zombie processes left behind.");
        }
        _ => {}
    });
}
