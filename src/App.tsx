// ============================================================
// Neural Forge v1.0.0-beta — src/App.tsx
// Unified application shell with all Phase 1+2+3 views.
// Tauri 2.0: uses @tauri-apps/api/core for invoke()
// ============================================================

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";

// ── Phase 1 components ────────────────────────────────────────────────────────
import Dashboard from "./components/Dashboard";
import Grind from "./components/Grind";
import Projects from "./components/Projects";
import Sidebar from "./components/Sidebar";
import Skills from "./components/Skills";
import Toast from "./components/Toast";
import Vault from "./components/Vault";
import Vitals from "./components/Vitals";
import { useGameState } from "./hooks/useGameState";

// ── Phase 2 views ─────────────────────────────────────────────────────────────
import AITutor from "./views/AITutor";
import Analytics from "./views/Analytics";
import SpacedRepetition from "./views/SpacedRepetition";

// ── Phase 3 views ─────────────────────────────────────────────────────────────
import KnowledgeGraph from "./views/KnowledgeGraph";
import PluginManager from "./views/PluginManager";
import Settings from "./views/Settings";
import StudyRoom from "./views/StudyRoom";
//import Settings       from "./views/Settings";
import Onboarding from "./views/Onboarding";

// ── Design tokens ─────────────────────────────────────────────────────────────
import { C, F } from "./tokens";

// ── Types ─────────────────────────────────────────────────────────────────────
export type View =
  | "dashboard" | "skills" | "grind" | "projects" | "vitals" | "vault"
  | "sr" | "ai" | "analytics"
  | "graph" | "rooms" | "plugins" | "settings" | "onboard";

// ── Sidecar status banner ─────────────────────────────────────────────────────
function SidecarBanner({ status }: { status: string }) {
  if (status === "ready" || status === "") return null;
  const col = status === "starting" ? C.gold : C.red;
  const msg = {
    starting: "Starting AI sidecar…",
    unhealthy: "AI sidecar unhealthy — restarting",
    crashed: "AI sidecar crashed — restarting",
    error: "AI sidecar failed — check Python/uv installation",
  }[status] ?? `Sidecar: ${status}`;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      background: `${col}18`, borderBottom: `1px solid ${col}44`, padding: "6px 20px",
      fontFamily: F.mono, fontSize: 11, color: col, textAlign: "center", letterSpacing: 1
    }}>
      {status === "starting" && "⟳ "}{msg}
    </div>
  );
}

// ── SR due count badge ────────────────────────────────────────────────────────
function useSrDueCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const load = () => invoke<{ length: number }>("sr_get_due", { limit: 50 })
      .then((r: any) => setCount(Array.isArray(r) ? r.length : 0))
      .catch(() => { });
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);
  return count;
}

// ── Root App ─── 
export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [toasts, setToasts] = useState<any[]>([]);
  const [sidecarStatus, setSidecarStatus] = useState("");
  const [showOnboard, setShowOnboard] = useState(false);
  const gameState = useGameState();
  const srDue = useSrDueCount();

  // Listen for sidecar status events from Rust
  useEffect(() => {
    const unlisten = listen<{ status: string }>("sidecar-status", (e) => {
      setSidecarStatus(e.payload.status);
      if (e.payload.status === "ready") {
        setTimeout(() => setSidecarStatus(""), 2000);
      }
    });
    return () => { unlisten.then(f => f()); };
  }, []);

  // Check first-run onboarding
  useEffect(() => {
    invoke<string | null>("get_config", { key: "onboarding_done" })
      .then(v => { if (!v) setShowOnboard(true); })
      .catch(() => { });
  }, []);

  const addToast = useCallback((msg: string, type = "info") => {
    const id = Date.now();
    setToasts(ts => [...ts, { id, msg, type }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 4000);
  }, []);

  const handleLevelUp = useCallback(() => {
    addToast("⭐ Level up! +3 SP awarded", "success");
  }, [addToast]);

  if (showOnboard) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh" }}>
        <Onboarding onComplete={() => {
          invoke("set_config", { key: "onboarding_done", value: "true" });
          setShowOnboard(false);
        }} />
      </div>
    );
  }




  const VIEWS: Record<View, JSX.Element> = {
    // Phase 1
    dashboard: (
      <Dashboard
        user={gameState.user}
        tasks={gameState.tasks}
        goals={gameState.goals}
        activity={gameState.activity}
        skillNodes={gameState.skillNodes}
        createTask={gameState.createTask}
        completeTask={gameState.completeTask}
        deleteTask={gameState.deleteTask}
        updateGoal={gameState.updateGoal}
      />
    ),
    skills: (
      <Skills
        user={gameState.user}
        skillNodes={gameState.skillNodes}
        loadSkillPath={gameState.loadSkillPath}
        levelUpSkill={gameState.levelUpSkill}
      />
    ),
    grind: (
      <Grind
        sessions={gameState.sessions}
        loadSessions={gameState.loadSessions}
        logSession={gameState.logSession}
      />
    ),
    projects: (
      <Projects
        projects={gameState.projects}
        createProject={gameState.createProject}
        moveProject={gameState.moveProject}
        deleteProject={gameState.deleteProject}
      />
    ),
    vitals: (
      <Vitals
        sleepLogs={gameState.sleepLogs}
        logSleep={gameState.logSleep}
      />
    ),
    vault: (
      <Vault
        vaultNotes={gameState.vaultNotes}
        setVaultPath={gameState.setVaultPath}
        readNote={gameState.readNote}
        writeNote={gameState.writeNote}
      />
    ),
    // Phase 2
    sr: <SpacedRepetition />,
    ai: <AITutor />,
    analytics: <Analytics />,
    // Phase 3
    graph: <KnowledgeGraph />,
    rooms: <StudyRoom />,
    plugins: <PluginManager />,
    settings: <Settings />,
    onboard: <Onboarding onComplete={() => setView("dashboard")} />,
  };

  // Show loading state while gameState initializes
  if (gameState.loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: C.bg }}>
        <div style={{ textAlign: "center", color: C.accent, fontFamily: F.mono }}>
          <div style={{ fontSize: 14, marginBottom: 20 }}>◌ Initializing Neural Forge...</div>
          <div style={{ fontSize: 11, color: C.text2 }}>Loading game state...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, overflow: "hidden", fontFamily: F.body }}>
      <SidecarBanner status={sidecarStatus} />
      <Sidebar
        currentView={view}
        onNavigate={setView}
        gameState={gameState}
        srDue={srDue}
      />
      <main style={{ flex: 1, overflowY: "auto", padding: "28px 32px", marginTop: sidecarStatus && sidecarStatus !== "ready" ? 32 : 0 }}>
        {VIEWS[view]}
      </main>
      <Toast toasts={toasts} />
    </div>
  );
}
