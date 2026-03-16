// ============================================================
// Neural Forge — src/hooks/useGameState.ts
// Central game state — loads from Tauri API, exposes actions.
// All views consume this single hook.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import type {
  Goal, GrindSession, Project,
  SleepLog,
  Task,
  User,
  VaultNote,
} from "../api";
import { api as apiObj } from "../api";

const api = apiObj as any;

// Types for missing API exports
type ActivityEntry = any;
type SkillNodeView = any;

// ── Toast system ──────────────────────────────────────────────────────────────
export type ToastType = "xp" | "levelup" | "skill" | "warn" | "info";
export interface Toast {
  id: number;
  msg: string;
  type: ToastType;
  dying: boolean;
}

// ── Full game state ───────────────────────────────────────────────────────────
export interface GameState {
  user: User | null;
  tasks: Task[];
  goals: Goal[];
  projects: Project[];
  sleepLogs: SleepLog[];
  activity: ActivityEntry[];
  vaultNotes: VaultNote[];
  skillNodes: Record<string, SkillNodeView[]>; // keyed by path id
  // grind sessions keyed by platform
  sessions: Record<string, GrindSession[]>;
  loading: boolean;
  toasts: Toast[];
}

// ── Hook return ───────────────────────────────────────────────────────────────
export interface UseGameState extends GameState {
  // notifications
  pushToast: (msg: string, type?: ToastType) => void;
  // user
  refreshUser: () => Promise<void>;
  // skills
  loadSkillPath: (path: string) => Promise<void>;
  levelUpSkill: (path: string, nodeId: string) => Promise<void>;
  // tasks
  createTask: (text: string, xp: number, cat: string) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  // goals
  updateGoal: (id: string, progress: number) => Promise<void>;
  // grind
  loadSessions: (platform: string) => Promise<void>;
  logSession: (s: { platform: string; topic: string; difficulty: string; xp_reward: number; notes?: string }) => Promise<void>;
  // projects
  createProject: (title: string, type: string) => Promise<void>;
  moveProject: (id: string, status: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  // vitals
  logSleep: (hours: number, quality: number, energy: number) => Promise<void>;
  // vault
  setVaultPath: (path: string) => Promise<void>;
  readNote: (path: string) => Promise<string>;
  writeNote: (path: string, content: string) => Promise<void>;
}

let toastCounter = 0;

// ─────────────────────────────────────────────────────────────────────────────
export function useGameState(): UseGameState {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [vaultNotes, setVaultNotes] = useState<VaultNote[]>([]);
  const [skillNodes, setSkillNodes] = useState<Record<string, SkillNodeView[]>>({});
  const [sessions, setSessions] = useState<Record<string, GrindSession[]>>({});
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const pushToast = useCallback((msg: string, type: ToastType = "xp") => {
    const id = ++toastCounter;
    setToasts(t => [...t, { id, msg, type, dying: false }]);
    // Mark dying after 2.4s (CSS animates out)
    setTimeout(() => setToasts(t => t.map(x => x.id === id ? { ...x, dying: true } : x)), 2400);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2900);
  }, []);

  // ── Handle XpResult ────────────────────────────────────────────────────────
  const handleXp = useCallback((res: any | null, action?: string) => {
    if (!res) return;
    if (res.leveled_up) {
      pushToast(`⬆ LEVEL UP → ${res.new_level}!  +3 SP`, "levelup");
    } else {
      pushToast(`+${res.xp_gained} XP${res.sp_gained > 0 ? `  +${res.sp_gained} SP` : ""}${action ? `  —  ${action}` : ""}`, "xp");
    }
    refreshUser();
    refreshActivity();
  }, []);

  // ── Loaders ────────────────────────────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    try { setUser(await api.getUser()); } catch { }
  }, []);

  const refreshActivity = useCallback(async () => {
    try { setActivity(await api.listActivity()); } catch { }
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const [u, t, g, p, sl, ac, vn] = await Promise.all([
          api.getUser(),
          api.listTasks(),
          api.listGoals(),
          api.listProjects(),
          api.listSleepLogs(),
          api.listActivity(),
          api.listVaultNotes(),
        ]);
        setUser(u);
        setTasks(t);
        setGoals(g);
        setProjects(p);
        setSleepLogs(sl);
        setActivity(ac);
        setVaultNotes(vn);

        // Preload MLE skill tree
        const mleNodes = await api.getSkillLevels("mle");
        setSkillNodes({ mle: mleNodes });

        // Update streak
        await api.updateStreak();
      } catch (e) {
        console.warn("API not available (dev mode without Tauri):", e);
      } finally {
        setLoading(false);
      }
    })();

    // Listen for vault file changes (if available)
    try {
      (api as any).onVaultUpdated?.(async () => {
        const notes = await api.listVaultNotes().catch(() => []);
        setVaultNotes(notes);
      });
    } catch { }
  }, []);

  // ── Skill actions ──────────────────────────────────────────────────────────
  const loadSkillPath = useCallback(async (path: string) => {
    if (skillNodes[path]) return;
    try {
      const data: any = await (api as any).getSkillLevels(path);

      console.log("RAW PAYLOAD FROM RUST:", data);

      const nodes = Array.isArray(data) ? data : (data?.nodes || []);
      setSkillNodes(p => ({ ...p, [path]: nodes }));

    } catch (e) {
      console.error("API fetch failed:", e);
    }
  }, [skillNodes]);


  const levelUpSkill = useCallback(async (path: string, nodeId: string) => {
    try {
      const res = await api.levelUpSkill(path, nodeId);
      const nodes = await api.getSkillLevels(path);
      setSkillNodes(p => ({ ...p, [path]: nodes }));
      handleXp(res, "Skill upgraded");
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes("sp")) pushToast("Not enough SP — keep grinding!", "warn");
      else if (msg.includes("maxed")) pushToast("Skill already mastered!", "info");
      else pushToast(msg, "warn");
    }
  }, [handleXp, pushToast]);

  // ── Task actions ───────────────────────────────────────────────────────────
  const createTask = useCallback(async (text: string, xp: number, cat: string) => {
    const t = await api.createTask({ text, xp_reward: xp, category: cat });
    setTasks(prev => [t, ...prev]);
  }, []);

  const completeTask = useCallback(async (id: string) => {
    const res = await api.completeTask(id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: true } : t));
    handleXp(res, "Quest completed");
  }, [handleXp]);

  const deleteTask = useCallback(async (id: string) => {
    await api.deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Goal actions ───────────────────────────────────────────────────────────
  const updateGoal = useCallback(async (id: string, progress: number) => {
    await api.updateGoalProgress(id, progress);
    setGoals(prev => prev.map(g => g.id === id ? { ...g, progress } : g));
  }, []);

  // ── Grind actions ──────────────────────────────────────────────────────────
  const loadSessions = useCallback(async (platform: string) => {
    const s = await api.listGrindSessions(platform);
    setSessions(prev => ({ ...prev, [platform]: s }));
  }, []);

  const logSession = useCallback(async (s: any) => {
    const res = await api.logGrindSession(s);
    const updated = await api.listGrindSessions(s.platform);
    setSessions(prev => ({ ...prev, [s.platform]: updated }));
    handleXp(res, s.topic);
  }, [handleXp]);

  // ── Project actions ────────────────────────────────────────────────────────
  const createProject = useCallback(async (title: string, type: string) => {
    const p = await api.createProject({ title, project_type: type });
    setProjects(prev => [p, ...prev]);
  }, []);

  const moveProject = useCallback(async (id: string, status: string) => {
    const res = await api.moveProject(id, status);
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status: status as any } : p));
    if (res) handleXp(res, "Project completed");
  }, [handleXp]);

  const deleteProject = useCallback(async (id: string) => {
    await api.deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  }, []);

  // ── Vitals actions ─────────────────────────────────────────────────────────
  const logSleep = useCallback(async (hours: number, quality: number, energy: number) => {
    const res = await api.logSleep({ hours, quality, energy });
    const logs = await api.listSleepLogs();
    setSleepLogs(logs);
    handleXp(res, "Vitals logged");
  }, [handleXp]);

  // ── Vault actions ──────────────────────────────────────────────────────────
  const setVaultPath = useCallback(async (path: string) => {
    await api.setVaultPath(path);
    pushToast("Vault connected!", "info");
    setTimeout(async () => {
      const notes = await api.listVaultNotes().catch(() => []);
      setVaultNotes(notes);
    }, 2000);
  }, [pushToast]);

  const readNote = useCallback((path: string) => api.readVaultNote(path), []);
  const writeNote = useCallback((path: string, content: string) => api.writeVaultNote(path, content), []);

  return {
    user, tasks, goals, projects, sleepLogs, activity,
    vaultNotes, skillNodes, sessions, loading, toasts,
    pushToast, refreshUser,
    loadSkillPath, levelUpSkill,
    createTask, completeTask, deleteTask,
    updateGoal,
    loadSessions, logSession,
    createProject, moveProject, deleteProject,
    logSleep,
    setVaultPath, readNote, writeNote,
  };
}
