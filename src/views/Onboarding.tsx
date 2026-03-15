// ============================================================
// Neural Forge — src/components/Onboarding.tsx
// First-run wizard — 5 steps:
// 0: Welcome splash
// 1: Vault path setup
// 2: Ollama check
// 3: Choose primary skill path
// 4: Complete / launch
// ============================================================

import React, { useEffect, useState } from "react";
// 'invoke' ahora vive en el core
import { invoke } from "@tauri-apps/api/core";
// 'open' ahora es parte del plugin independiente de dialog
import { open } from "@tauri-apps/plugin-dialog";
import { C, F } from "../tokens";

const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI__;

interface OnboardingProps {
  onComplete: (pathChosen: string) => void;
}

const PATHS = [
  {
    id: "mle",
    icon: "🔥",
    title: "Machine Learning Engineering",
    desc: "PyTorch, neural networks, MLOps, transformers, CUDA. Build and deploy ML models end-to-end.",
    col: C.mle,
    skills: ["Python", "PyTorch", "Neural Nets", "MLOps", "Transformers", "CUDA"],
  },
  {
    id: "de",
    icon: "⚡",
    title: "Data Engineering",
    desc: "SQL, Spark, dbt, Kafka, Airflow. Build reliable data pipelines and lakehouses.",
    col: C.de,
    skills: ["SQL", "Spark", "Airflow", "Kafka", "dbt", "Databricks"],
  },
  {
    id: "ds",
    icon: "📊",
    title: "Data Science",
    desc: "Statistics, scikit-learn, A/B testing, gradient boosting. Turn data into decisions.",
    col: C.ds,
    skills: ["Statistics", "Scikit-learn", "Feature Eng.", "A/B Testing", "Gradient Boost", "Clustering"],
  },
];

const STEP_LABELS = ["Welcome", "Vault", "Ollama", "Your Path", "Ready!"];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [vaultPath, setVaultPath] = useState("");
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [pathChosen, setPathChosen] = useState("mle");
  const [launching, setLaunching] = useState(false);
  const [particles, setParticles] = useState<any[]>([]);

  // Launch particles on welcome screen
  useEffect(() => {
    if (step === 0) {
      setParticles(Array.from({ length: 30 }, (_, i) => ({
        id: i, x: Math.random() * 100, y: Math.random() * 100,
        size: Math.random() * 3 + 1, speed: Math.random() * 20 + 10,
        col: [C.accent, C.gold, C.purple, C.green][Math.floor(Math.random() * 4)],
        delay: Math.random() * 5,
      })));
    }
  }, [step]);

  const pickVault = async () => {
    if (!isTauri) {
      setVaultPath("/home/user/vault"); return;
    }
    const selected = await open({ directory: true, title: "Select Obsidian Vault Folder" });
    if (typeof selected === "string") setVaultPath(selected);
  };

  const checkOllama = async () => {
    setChecking(true);
    try {
      const ok = isTauri
        ? await invoke<boolean>("onboarding_check_ollama")
        : await fetch("http://localhost:11434/api/tags").then(r => r.ok).catch(() => false);
      setOllamaOk(ok);
    } catch { setOllamaOk(false); }
    setChecking(false);
  };

  const advance = async () => {
    if (!isTauri) { if (step < 4) setStep(s => s + 1); else handleComplete(); return; }
    await invoke("onboarding_advance", {
      step: step + 1,
      vault_path: step === 1 && vaultPath ? vaultPath : null,
      path_chosen: step === 3 ? pathChosen : null,
    }).catch(() => { });
    if (step < 4) setStep(s => s + 1);
    else handleComplete();
  };

  const handleComplete = async () => {
    setLaunching(true);
    await new Promise(r => setTimeout(r, 1400));
    onComplete(pathChosen);
  };

  const canAdvance = () => {
    if (step === 1) return true; // vault is optional
    if (step === 2) return ollamaOk !== null;
    return true;
  };

  const bgCol = [C.accent, C.teal, C.purple, C.gold, C.green][step] ?? C.accent;
  const selPath = PATHS.find(p => p.id === pathChosen)!;

  return (
    <div style={{
      position: "fixed", inset: 0, background: C.bg, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: F.body,
    }}>
      {/* Animated background */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {particles.map(p => (
          <div key={p.id} style={{
            position: "absolute", left: `${p.x}%`, top: `${p.y}%`,
            width: p.size, height: p.size, borderRadius: "50%",
            background: p.col, opacity: 0.35,
            animation: `float ${p.speed}s ease-in-out ${p.delay}s infinite alternate`,
            boxShadow: `0 0 ${p.size * 2}px ${p.col}`,
          }} />
        ))}
        {/* Grid */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.03,
          backgroundImage: `repeating-linear-gradient(0deg,${bgCol} 0,${bgCol} 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,${bgCol} 0,${bgCol} 1px,transparent 1px,transparent 40px)`,
          transition: "all 0.6s ease"
        }} />
        {/* Radial glow */}
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          width: 800, height: 800, borderRadius: "50%",
          background: `radial-gradient(circle,${bgCol}08 0%,transparent 70%)`,
          transition: "background 0.6s ease"
        }} />
      </div>

      {/* Step indicator */}
      <div style={{ position: "absolute", top: 40, display: "flex", gap: 8, alignItems: "center" }}>
        {STEP_LABELS.map((label, i) => (
          <React.Fragment key={i}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: i < step ? `${C.green}33` : i === step ? `${bgCol}33` : C.surface,
                border: `2px solid ${i < step ? C.green : i === step ? bgCol : C.border}`,
                fontFamily: F.mono, fontSize: 12, fontWeight: 700,
                color: i < step ? C.green : i === step ? bgCol : C.muted,
                transition: "all 0.4s ease",
              }}>
                {i < step ? "✓" : i + 1}
              </div>
              <div style={{ fontFamily: F.display, fontSize: 8, color: i === step ? bgCol : C.muted, letterSpacing: 1, textTransform: "uppercase" }}>
                {label}
              </div>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div style={{ width: 40, height: 2, background: i < step ? C.green : C.border, marginBottom: 18, transition: "all 0.4s ease" }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Content card */}
      <div style={{
        position: "relative", zIndex: 1, width: "100%", maxWidth: 640,
        background: `linear-gradient(135deg,${C.surface},${bgCol}08)`,
        border: `1px solid ${bgCol}33`, borderRadius: 20,
        padding: "48px 52px", boxShadow: `0 0 80px ${bgCol}15, 0 40px 80px rgba(0,0,0,0.4)`,
        animation: "nf-fadein 0.35s ease",
      }}>

        {/* ── STEP 0: WELCOME ──────────────────────────────────────────────── */}
        {step === 0 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 20, animation: "nf-bounce 2s ease infinite" }}>⬡</div>
            <div style={{ fontFamily: F.display, fontSize: 38, fontWeight: 700, letterSpacing: 5, color: C.accent, marginBottom: 4 }}>
              NEURAL FORGE
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 12, color: C.gold, letterSpacing: 4, marginBottom: 32 }}>
              GAMMA  v0.3.0
            </div>
            <div style={{ fontFamily: F.body, fontSize: 15, color: C.text2, lineHeight: 1.9, marginBottom: 36 }}>
              Your gamified ML learning OS.<br />
              Skill trees · Spaced repetition · AI tutor · Knowledge graphs.<br />
              <span style={{ color: C.accent }}>Built to outcompete distraction</span>, one commit at a time.
            </div>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 36 }}>
              {[
                { icon: "🧠", label: "SM-2 Flashcards" },
                { icon: "💬", label: "Local AI Tutor" },
                { icon: "🌐", label: "Knowledge Graph" },
                { icon: "📓", label: "Obsidian Sync" },
              ].map(({ icon, label }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
                  <div style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 1: VAULT ────────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div style={{ fontFamily: F.mono, color: C.teal, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>
              STEP 1 OF 4
            </div>
            <div style={{ fontFamily: F.display, fontSize: 28, fontWeight: 700, letterSpacing: 3, color: C.text, marginBottom: 8 }}>
              Connect Obsidian Vault
            </div>
            <div style={{ fontFamily: F.body, fontSize: 14, color: C.muted, lineHeight: 1.8, marginBottom: 28 }}>
              Neural Forge syncs bidirectionally with your Obsidian vault — skill notes, project logs, and daily reviews are written automatically.
              <br /><br />
              <span style={{ color: C.teal }}>Optional</span> — you can skip and configure later in Settings.
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <input
                style={{ flex: 1, background: C.surface2, border: `1px solid ${vaultPath ? C.teal + "66" : C.border}`, borderRadius: 8, padding: "12px 16px", color: C.text, fontFamily: F.mono, fontSize: 13, outline: "none" }}
                placeholder="/home/user/vault  or  ~/Documents/vault"
                value={vaultPath}
                onChange={e => setVaultPath(e.target.value)}
              />
              <button onClick={pickVault}
                style={{ background: `${C.teal}1a`, border: `1px solid ${C.teal}55`, color: C.teal, padding: "12px 18px", borderRadius: 8, cursor: "pointer", fontFamily: F.display, fontSize: 12, fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap" }}>
                📂 Browse
              </button>
            </div>

            {vaultPath && (
              <div style={{ fontFamily: F.mono, fontSize: 11, color: C.teal, marginBottom: 16 }}>
                ✓ {vaultPath}
              </div>
            )}

            <div style={{ fontFamily: F.body, fontSize: 12, color: C.dim, marginTop: 8 }}>
              NF will create a <code style={{ color: C.teal }}>NeuralForge/</code> folder in your vault. Existing notes are never modified without your permission.
            </div>
          </div>
        )}

        {/* ── STEP 2: OLLAMA ───────────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <div style={{ fontFamily: F.mono, color: C.purple, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>
              STEP 2 OF 4
            </div>
            <div style={{ fontFamily: F.display, fontSize: 28, fontWeight: 700, letterSpacing: 3, color: C.text, marginBottom: 8 }}>
              Local AI Setup
            </div>
            <div style={{ fontFamily: F.body, fontSize: 14, color: C.muted, lineHeight: 1.8, marginBottom: 24 }}>
              Neural Forge uses <span style={{ color: C.purple }}>Ollama</span> to run LLMs 100% locally — no API key, no cloud, your data stays on your machine.
            </div>

            {/* Ollama status */}
            <div style={{
              padding: "20px 24px", borderRadius: 12, marginBottom: 20,
              background: ollamaOk === null ? C.surface2 : ollamaOk ? `${C.green}12` : `${C.red}12`,
              border: `1px solid ${ollamaOk === null ? C.border : ollamaOk ? C.green + "44" : C.red + "44"}`,
            }}>
              {ollamaOk === null && (
                <div style={{ fontFamily: F.body, fontSize: 14, color: C.muted }}>
                  Click "Check Ollama" to verify the connection.
                </div>
              )}
              {ollamaOk === true && (
                <div>
                  <div style={{ fontFamily: F.display, fontSize: 15, color: C.green, fontWeight: 700, marginBottom: 8 }}>
                    ✓ Ollama is running
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 12, color: C.muted }}>
                    AI Tutor, practice problems, and paper digests are ready to use.
                  </div>
                </div>
              )}
              {ollamaOk === false && (
                <div>
                  <div style={{ fontFamily: F.display, fontSize: 15, color: C.red, fontWeight: 700, marginBottom: 12 }}>
                    ✗ Ollama not detected
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, lineHeight: 2 }}>
                    <div>1. Install: <a href="https://ollama.com" style={{ color: C.accent }}>ollama.com</a></div>
                    <div>2. Pull a model: <code style={{ background: C.surface, padding: "2px 6px", borderRadius: 4, color: C.gold }}>ollama pull llama3</code></div>
                    <div>3. Start: <code style={{ background: C.surface, padding: "2px 6px", borderRadius: 4, color: C.gold }}>ollama serve</code></div>
                  </div>
                  <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 10 }}>
                    You can skip this and set it up later — the AI Tutor just won't work until Ollama is running.
                  </div>
                </div>
              )}
            </div>

            <button onClick={checkOllama} disabled={checking}
              style={{ background: `${C.purple}1a`, border: `1px solid ${C.purple}55`, color: C.purple, padding: "11px 22px", borderRadius: 8, cursor: "pointer", fontFamily: F.display, fontSize: 13, fontWeight: 700, letterSpacing: 1, opacity: checking ? 0.6 : 1 }}>
              {checking ? "⏳ Checking…" : "⚡ Check Ollama"}
            </button>
          </div>
        )}

        {/* ── STEP 3: CHOOSE PATH ──────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <div style={{ fontFamily: F.mono, color: C.gold, fontSize: 11, letterSpacing: 3, marginBottom: 12 }}>
              STEP 3 OF 4
            </div>
            <div style={{ fontFamily: F.display, fontSize: 28, fontWeight: 700, letterSpacing: 3, color: C.text, marginBottom: 8 }}>
              Choose Your Path
            </div>
            <div style={{ fontFamily: F.body, fontSize: 14, color: C.muted, lineHeight: 1.7, marginBottom: 24 }}>
              This unlocks your primary skill tree. You can add other paths later — all three share core skills like Python, Git, and Statistics.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {PATHS.map(path => (
                <button key={path.id} onClick={() => setPathChosen(path.id)}
                  style={{
                    background: pathChosen === path.id ? `${path.col}18` : C.surface2,
                    border: `2px solid ${pathChosen === path.id ? path.col : C.border}`,
                    borderRadius: 12, padding: "16px 20px", cursor: "pointer", textAlign: "left",
                    transition: "all 0.2s ease",
                    boxShadow: pathChosen === path.id ? `0 0 20px ${path.col}20` : "none",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                    <span style={{ fontSize: 28 }}>{path.icon}</span>
                    <div>
                      <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 700, color: pathChosen === path.id ? path.col : C.text, letterSpacing: 1.5 }}>
                        {path.title}
                      </div>
                      <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 3 }}>
                        {path.desc}
                      </div>
                    </div>
                    {pathChosen === path.id && (
                      <div style={{ marginLeft: "auto", width: 24, height: 24, borderRadius: "50%", background: `${path.col}22`, border: `2px solid ${path.col}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.mono, fontSize: 12, color: path.col, flexShrink: 0 }}>✓</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {path.skills.map(s => (
                      <span key={s} style={{ padding: "2px 8px", borderRadius: 4, background: `${path.col}15`, color: path.col, fontFamily: F.display, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{s}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 4: LAUNCH ───────────────────────────────────────────────── */}
        {step === 4 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 60, marginBottom: 20 }}>🚀</div>
            <div style={{ fontFamily: F.display, fontSize: 32, fontWeight: 700, letterSpacing: 4, color: C.green, marginBottom: 8 }}>
              YOU'RE READY
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 12, color: C.muted, letterSpacing: 3, marginBottom: 28 }}>
              NEURAL FORGE v0.3.0 GAMMA
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
              {[
                { icon: "⬡", label: "Skill Tree", col: C.accent, note: selPath.title },
                { icon: "🧠", label: "SR Cards", col: C.purple, note: "Due daily" },
                { icon: vaultPath ? "✓" : "○", label: "Obsidian", col: vaultPath ? C.green : C.muted, note: vaultPath ? "Connected" : "Not configured" },
                { icon: ollamaOk ? "✓" : "○", label: "AI Tutor", col: ollamaOk ? C.green : C.muted, note: ollamaOk ? "Ollama ready" : "Set up later" },
              ].map(({ icon, label, col, note }) => (
                <div key={label} style={{ background: `${col}0d`, border: `1px solid ${col}22`, borderRadius: 10, padding: "14px 16px", textAlign: "left" }}>
                  <div style={{ fontFamily: F.mono, fontSize: 18, color: col, fontWeight: 700 }}>{icon}</div>
                  <div style={{ fontFamily: F.display, fontSize: 12, fontWeight: 700, color: col, marginTop: 4 }}>{label}</div>
                  <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, marginTop: 2 }}>{note}</div>
                </div>
              ))}
            </div>
            <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted, lineHeight: 1.8, marginBottom: 24 }}>
              Level up your skills. Build every day.<br />
              The compound effect of 1% better each session is unstoppable.
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: "flex", gap: 12, justifyContent: "space-between", marginTop: 32 }}>
          {step > 0 && step < 4 && (
            <button onClick={() => setStep(s => s - 1)}
              style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, padding: "12px 24px", borderRadius: 9, cursor: "pointer", fontFamily: F.display, fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
              ← Back
            </button>
          )}
          {step < 4 && (
            <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
              {(step === 1 || step === 2) && (
                <button onClick={advance}
                  style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, padding: "12px 22px", borderRadius: 9, cursor: "pointer", fontFamily: F.display, fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>
                  Skip →
                </button>
              )}
              <button onClick={advance} disabled={!canAdvance()}
                style={{ background: `${bgCol}22`, border: `2px solid ${bgCol}66`, color: bgCol, padding: "13px 32px", borderRadius: 10, cursor: "pointer", fontFamily: F.display, fontSize: 14, fontWeight: 700, letterSpacing: 2, opacity: !canAdvance() ? 0.4 : 1, transition: "all 0.2s ease", boxShadow: `0 0 20px ${bgCol}22` }}>
                {step === 3 ? "Lock In →" : "Continue →"}
              </button>
            </div>
          )}
          {step === 4 && (
            <button onClick={handleComplete} disabled={launching}
              style={{ width: "100%", background: `${C.green}22`, border: `2px solid ${C.green}66`, color: C.green, padding: "16px", borderRadius: 12, cursor: "pointer", fontFamily: F.display, fontSize: 16, fontWeight: 700, letterSpacing: 3, boxShadow: `0 0 30px ${C.green}22`, opacity: launching ? 0.7 : 1, animation: launching ? "nf-pulse 0.5s ease-in-out infinite" : "none" }}>
              {launching ? "INITIALISING…" : "⚡ LAUNCH NEURAL FORGE"}
            </button>
          )}
        </div>
      </div>

      {/* Version stamp */}
      <div style={{ position: "absolute", bottom: 24, fontFamily: F.mono, fontSize: 9, color: C.dim, letterSpacing: 2 }}>
        NEURAL FORGE GAMMA v0.3.0 · BUILD {new Date().getFullYear()}
      </div>

      <style>{`
        @keyframes float { from { transform: translateY(0) scale(1); } to { transform: translateY(-20px) scale(1.1); } }
        @keyframes nf-fadein { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
        @keyframes nf-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes nf-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
      `}</style>
    </div>
  );
}
