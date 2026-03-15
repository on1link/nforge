// src-tauri/src/blocker.rs
// Site blocker daemon — patches /etc/hosts during grind sessions.

use std::time::Duration;

// Pass a receiver channel to your daemon so it can listen for instant updates
pub async fn start_blocker_daemon(mut rx_trigger: tokio::sync::watch::Receiver<bool>) {
    loop {
        // Wait for EITHER 60 seconds OR an instant trigger from the UI
        tokio::select! {
            _ = tokio::time::sleep(Duration::from_secs(60)) => {},
            _ = rx_trigger.changed() => {
                // The UI just signaled a state change, process immediately!
            }
        }

        if let Some(pool) = crate::DB.get() {
            // Explicitly define the SQL return type as String
            let domains: Vec<String> = sqlx::query_scalar::<_, String>(
                "SELECT value FROM config WHERE key='blocked_sites'",
            )
            .fetch_optional(pool)
            .await
            .ok()
            .flatten()
            .and_then(|v| serde_json::from_str(&v).ok())
            .unwrap_or_default();

            if !domains.is_empty() {
                // TODO: Apply rules.
                // Remember to use tokio::fs for file operations!
                // tokio::fs::write("/tmp/hosts.temp", new_hosts_content).await.unwrap();
            }
        }
    }
}

// pub async fn start_blocker_daemon() {
//     use std::time::Duration;
//     loop {
//         // Poll DB for active blocked domains
//         if let Some(pool) = crate::DB.get() {
//             let _domains: Vec<String> = sqlx::query_scalar::<_, String>(
//                 "SELECT value FROM config WHERE key='blocked_sites'"
//             ).fetch_optional(pool).await.ok().flatten()
//              .and_then(|v| serde_json::from_str(&v).ok())
//              .unwrap_or_default();
//             // Apply /etc/hosts rules (platform-specific, requires elevated perms)
//             // In production: use separate privileged helper
//         }
//         tokio::time::sleep(Duration::from_secs(60)).await;
//     }
// }
