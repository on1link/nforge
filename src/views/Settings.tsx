// ============================================================
// Neural Forge — src/components/Settings.tsx
// Settings hub: Git backup, Obsidian sync, plugins, appearance.
// ============================================================

import React, { useEffect, useState } from "react";
// 'invoke' ahora vive en el core
import { invoke } from "@tauri-apps/api/core";
// 'open' ahora es parte del plugin independiente de dialog
import { open } from "@tauri-apps/plugin-dialog";
import { C, F } from "../tokens";

const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI__;

type SettingsTab = "backup" | "sync" | "plugins" | "app";

export default function Settings() {
  const [tab, setTab] = useState<SettingsTab>("backup");

  const tabStyle = (id: SettingsTab) => ({
    padding: "9px 18px", borderRadius: 8,
    border: `1px solid ${tab === id ? C.gold : C.border}`,
    background: tab === id ? `${C.gold}18` : "transparent",
    color: tab === id ? C.gold : C.muted,
    cursor: "pointer", fontFamily: F.display, fontSize: 12,
    fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const,
    transition: "all 0.18s ease",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={{ fontFamily: F.mono, color: C.gold, fontSize: 10, letterSpacing: 4, marginBottom: 4 }}>// SETTINGS</div>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const, fontFamily: F.display }}>Settings</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["backup", "sync", "plugins", "app"] as SettingsTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>
            {t === "backup" ? "💾 Backup" : t === "sync" ? "📓 Obsidian" : t === "plugins" ? "🔌 Plugins" : "⚙ App"}
          </button>
        ))}
      </div>
      {tab === "backup" && <BackupTab />}
      {tab === "sync" && <SyncTab />}
      {tab === "plugins" && <PluginsTab />}
      {tab === "app" && <AppTab />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// BACKUP TAB
// ═════════════════════════════════════════════════════════════
function BackupTab() {
  const [result, setResult] = useState<any>(null);
  const [gitLog, setGitLog] = useState<string[]>([]);
  const [remote, setRemote] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [stStatus, setStStatus] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [backupLog, setBackupLog] = useState<any[]>([]);

  useEffect(() => {
    if (!isTauri) {
      setStStatus({ running: false, web_ui: "http://127.0.0.1:8384", hint: "Install from syncthing.net" });
      setBackupLog([
        { type: "git", status: "ok", message: "3 files committed at 2026-03-08 09:00", files: 3, at: "2026-03-08 09:00" },
        { type: "git", status: "clean", message: "Nothing to commit", files: 0, at: "2026-03-07 22:00" },
      ]);
      setGitLog(["a1b2c3|Auto-backup 2026-03-08|2 hours ago", "def456|Auto-backup 2026-03-07|yesterday"]);
      return;
    }
    invoke("syncthing_status").then(setStStatus).catch(() => { });
    invoke("backup_log").then((d: any) => setBackupLog(d ?? [])).catch(() => { });
    invoke("backup_git_log").then((d: any) => setGitLog(d ?? [])).catch(() => { });
  }, []);

  const commit = async () => {
    setSyncing(true);
    try {
      const r = isTauri ? await invoke<any>("backup_commit", { message: message || null }) : { status: "ok", files_changed: 5, message: "5 files committed", commit_hash: "abc123" };
      setResult(r);
      if (isTauri) invoke("backup_git_log").then((d: any) => setGitLog(d ?? [])).catch(() => { });
    } finally { setSyncing(false); }
  };

  const push = async () => {
    setSyncing(true);
    try {
      const msg = isTauri ? await invoke<string>("backup_push") : "Pushed to origin/main";
      setResult({ status: "ok", message: msg });
    } finally { setSyncing(false); }
  };

  const setRemoteUrl = async () => {
    if (!remote.trim()) return;
    try {
      if (isTauri) await invoke("backup_set_remote", { url: remote });
      setResult({ status: "ok", message: `Remote set to ${remote}` });
    } catch (e: any) { setResult({ status: "error", message: String(e) }); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Git backup panel */}
      <SectionCard title="Git Auto-Backup" col={C.green} icon="💾">
        <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted, lineHeight: 1.8, marginBottom: 16 }}>
          All data (SQLite DB + vault notes) is committed to a local git repo. Set a remote to push to GitHub/GitLab for off-device backup.
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <input value={message} onChange={e => setMessage(e.target.value)}
            style={{ flex: 1, minWidth: 180, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, padding: "9px 13px", color: C.text, fontFamily: F.body, fontSize: 13, outline: "none" }}
            placeholder="Commit message (optional)" />
          <button onClick={commit} disabled={syncing}
            style={btnStyle(C.green, syncing)}>
            {syncing ? "⏳…" : "💾 Commit"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <input value={remote} onChange={e => setRemote(e.target.value)}
            style={{ flex: 1, minWidth: 200, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, padding: "9px 13px", color: C.text, fontFamily: F.mono, fontSize: 12, outline: "none" }}
            placeholder="https://github.com/username/neural-forge-data.git" />
          <button onClick={setRemoteUrl}
            style={btnStyle(C.teal)}>
            Set Remote
          </button>
          <button onClick={push} disabled={syncing}
            style={btnStyle(C.accent, syncing)}>
            {syncing ? "⏳…" : "↑ Push"}
          </button>
        </div>

        {result && (
          <div style={{ padding: "10px 14px", borderRadius: 8, background: `${result.status === "ok" ? C.green : C.red}12`, border: `1px solid ${result.status === "ok" ? C.green : C.red}33`, fontFamily: F.mono, fontSize: 12, color: result.status === "ok" ? C.green : C.red, marginBottom: 12 }}>
            {result.status === "ok" ? "✓" : "✗"} {result.message}
            {result.commit_hash && <span style={{ color: C.muted, marginLeft: 8 }}>({result.commit_hash})</span>}
          </div>
        )}

        {/* Git log */}
        {gitLog.length > 0 && (
          <div>
            <div style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 8 }}>GIT LOG</div>
            {gitLog.slice(0, 8).map((line, i) => {
              const [hash, msg, time] = line.split("|");
              return (
                <div key={i} style={{ display: "flex", gap: 10, fontFamily: F.mono, fontSize: 11, color: C.muted, marginBottom: 5 }}>
                  <span style={{ color: C.gold }}>{hash}</span>
                  <span style={{ flex: 1, color: C.text2 }}>{msg}</span>
                  <span style={{ color: C.dim }}>{time}</span>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Syncthing */}
      <SectionCard title="Syncthing" col={C.teal} icon="🔄">
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, fontFamily: F.body, fontSize: 13, color: C.muted, lineHeight: 1.8 }}>
            {stStatus?.hint ?? "Checking…"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {stStatus?.running && (
              <button onClick={() => isTauri ? invoke("open_syncthing") : window.open("http://127.0.0.1:8384")}
                style={btnStyle(C.teal)}>Open Web UI</button>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: stStatus?.running ? C.green : C.red, boxShadow: `0 0 6px ${stStatus?.running ? C.green : C.red}` }} />
              <span style={{ fontFamily: F.mono, fontSize: 10, color: stStatus?.running ? C.green : C.red }}>
                {stStatus?.running ? "running" : "not running"}
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Backup history */}
      {backupLog.length > 0 && (
        <SectionCard title="Backup History" col={C.muted} icon="📋">
          {backupLog.map((entry, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontFamily: F.mono, fontSize: 11 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: entry.status === "ok" ? C.green : entry.status === "clean" ? C.muted : C.red, flexShrink: 0 }} />
              <span style={{ color: C.text2, flex: 1 }}>{entry.message}</span>
              {entry.files > 0 && <span style={{ color: C.gold }}>{entry.files} files</span>}
              <span style={{ color: C.dim }}>{entry.at?.slice(0, 16)}</span>
            </div>
          ))}
        </SectionCard>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// SYNC TAB (Obsidian)
// ═════════════════════════════════════════════════════════════
function SyncTab() {
  const [vaultPath, setVaultPath] = useState("");
  const [syncResult, setSyncResult] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [writing, setWriting] = useState(false);

  const pickVault = async () => {
    if (!isTauri) { setVaultPath("/home/user/vault"); return; }
    const sel = await (open as any)({ directory: true });
    if (typeof sel === "string") setVaultPath(sel);
  };

  const processQueue = async () => {
    setSyncing(true);
    try {
      const r = isTauri ? await invoke<any>("sync_process_queue") : { written: 2, skipped: 0, conflicts: 0, errors: [] };
      setSyncResult(r);
    } finally { setSyncing(false); }
  };

  const writeDailyReview = async () => {
    setWriting(true);
    try {
      const path = isTauri
        ? await invoke<string>("sync_write_daily_review", { xp_gained: 120, tasks_done: 4, skills_used: ["PyTorch", "NumPy"] })
        : "/vault/NeuralForge/DailyReviews/2026-03-08.md";
      setSyncResult({ written: 1, skipped: 0, conflicts: 0, errors: [], path });
    } finally { setWriting(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionCard title="Vault Connection" col={C.teal} icon="📓">
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <input style={{ flex: 1, background: C.surface2, border: `1px solid ${vaultPath ? C.teal + "55" : C.border}`, borderRadius: 7, padding: "9px 13px", color: C.text, fontFamily: F.mono, fontSize: 13, outline: "none" }}
            placeholder="/home/user/vault" value={vaultPath} onChange={e => setVaultPath(e.target.value)} />
          <button onClick={pickVault} style={btnStyle(C.teal)}>📂 Browse</button>
        </div>
      </SectionCard>

      <SectionCard title="Bidirectional Sync" col={C.accent} icon="↔">
        <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted, lineHeight: 1.8, marginBottom: 16 }}>
          Neural Forge writes structured notes to your vault automatically when you:<br />
          • Level up a skill → creates <code style={{ color: C.teal }}>Skills/SkillName.md</code><br />
          • Complete a project → creates <code style={{ color: C.teal }}>Projects/ProjectName.md</code><br />
          • End a session → creates <code style={{ color: C.teal }}>DailyReviews/YYYY-MM-DD.md</code>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={processQueue} disabled={syncing} style={btnStyle(C.accent, syncing)}>
            {syncing ? "⏳ Syncing…" : "↻ Process Queue"}
          </button>
          <button onClick={writeDailyReview} disabled={writing} style={btnStyle(C.gold, writing)}>
            {writing ? "⏳…" : "📅 Write Today's Review"}
          </button>
        </div>
        {syncResult && (
          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: `${C.green}0d`, border: `1px solid ${C.green}22`, fontFamily: F.mono, fontSize: 11, color: C.text2, lineHeight: 1.8 }}>
            ✓ written:{syncResult.written} skipped:{syncResult.skipped} conflicts:{syncResult.conflicts}
            {syncResult.path && <div style={{ color: C.teal, marginTop: 4 }}>{syncResult.path}</div>}
            {syncResult.errors?.map((e: string, i: number) => <div key={i} style={{ color: C.red }}>✗ {e}</div>)}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Conflict Resolution" col={C.gold} icon="⚠">
        <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted, lineHeight: 1.8 }}>
          If NF detects that a file has been manually edited (no <code style={{ color: C.gold }}>neural-forge-managed</code> marker), it creates a conflict copy with a timestamp suffix before overwriting. Conflict copies appear in the same folder as the original.
        </div>
      </SectionCard>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// PLUGINS TAB
// ═════════════════════════════════════════════════════════════
function PluginsTab() {
  const [plugins, setPlugins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const ps = isTauri ? await invoke<any>("list_plugins") : MOCK_PLUGINS;
        setPlugins(Array.isArray(ps) ? ps : []);
      } catch { setPlugins(MOCK_PLUGINS); }
      setLoading(false);
    };
    load();
  }, []);

  const toggle = async (id: string, current: boolean) => {
    try {
      if (isTauri) await invoke("toggle_plugin", { id, enabled: !current });
      setPlugins(ps => ps.map(p => p.id === id ? { ...p, enabled: !current } : p));
    } catch { }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionCard title="Installed Plugins" col={C.purple} icon="🔌">
        <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted, lineHeight: 1.8, marginBottom: 16 }}>
          Plugins live in <code style={{ color: C.purple }}>~/.local/share/neural-forge/plugins/</code>. Each plugin has a <code>plugin.json</code> manifest and a bundled JS entry point.
        </div>
        {loading && <div style={{ fontFamily: F.mono, color: C.muted, animation: "nf-pulse 1s ease-in-out infinite" }}>Loading plugins…</div>}
        {!loading && plugins.length === 0 && (
          <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted }}>No plugins installed. Drop a plugin folder into the plugins directory.</div>
        )}
        {plugins.map(p => (
          <div key={p.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderRadius: 10, background: p.enabled ? `${C.purple}08` : C.surface2, border: `1px solid ${p.enabled ? C.purple + "33" : C.border}`, marginBottom: 8 }}>
            <div style={{ fontSize: 24, flexShrink: 0 }}>{p.sidebar_icon ?? "🔌"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700, color: p.enabled ? C.purple : C.muted, letterSpacing: 1 }}>{p.name}</span>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: C.dim }}>v{p.version}</span>
              </div>
              <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted, lineHeight: 1.7, marginBottom: 8 }}>{p.description}</div>
              {p.hooks?.length > 0 && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {p.hooks.map((h: string) => (
                    <span key={h} style={{ padding: "1px 7px", borderRadius: 4, background: `${C.purple}14`, color: C.purple, fontFamily: F.mono, fontSize: 9 }}>{h}</span>
                  ))}
                </div>
              )}
            </div>
            <label style={{ cursor: "pointer", flexShrink: 0 }}>
              <input type="checkbox" checked={p.enabled} onChange={() => toggle(p.id, p.enabled)}
                style={{ width: 16, height: 16, accentColor: C.purple, cursor: "pointer" }} />
            </label>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="Create a Plugin" col={C.teal} icon="📦">
        <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted, lineHeight: 1.9 }}>
          Create a folder in <code style={{ color: C.teal }}>plugins/my-plugin/</code> with:<br />
          • <code>plugin.json</code> — manifest (id, name, version, entry, hooks, permissions)<br />
          • <code>index.js</code> — bundled JavaScript (access NF APIs via <code>window.NeuralForge</code>)<br /><br />
          Available hooks: <code style={{ color: C.gold }}>on_xp_gain · on_skill_level_up · on_task_complete · on_session_start · on_session_end</code><br />
          Available APIs: <code style={{ color: C.gold }}>awardXp · getStats · registerPlugin · showToast</code>
        </div>
      </SectionCard>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// APP TAB
// ═════════════════════════════════════════════════════════════
function AppTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionCard title="About" col={C.accent} icon="⬡">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[
            { l: "Version", v: "0.3.0 Gamma" },
            { l: "Build", v: new Date().getFullYear().toString() },
            { l: "Runtime", v: "Tauri 1.6 + Rust" },
            { l: "UI", v: "React + TypeScript" },
            { l: "AI", v: "Ollama (local)" },
          ].map(({ l, v }) => (
            <div key={l}>
              <div style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 2, textTransform: "uppercase" }}>{l}</div>
              <div style={{ fontFamily: F.mono, fontSize: 13, color: C.accent, marginTop: 3 }}>{v}</div>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Data Location" col={C.gold} icon="📁">
        <div style={{ fontFamily: F.mono, fontSize: 12, color: C.muted, lineHeight: 2 }}>
          <div>DB: <span style={{ color: C.gold }}>~/.local/share/neural-forge/neural_forge.db</span></div>
          <div>FAISS: <span style={{ color: C.gold }}>~/.local/share/neural-forge/faiss.index</span></div>
          <div>Plugins: <span style={{ color: C.gold }}>~/.local/share/neural-forge/plugins/</span></div>
          <div>Git repo: <span style={{ color: C.gold }}>~/.local/share/neural-forge/</span></div>
        </div>
      </SectionCard>
      <SectionCard title="Keyboard Shortcuts" col={C.purple} icon="⌨">
        {[
          ["Ctrl+1–9", "Navigate views"],
          ["Ctrl+S", "Commit backup"],
          ["Ctrl+K", "Open knowledge graph"],
          ["Space", "Reveal SR flashcard"],
          ["1–6", "Rate SR card quality"],
          ["Ctrl+⇧+R", "Rebuild knowledge graph"],
          ["Ctrl+⇧+S", "Force vault sync"],
          ["Esc", "Close panels / modals"],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border}`, fontFamily: F.mono, fontSize: 12 }}>
            <span style={{ color: C.purple }}>{k}</span>
            <span style={{ color: C.muted }}>{v}</span>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function SectionCard({ title, col, icon, children }: { title: string; col: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: `linear-gradient(135deg,${C.surface},${col}08)`, border: `1px solid ${col}22`, borderRadius: 12, padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${col}22` }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 700, color: col, letterSpacing: 2, textTransform: "uppercase" as const }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

const btnStyle = (col: string, disabled?: boolean): React.CSSProperties => ({
  background: `${col}1a`, border: `1px solid ${col}55`, color: col, padding: "9px 18px", borderRadius: 7,
  cursor: disabled ? "not-allowed" : "pointer", fontFamily: F.display, fontSize: 12, fontWeight: 700,
  letterSpacing: 1, opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap" as const, transition: "all 0.18s ease",
});

const MOCK_PLUGINS = [
  { id: "pomodoro-timer", name: "Pomodoro Timer", version: "1.0.0", description: "25-min focus sessions that award XP on completion.", sidebar: true, sidebar_icon: "🍅", enabled: true, hooks: ["on_session_start", "on_session_end"] },
  { id: "streak-guard", name: "Streak Guard", version: "0.9.0", description: "Sends a system notification if you miss a daily review.", sidebar: false, enabled: false, hooks: ["on_streak_break"] },
];
