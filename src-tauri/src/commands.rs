// ============================================================
// Neural Forge — src-tauri/src/commands.rs
// Phase 1 core game IPC commands — Tauri 2.0 compatible.
// State<'_, DbPool> unchanged; path resolution uses app.path().
// ============================================================

use chrono::Utc;
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::db::DbPool;
use crate::error::{NfError, Result};

const XP_PER_LEVEL: i64 = 1000;

// ── XP helper ─────────────────────────────────────────────────────────────────
async fn award_xp(
    pool: &SqlitePool,
    user_id: &str,
    amount: i64,
    desc: &str,
    etype: &str,
    sp_bonus: i64,
) -> Result<Value> {
    let (xp, level, sp): (i64, i64, i64) =
        sqlx::query_as("SELECT xp, level, sp FROM users WHERE id = ?")
            .bind(user_id)
            .fetch_one(pool)
            .await?;

    let new_xp = xp + amount;
    let new_level = new_xp / XP_PER_LEVEL + 1;
    let leveled = new_level > level;
    let sp_gain = sp_bonus + if leveled { 3 } else { 0 };
    let new_sp = sp + sp_gain;

    sqlx::query("UPDATE users SET xp=?,level=?,sp=? WHERE id=?")
        .bind(new_xp)
        .bind(new_level)
        .bind(new_sp)
        .bind(user_id)
        .execute(pool)
        .await?;

    sqlx::query(
        "INSERT INTO activity_log (id,user_id,entry_type,description,xp) VALUES (?,?,?,?,?)",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(user_id)
    .bind(etype)
    .bind(desc)
    .bind(amount)
    .execute(pool)
    .await?;

    Ok(
        json!({ "xp_gained":amount,"total_xp":new_xp,"new_level":new_level,"leveled_up":leveled,"sp_gained":sp_gain,"total_sp":new_sp }),
    )
}

// ════════════════════════════════════════════════════════════════════════════
// USER
// ════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn get_user(db: State<'_, DbPool>) -> Result<Value> {
    let row = sqlx::query_as::<_, (String, String, i64, i64, i64, i64, String)>(
        "SELECT id,username,xp,level,sp,streak,active_paths FROM users WHERE id='default'",
    )
    .fetch_one(&db.0)
    .await?;
    Ok(
        json!({"id":row.0,"username":row.1,"xp":row.2,"level":row.3,"sp":row.4,"streak":row.5,"active_paths":row.6}),
    )
}

#[tauri::command]
pub async fn update_streak(db: State<'_, DbPool>) -> Result<i64> {
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let yesterday = (Utc::now() - chrono::Duration::days(1))
        .format("%Y-%m-%d")
        .to_string();

    let last: Option<String> =
        sqlx::query_scalar("SELECT last_active FROM users WHERE id='default'")
            .fetch_one(&db.0)
            .await?;

    let new_streak: i64 = match last.as_deref() {
        Some(d) if d == today => {
            return Ok(
                sqlx::query_scalar("SELECT streak FROM users WHERE id='default'")
                    .fetch_one(&db.0)
                    .await?,
            )
        }
        Some(d) if d == yesterday => {
            sqlx::query_scalar("SELECT streak+1 FROM users WHERE id='default'")
                .fetch_one(&db.0)
                .await?
        }
        _ => 1,
    };

    sqlx::query("UPDATE users SET streak=?,last_active=? WHERE id='default'")
        .bind(new_streak)
        .bind(&today)
        .execute(&db.0)
        .await?;
    Ok(new_streak)
}

// ════════════════════════════════════════════════════════════════════════════
// SKILLS
// ════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn get_skill_levels(db: State<'_, DbPool>) -> Result<Value> {
    let rows = sqlx::query_as::<_, (String, String, i64, i64)>(
        "SELECT d.id,d.path_id,COALESCE(u.level,0),COALESCE(u.xp_invested,0)
         FROM skill_node_defs d
         LEFT JOIN user_skill_levels u ON u.node_id=d.id AND u.user_id='default'",
    )
    .fetch_all(&db.0)
    .await?;

    let defs = sqlx::query_as::<_, (String, String, String, String, String, f32, f32, String)>(
        "SELECT id,path_id,name,icon,description,x,y,prerequisites FROM skill_node_defs",
    )
    .fetch_all(&db.0)
    .await?;

    let levels: serde_json::Map<String, Value> = rows
        .iter()
        .map(|(id, _, lvl, xp)| (id.clone(), json!({"level":lvl,"xp_invested":xp})))
        .collect();

    let nodes: Vec<Value> = defs.iter().map(|(id,path,name,icon,desc,x,y,prereqs)|
        json!({"id":id,"path_id":path,"name":name,"icon":icon,"description":desc,"x":x,"y":y,"prerequisites":prereqs})
    ).collect();

    Ok(json!({"levels":levels,"nodes":nodes}))
}

#[tauri::command]
pub async fn level_up_skill(node_id: String, db: State<'_, DbPool>) -> Result<Value> {
    // Check SP
    let sp: i64 = sqlx::query_scalar("SELECT sp FROM users WHERE id='default'")
        .fetch_one(&db.0)
        .await?;
    if sp < 1 {
        return Err(NfError::Validation("Not enough SP (need 1)".into()));
    }

    let cur_level: i64 = sqlx::query_scalar(
        "SELECT COALESCE(level,0) FROM user_skill_levels WHERE user_id='default' AND node_id=?",
    )
    .bind(&node_id)
    .fetch_one(&db.0)
    .await
    .unwrap_or(0);

    if cur_level >= 5 {
        return Err(NfError::Validation("Skill already at max level".into()));
    }

    // Deduct SP
    sqlx::query("UPDATE users SET sp=sp-1 WHERE id='default'")
        .execute(&db.0)
        .await?;

    // Upsert skill level
    sqlx::query(
        "INSERT INTO user_skill_levels (user_id,node_id,level,xp_invested)
         VALUES ('default',?,?,100)
         ON CONFLICT(user_id,node_id) DO UPDATE SET level=level+1,xp_invested=xp_invested+100,updated_at=datetime('now')"
    ).bind(&node_id).execute(&db.0).await?;

    // Get skill name for XP award
    let name: String = sqlx::query_scalar("SELECT name FROM skill_node_defs WHERE id=?")
        .bind(&node_id)
        .fetch_one(&db.0)
        .await
        .unwrap_or_else(|_| node_id.clone());

    let xp_result = award_xp(
        &db.0,
        "default",
        200,
        &format!("Leveled up: {name}"),
        "skill",
        0,
    )
    .await?;

    // Fire plugin hook via sidecar (best-effort)
    let _ = crate::sidecar::post(
        "/plugins/fire",
        serde_json::json!({
            "hook": "on_skill_levelup",
            "payload": { "node_id": node_id, "skill_name": name, "level": cur_level + 1 }
        }),
    )
    .await;

    Ok(json!({ "node_id": node_id, "new_level": cur_level + 1, "xp_result": xp_result }))
}

// ════════════════════════════════════════════════════════════════════════════
// TASKS
// ════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn list_tasks(db: State<'_, DbPool>) -> Result<Value> {
    let rows = sqlx::query_as::<
        _,
        (
            String,
            String,
            Option<String>,
            i64,
            i64,
            Option<String>,
            Option<String>,
        ),
    >(
        "SELECT id,title,description,done,xp_reward,due_date,skill_node_id
         FROM tasks WHERE user_id='default' ORDER BY done ASC, created_at DESC LIMIT 100",
    )
    .fetch_all(&db.0)
    .await?;
    Ok(json!(rows.iter().map(|(id,t,d,dn,xp,due,sk)|
        json!({"id":id,"title":t,"description":d,"done":dn==&1i64,"xp_reward":xp,"due_date":due,"skill_node_id":sk})
    ).collect::<Vec<_>>()))
}

#[tauri::command]
pub async fn create_task(
    title: String,
    description: Option<String>,
    xp_reward: Option<i64>,
    due_date: Option<String>,
    skill_node_id: Option<String>,
    db: State<'_, DbPool>,
) -> Result<Value> {
    let id = Uuid::new_v4().to_string();
    let xp = xp_reward.unwrap_or(50);
    sqlx::query("INSERT INTO tasks (id,user_id,title,description,xp_reward,due_date,skill_node_id) VALUES (?,?,?,?,?,?,?)")
        .bind(&id).bind("default").bind(&title).bind(&description).bind(xp).bind(&due_date).bind(&skill_node_id)
        .execute(&db.0).await?;
    Ok(json!({"id":id,"title":title,"xp_reward":xp}))
}

#[tauri::command]
pub async fn complete_task(task_id: String, db: State<'_, DbPool>) -> Result<Value> {
    let (title, xp): (String, i64) =
        sqlx::query_as("SELECT title,xp_reward FROM tasks WHERE id=? AND user_id='default'")
            .bind(&task_id)
            .fetch_one(&db.0)
            .await
            .map_err(|_| NfError::NotFound(task_id.clone()))?;

    sqlx::query("UPDATE tasks SET done=1,done_at=datetime('now') WHERE id=?")
        .bind(&task_id)
        .execute(&db.0)
        .await?;

    let xp_result = award_xp(&db.0, "default", xp, &format!("Task: {title}"), "task", 1).await?;

    let _ = crate::sidecar::post(
        "/plugins/fire",
        serde_json::json!({
            "hook": "on_task_complete",
            "payload": { "task_id": task_id, "task_name": title, "xp": xp }
        }),
    )
    .await;

    Ok(xp_result)
}

#[tauri::command]
pub async fn delete_task(task_id: String, db: State<'_, DbPool>) -> Result<()> {
    sqlx::query("DELETE FROM tasks WHERE id=? AND user_id='default'")
        .bind(&task_id)
        .execute(&db.0)
        .await?;
    Ok(())
}

// ════════════════════════════════════════════════════════════════════════════
// GOALS
// ════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn list_goals(db: State<'_, DbPool>) -> Result<Value> {
    let rows = sqlx::query_as::<_, (String,String,Option<String>,i64,i64,Option<String>)>(
        "SELECT id,title,description,progress,total,target_date FROM goals WHERE user_id='default' ORDER BY created_at DESC LIMIT 20"
    ).fetch_all(&db.0).await?;
    Ok(json!(rows.iter().map(|(id,t,d,p,tot,dt)|
        json!({"id":id,"title":t,"description":d,"progress":p,"total":tot,"target_date":dt,"pct":(*p as f64/(*tot).max(1) as f64*100.0)})
    ).collect::<Vec<_>>()))
}

#[tauri::command]
pub async fn update_goal_progress(
    goal_id: String,
    progress: i64,
    db: State<'_, DbPool>,
) -> Result<Value> {
    sqlx::query("UPDATE goals SET progress=MIN(total,?) WHERE id=? AND user_id='default'")
        .bind(progress)
        .bind(&goal_id)
        .execute(&db.0)
        .await?;
    let (p, t): (i64, i64) = sqlx::query_as("SELECT progress,total FROM goals WHERE id=?")
        .bind(&goal_id)
        .fetch_one(&db.0)
        .await?;
    Ok(json!({"progress":p,"total":t,"pct":p as f64/t.max(1) as f64*100.0,"done":p>=t}))
}

// ════════════════════════════════════════════════════════════════════════════
// GRIND SESSIONS
// ════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn log_grind_session(
    platform: String,
    problems_solved: i64,
    duration_mins: i64,
    node_id: Option<String>,
    db: State<'_, DbPool>,
) -> Result<Value> {
    let id = Uuid::new_v4().to_string();
    let xp = (problems_solved * 50).min(500) + if duration_mins >= 60 { 100 } else { 0 };

    sqlx::query("INSERT INTO grind_sessions (id,user_id,platform,problems_solved,duration_mins,xp_reward,node_id) VALUES (?,?,?,?,?,?,?)")
        .bind(&id).bind("default").bind(&platform).bind(problems_solved).bind(duration_mins).bind(xp).bind(&node_id)
        .execute(&db.0).await?;

    let xp_result = award_xp(
        &db.0,
        "default",
        xp,
        &format!("{platform}: {problems_solved} problems"),
        "grind",
        1,
    )
    .await?;

    let _ = crate::sidecar::post("/plugins/fire", serde_json::json!({
        "hook": "on_grind_session_end",
        "payload": {"platform":platform,"problems_solved":problems_solved,"duration_mins":duration_mins,"xp":xp}
    })).await;

    Ok(json!({"session_id":id,"xp_result":xp_result}))
}

#[tauri::command]
pub async fn list_grind_sessions(db: State<'_, DbPool>) -> Result<Value> {
    let rows = sqlx::query_as::<_, (String,String,i64,i64,i64,String)>(
        "SELECT id,platform,problems_solved,duration_mins,xp_reward,created_at FROM grind_sessions WHERE user_id='default' ORDER BY created_at DESC LIMIT 50"
    ).fetch_all(&db.0).await?;
    Ok(json!(rows.iter().map(|(id,p,ps,dm,xp,ca)| json!({"id":id,"platform":p,"problems_solved":ps,"duration_mins":dm,"xp_reward":xp,"created_at":ca})).collect::<Vec<_>>()))
}

// ════════════════════════════════════════════════════════════════════════════
// PROJECTS
// ════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn list_projects(db: State<'_, DbPool>) -> Result<Value> {
    let rows = sqlx::query_as::<_, (String,String,Option<String>,String,i64,Option<String>)>(
        "SELECT id,title,description,status,xp_reward,repo_url FROM projects WHERE user_id='default' ORDER BY status, created_at DESC"
    ).fetch_all(&db.0).await?;
    Ok(json!(rows.iter().map(|(id,t,d,s,xp,r)| json!({"id":id,"title":t,"description":d,"status":s,"xp_reward":xp,"repo_url":r})).collect::<Vec<_>>()))
}

#[tauri::command]
pub async fn create_project(
    title: String,
    description: Option<String>,
    repo_url: Option<String>,
    db: State<'_, DbPool>,
) -> Result<Value> {
    let id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO projects (id,user_id,title,description,repo_url,status,xp_reward) VALUES (?,?,?,?,?,'backlog',400)")
        .bind(&id).bind("default").bind(&title).bind(&description).bind(&repo_url)
        .execute(&db.0).await?;
    Ok(json!({"id":id,"title":title}))
}

#[tauri::command]
pub async fn move_project(
    project_id: String,
    status: String,
    db: State<'_, DbPool>,
) -> Result<Value> {
    let valid = ["backlog", "active", "review", "done"];
    if !valid.contains(&status.as_str()) {
        return Err(NfError::Validation(format!("Invalid status: {status}")));
    }

    sqlx::query("UPDATE projects SET status=? WHERE id=? AND user_id='default'")
        .bind(&status)
        .bind(&project_id)
        .execute(&db.0)
        .await?;

    if status == "done" {
        let (title, xp): (String, i64) =
            sqlx::query_as("SELECT title,xp_reward FROM projects WHERE id=?")
                .bind(&project_id)
                .fetch_one(&db.0)
                .await?;
        let xp_result = award_xp(
            &db.0,
            "default",
            xp,
            &format!("Project: {title}"),
            "project",
            2,
        )
        .await?;
        return Ok(json!({"status":"done","xp_result":xp_result}));
    }
    Ok(json!({"status":status}))
}

#[tauri::command]
pub async fn delete_project(project_id: String, db: State<'_, DbPool>) -> Result<()> {
    sqlx::query("DELETE FROM projects WHERE id=? AND user_id='default'")
        .bind(&project_id)
        .execute(&db.0)
        .await?;
    Ok(())
}

// ════════════════════════════════════════════════════════════════════════════
// VITALS / SLEEP
// ════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn log_sleep(
    hours: f64,
    quality: i64,
    energy: i64,
    notes: Option<String>,
    db: State<'_, DbPool>,
) -> Result<Value> {
    let today = Utc::now().format("%Y-%m-%d").to_string();
    sqlx::query(
        "INSERT INTO sleep_logs (user_id,log_date,hours,quality,energy,notes) VALUES (?,?,?,?,?,?)
         ON CONFLICT(user_id,log_date) DO UPDATE SET hours=excluded.hours,quality=excluded.quality,energy=excluded.energy,notes=excluded.notes"
    ).bind("default").bind(&today).bind(hours).bind(quality).bind(energy).bind(&notes).execute(&db.0).await?;
    let xp_result = award_xp(&db.0, "default", 30, "Sleep log", "sleep", 0).await?;
    Ok(json!({"logged":true,"date":today,"xp_result":xp_result}))
}

#[tauri::command]
pub async fn list_sleep_logs(db: State<'_, DbPool>) -> Result<Value> {
    let rows = sqlx::query_as::<_, (String,f64,i64,i64,Option<String>)>(
        "SELECT log_date,hours,quality,energy,notes FROM sleep_logs WHERE user_id='default' ORDER BY log_date DESC LIMIT 30"
    ).fetch_all(&db.0).await?;
    Ok(json!(rows
        .iter()
        .map(|(d, h, q, e, n)| json!({"date":d,"hours":h,"quality":q,"energy":e,"notes":n}))
        .collect::<Vec<_>>()))
}

// ════════════════════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn list_activity(limit: Option<i64>, db: State<'_, DbPool>) -> Result<Value> {
    let lim = limit.unwrap_or(50);
    let rows = sqlx::query_as::<_, (String,String,i64,String)>(
        "SELECT entry_type,description,xp,created_at FROM activity_log WHERE user_id='default' ORDER BY created_at DESC LIMIT ?"
    ).bind(lim).fetch_all(&db.0).await?;
    Ok(json!(rows
        .iter()
        .map(|(t, d, xp, ca)| json!({"type":t,"description":d,"xp":xp,"created_at":ca}))
        .collect::<Vec<_>>()))
}

// ════════════════════════════════════════════════════════════════════════════
// VAULT / CONFIG
// ════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn set_vault_path(path: String, db: State<'_, DbPool>) -> Result<()> {
    sqlx::query("INSERT INTO config (key,value) VALUES ('vault_path',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
        .bind(&path).execute(&db.0).await?;
    Ok(())
}

#[tauri::command]
pub async fn list_vault_notes(db: State<'_, DbPool>) -> Result<Value> {
    let rows = sqlx::query_as::<_, (String,String,i64,String)>(
        "SELECT path,title,word_count,modified_at FROM vault_index ORDER BY modified_at DESC LIMIT 200"
    ).fetch_all(&db.0).await?;
    Ok(json!(rows
        .iter()
        .map(|(p, t, w, m)| json!({"path":p,"title":t,"word_count":w,"modified_at":m}))
        .collect::<Vec<_>>()))
}

#[tauri::command]
pub async fn read_vault_note(path: String) -> Result<String> {
    std::fs::read_to_string(&path).map_err(|e| NfError::Io(e.to_string()))
}

#[tauri::command]
pub async fn write_vault_note(path: String, content: String) -> Result<()> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, &content)?;
    Ok(())
}

#[tauri::command]
pub async fn get_config(key: String, db: State<'_, DbPool>) -> Result<Option<String>> {
    Ok(sqlx::query_scalar("SELECT value FROM config WHERE key=?")
        .bind(&key)
        .fetch_optional(&db.0)
        .await?)
}

#[tauri::command]
pub async fn set_config(key: String, value: String, db: State<'_, DbPool>) -> Result<()> {
    sqlx::query("INSERT INTO config (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
        .bind(&key).bind(&value).execute(&db.0).await?;
    Ok(())
}
