// ============================================================
// Neural Forge v1.0.0-beta — src/api.ts
// Unified typed wrappers for ALL Tauri 2.0 IPC commands.
// Tauri 2.0: import from @tauri-apps/api/core
// ============================================================

import { invoke } from "@tauri-apps/api/core";

// ════════════════════════════════════════════════════════════════════════════
// PHASE 1 — CORE GAME
// ════════════════════════════════════════════════════════════════════════════

export const api = {
  // User
  getUser: () => invoke<User>("get_user"),
  updateStreak: () => invoke<number>("update_streak"),

  // Skills
  getSkillLevels: () => invoke<SkillData>("get_skill_levels"),
  levelUpSkill: (node_id: string) => invoke<LevelUpResult>("level_up_skill", { node_id }),

  // Tasks
  listTasks: () => invoke<Task[]>("list_tasks"),
  createTask: (args: CreateTaskArgs) => invoke<{ id: string }>("create_task", args),
  completeTask: (task_id: string) => invoke<XpResult>("complete_task", { task_id }),
  deleteTask: (task_id: string) => invoke<void>("delete_task", { task_id }),

  // Goals
  listGoals: () => invoke<Goal[]>("list_goals"),
  updateGoalProgress: (goal_id: string, progress: number) => invoke<GoalProgress>("update_goal_progress", { goal_id, progress }),

  // Grind
  logGrindSession: (args: GrindArgs) => invoke<GrindResult>("log_grind_session", args),
  listGrindSessions: () => invoke<GrindSession[]>("list_grind_sessions"),

  // Projects
  listProjects: () => invoke<Project[]>("list_projects"),
  createProject: (args: ProjectArgs) => invoke<{ id: string }>("create_project", args),
  moveProject: (project_id: string, status: string) => invoke<void>("move_project", { project_id, status }),
  deleteProject: (project_id: string) => invoke<void>("delete_project", { project_id }),

  // Vitals
  logSleep: (args: SleepArgs) => invoke<SleepResult>("log_sleep", args),
  listSleepLogs: () => invoke<SleepLog[]>("list_sleep_logs"),
  listActivity: (limit?: number) => invoke<Activity[]>("list_activity", { limit }),

  // Vault
  setVaultPath: (path: string) => invoke<void>("set_vault_path", { path }),
  listVaultNotes: () => invoke<VaultNote[]>("list_vault_notes"),
  readVaultNote: (path: string) => invoke<string>("read_vault_note", { path }),
  writeVaultNote: (path: string, content: string) => invoke<void>("write_vault_note", { path, content }),
  getConfig: (key: string) => invoke<string | null>("get_config", { key }),
  setConfig: (key: string, value: string) => invoke<void>("set_config", { key, value }),

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 2 — INTELLIGENCE
  // ════════════════════════════════════════════════════════════════════════════

  // SR
  srGetDue: (limit?: number) => invoke<SrCard[]>("sr_get_due", { limit }),
  srGetAll: () => invoke<SrCard[]>("sr_get_all"),
  srCreateCard: (args: SrCardArgs) => invoke<SrCard>("sr_create_card", args),
  srSubmitReview: (card_id: string, quality: number) => invoke<SrReviewResult>("sr_submit_review", { card_id, quality }),
  srGetStats: () => invoke<SrStats>("sr_get_stats"),

  // Search
  searchVault: (query: string, top_k?: number) => invoke<SearchResult[]>("search_vault", { query, top_k }),
  searchRelated: (skill_id: string) => invoke<SearchResult[]>("search_related", { skill_id }),
  searchReindex: () => invoke<void>("search_reindex"),
  searchStats: () => invoke<SearchStats>("search_stats"),

  // LLM
  llmChat: (messages: ChatMsg[], model?: string, vault_context?: boolean) => invoke<LlmResponse>("llm_chat", { messages, model, vault_context }),
  llmPractice: (skill_id: string, difficulty?: string) => invoke<PracticeResult>("llm_practice", { skill_id, difficulty }),
  llmExplain: (concept: string, context?: string) => invoke<string>("llm_explain", { concept, context }),
  llmIngestPaper: (file_path: string, write_to_vault?: boolean) => invoke<PaperDigest>("llm_ingest_paper", { file_path, write_to_vault }),
  llmListModels: () => invoke<string[]>("llm_list_models"),

  // Analytics
  analyticsOverview: () => invoke<AnalyticsOverview>("analytics_overview"),
  analyticsSkillVelocity: () => invoke<SkillVelocity[]>("analytics_skill_velocity"),
  analyticsSleepCorrelation: () => invoke<SleepCorrelation>("analytics_sleep_correlation"),
  analyticsWeeklySnapshot: () => invoke<WeeklySnapshot>("analytics_weekly_snapshot"),

  // Sidecar
  sidecarStatus: () => invoke<{ alive: boolean }>("sidecar_status"),
  sidecarRestart: () => invoke<void>("sidecar_restart"),

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 3 — ECOSYSTEM
  // ════════════════════════════════════════════════════════════════════════════

  // Backup
  backupCommit: (message?: string) => invoke<BackupResult>("backup_commit", { message }),
  backupPush: () => invoke<void>("backup_push"),
  backupSetRemote: (url: string) => invoke<void>("backup_set_remote", { url }),
  backupLog: () => invoke<BackupLog[]>("backup_log"),
  backupStatus: () => invoke<GitStatus>("backup_status"),
  backupSnapshotDb: () => invoke<{ snapshot: string }>("backup_snapshot_db"),

  // Sync
  syncStatus: () => invoke<SyncStatus>("sync_status"),
  syncWriteNote: (path: string, content: string, force?: boolean) => invoke<void>("sync_write_note", { path, content, force }),
  syncConflicts: () => invoke<SyncConflict[]>("sync_conflicts"),
  syncResolve: (note_path: string, resolution: string) => invoke<void>("sync_resolve", { note_path, resolution }),
  syncReindexVault: () => invoke<{ reindexed: number }>("sync_reindex_vault"),

  // Graph
  graphData: () => invoke<GraphData>("graph_data"),
  graphStats: () => invoke<GraphStats>("graph_stats"),
  graphNeighbours: (node_id: string, depth?: number) => invoke<GraphData>("graph_neighbours", { node_id, depth }),
  graphRebuild: () => invoke<void>("graph_rebuild"),
  graphFindPath: (src: string, dst: string) => invoke<{ path: string[] }>("graph_find_path", { src, dst }),

  // Collab
  collabListRooms: () => invoke<Room[]>("collab_list_rooms"),
  collabCreateRoom: (name: string, topic?: string, room_id?: string) => invoke<Room>("collab_create_room", { name, topic, room_id }),
  collabDeleteRoom: (room_id: string) => invoke<void>("collab_delete_room", { room_id }),
  collabRoomMessages: (room_id: string) => invoke<RoomMessage[]>("collab_room_messages", { room_id }),

  // Plugins
  pluginsList: () => invoke<Plugin[]>("plugins_list"),
  pluginsToggle: (plugin_id: string, enabled: boolean) => invoke<void>("plugins_toggle", { plugin_id, enabled }),
  pluginsFireHook: (hook: string, payload?: object) => invoke<void>("plugins_fire_hook", { hook, payload }),
  pluginsGetConfig: (plugin_id: string) => invoke<object>("plugins_get_config", { plugin_id }),
  pluginsSetConfig: (plugin_id: string, config: object) => invoke<void>("plugins_set_config", { plugin_id, config }),
  pluginsEvents: () => invoke<PluginEvent[]>("plugins_events"),

  // Mobile keys
  mobileGenerateKey: (label?: string) => invoke<{ key: string }>("mobile_generate_key", { label }),
  mobileListKeys: () => invoke<MobileKey[]>("mobile_list_keys"),
  mobileRevokeKey: (key_id: string) => invoke<void>("mobile_revoke_key", { key_id }),
  syntthingStatus: (api_key?: string) => invoke<object>("syncthing_status", { api_key }),
};

// ════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════

export interface User { id: string; username: string; xp: number; level: number; sp: number; streak: number; active_paths: string; }
export interface SkillData { levels: Record<string, { level: number; xp_invested: number }>; nodes: SkillNode[]; }
export interface SkillNode { id: string; path_id: string; name: string; icon: string; description: string; canvas_x: number; canvas_y: number; prerequisites: string; }
export interface Task { id: string; title: string; description?: string; done: boolean; xp_reward: number; due_date?: string; skill_node_id?: string; }
export interface Goal { id: string; title: string; description?: string; progress: number; total: number; target_date?: string; pct: number; }
export interface GoalProgress { progress: number; total: number; pct: number; done: boolean; }
export interface XpResult { xp_gained: number; total_xp: number; new_level: number; leveled_up: boolean; sp_gained: number; total_sp: number; }
export interface LevelUpResult { node_id: string; new_level: number; xp_result: XpResult; }
export interface GrindSession { id: string; platform: string; problems_solved: number; duration_mins: number; xp_reward: number; created_at: string; }
export interface GrindResult { session_id: string; xp_result: XpResult; }
export interface Project { id: string; title: string; description?: string; status: string; xp_reward: number; repo_url?: string; }
export interface SleepLog { date: string; hours: number; quality: number; energy: number; notes?: string; }
export interface SleepResult { logged: boolean; date: string; xp_result: XpResult; }
export interface Activity { type: string; description: string; xp: number; created_at: string; }
export interface VaultNote { path: string; title: string; word_count: number; modified_at: string; }
export interface SrCard { id: string; node_id: string; path_id: string; front: string; back: string; interval: number; repetitions: number; ease_factor: number; due_date: string; }
export interface SrStats { total: number; due_today: number; reviews_today: number; avg_ease: number; }
export interface SrReviewResult { card_id: string; next_interval: number; next_due: string; }
export interface SearchResult { path: string; title: string; chunk: string; score: number; }
export interface SearchStats { indexed_chunks: number; last_built?: string; }
export interface ChatMsg { role: "user" | "assistant" | "system"; content: string; }
export interface LlmResponse { content: string; model: string; }
export interface PracticeResult { problem: string; hints: string[]; solution?: string; }
export interface PaperDigest { title: string; summary: string; key_concepts: string[]; vault_path?: string; }
export interface GraphData { nodes: GraphNode[]; links: GraphLink[]; }
export interface GraphNode { id: string; label: string; type: string; color: string; degree: number; }
export interface GraphLink { source: number; target: number; type: string; weight: number; }
export interface GraphStats { nodes: number; edges: number; density: number; components: number; }
export interface Room { room_id: string; name: string; topic: string; members: number; full: boolean; }
export interface RoomMessage { id: string; room_id: string; user_id: string; msg_type: string; content: string; created_at: string; }
export interface Plugin { id: string; name: string; version: string; enabled: boolean; hooks: string[]; }
export interface PluginEvent { plugin_id: string; hook: string; duration_ms: number; error?: string; fired_at: string; }
export interface MobileKey { id: string; label: string; last_used?: string; created_at: string; }
export interface BackupResult { status: string; message: string; commit_hash?: string; files_changed: number; }
export interface BackupLog { commit_hash?: string; message: string; date: string; }
export interface GitStatus { dirty: boolean; branch: string; has_remote: boolean; last_commit?: BackupLog; }
export interface SyncStatus { indexed_notes: number; pending_conflicts: number; last_backup?: string; }
export interface SyncConflict { id: string; note_path: string; local_hash: string; remote_hash: string; resolution: string; diff_preview?: string; }
export interface AnalyticsOverview { total_xp: number; level: number; streak: number; tasks_done: number; notes_indexed: number; sr_cards: number; }
export interface SkillVelocity { node_id: string; name: string; path_id: string; xp_delta: number; level: number; }
export interface SleepCorrelation { pearson_r: number; data_points: number; interpretation: string; }
export interface WeeklySnapshot { week_start: string; xp: number; tasks_done: number; grind_sessions: number; sr_reviews: number; }

// Arg types
export interface CreateTaskArgs { title: string; description?: string; xp_reward?: number; due_date?: string; skill_node_id?: string; }
export interface GrindArgs { platform: string; problems_solved: number; duration_mins: number; node_id?: string; }
export interface ProjectArgs { title: string; description?: string; repo_url?: string; }
export interface SleepArgs { hours: number; quality: number; energy: number; notes?: string; }
export interface SrCardArgs { node_id: string; path_id: string; front: string; back: string; }
