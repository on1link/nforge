// ============================================================
// Neural Forge — src/components/Dashboard.tsx
// Command Center — HUD, quests, goals, path mastery, activity
// ============================================================

import React, { useState } from "react";
import { C, F, card, glassCard, btn, dangerBtn, tag, bar, fill, label, h1, h2, h3, row, grid, col_, mono } from "../tokens";
import type { UseGameState } from "../hooks/useGameState";

const XP_PER_LVL = 1000;
const PATH_META: Record<string, { col: string; icon: string; label: string }> = {
  mle: { col: C.mle, icon: "⚡", label: "ML Engineer" },
  de:  { col: C.de,  icon: "🗄", label: "Data Engineer" },
  ds:  { col: C.ds,  icon: "📊", label: "Data Scientist" },
};

const OAKLEY = [
  "Spaced repetition: review material at increasing intervals for deep retention.",
  "Pomodoro: 25 min focused work → 5 min rest. Fights procrastination at the source.",
  "Interleave different problem types to build stronger pattern recognition.",
  "Feynman Technique: explain what you learned simply to find your gaps.",
  "Diffuse mode: take walks. Your brain consolidates while you rest.",
  "Chunking: master small units before combining into larger concepts.",
  "Recall, don't re-read: close the book and retrieve from memory.",
  "Sleep = memory consolidation. Never sacrifice recovery for study time.",
];

const pathProgress = (nodes: any[]) => {
  if (!nodes?.length) return 0;
  const total = nodes.reduce((s: number, n: any) => s + (n.level || 0), 0);
  return Math.round((total / (nodes.length * 10)) * 100);
};

type Props = Pick<UseGameState,
  | "user" | "tasks" | "goals" | "activity" | "skillNodes"
  | "createTask" | "completeTask" | "deleteTask" | "updateGoal"
>;

export default function Dashboard({
  user, tasks, goals, activity, skillNodes,
  createTask, completeTask, deleteTask, updateGoal,
}: Props) {
  const [addOpen,   setAddOpen]   = useState(false);
  const [taskText,  setTaskText]  = useState("");
  const [taskXp,    setTaskXp]    = useState(50);
  const [taskCat,   setTaskCat]   = useState("Focus");

  const xpInLvl = (user?.xp ?? 0) % XP_PER_LVL;
  const xpPct   = (xpInLvl / XP_PER_LVL) * 100;
  const tip     = OAKLEY[new Date().getDay() % OAKLEY.length];
  const done    = tasks.filter(t => t.done).length;

  const handleAddTask = async () => {
    if (!taskText.trim()) return;
    await createTask(taskText.trim(), taskXp, taskCat);
    setTaskText(""); setAddOpen(false);
  };

  return (
    <div className="nf-view" style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div style={{ ...row(16), justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontFamily: F.mono, color: C.accent, fontSize: 10, letterSpacing: 4, marginBottom: 4 }}>
            // NEURAL FORGE — COMMAND CENTER
          </div>
          <h1 style={h1}>Command Center</h1>
        </div>
        <div style={{ ...row(12), fontFamily: F.mono, fontSize: 12, color: C.muted }}>
          <span style={{ fontSize: 16 }}>🔥</span>
          <span style={{ color: C.gold, fontWeight: 700 }}>{user?.streak ?? 0}d streak</span>
          <span style={{ color: C.border }}>│</span>
          <span>{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
        </div>
      </div>

      {/* ── Character HUD ────────────────────────────────────────────────── */}
      <div style={{
        ...glassCard(C.accent),
        position: "relative", overflow: "hidden",
      }} className="nf-scanline">
        {/* Background grid decoration */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.04,
          backgroundImage: `repeating-linear-gradient(0deg,${C.accent} 0,${C.accent} 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,${C.accent} 0,${C.accent} 1px,transparent 1px,transparent 40px)`,
          pointerEvents: "none",
        }}/>

        <div style={row(20)}>
          {/* Avatar */}
          <div style={{
            width: 68, height: 68, borderRadius: 16, flexShrink: 0,
            background: `${C.accent}18`,
            border: `2px solid ${C.accent}55`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32,
            boxShadow: `0 0 20px ${C.accent}44`,
            animation: "nf-glow 3s ease-in-out infinite",
          }}>⚡</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...row(10), marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: F.display, fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>
                ML Engineer
              </span>
              <span style={tag(C.accent)}>LVL {user?.level ?? 1}</span>
              <span style={tag(C.gold)}>🏆 {(user?.xp ?? 0).toLocaleString()} XP</span>
              <span style={tag(C.purple)}>⬡ {user?.sp ?? 0} SP</span>
              <span style={tag(C.orange)}>🔥 {user?.streak ?? 0}d</span>
            </div>

            {/* XP Bar */}
            <div style={{ ...bar, height: 10, marginBottom: 6 }}>
              <div style={fill(xpPct, C.accent, 10)} className="nf-bar-fill" />
            </div>
            <div style={{ ...mono(10, C.muted) }}>
              {xpInLvl.toLocaleString()} / {XP_PER_LVL} XP → Level {(user?.level ?? 1) + 1}
            </div>
          </div>

          {/* Quest counter */}
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 34, marginBottom: 4, animation: done === tasks.length && tasks.length > 0 ? "nf-bounce 1s ease infinite" : "none" }}>
              {done === tasks.length && tasks.length > 0 ? "🏆" : "🎯"}
            </div>
            <div style={{ ...mono(11, C.muted) }}>{done}/{tasks.length}<br/>quests</div>
          </div>
        </div>
      </div>

      {/* ── Main 2-col grid ──────────────────────────────────────────────── */}
      <div style={grid(2)}>

        {/* Daily Quests */}
        <div style={card()}>
          <div style={{ ...row(), justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ ...h2, margin: 0 }}>⚔ Daily Quests</h2>
            <button className="nf-btn" style={btn(C.green, true)} onClick={() => setAddOpen(o => !o)}>
              {addOpen ? "✕ Cancel" : "+ Add Quest"}
            </button>
          </div>

          {addOpen && (
            <div style={{
              background: C.surface2, borderRadius: 10, padding: 14,
              marginBottom: 14, border: `1px solid ${C.border}`,
              animation: "nf-fadein 0.15s ease",
            }}>
              <input
                autoFocus
                style={{
                  background: C.surface, border: `1px solid ${C.border2}`,
                  borderRadius: 7, padding: "9px 13px",
                  color: C.text, fontFamily: F.body, fontSize: 14,
                  outline: "none", width: "100%", boxSizing: "border-box", marginBottom: 10,
                }}
                placeholder="Quest description…"
                value={taskText}
                onChange={e => setTaskText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddTask()}
              />
              <div style={{ ...row(8), flexWrap: "wrap" }}>
                <select style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 7, padding: "7px 10px",
                  color: C.text, fontFamily: F.body, fontSize: 13,
                  cursor: "pointer", flex: 1, minWidth: 80,
                }}
                  value={taskCat} onChange={e => setTaskCat(e.target.value)}>
                  <option>Focus</option><option>Grind</option><option>Research</option><option>Project</option>
                </select>
                <select style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 7, padding: "7px 10px",
                  color: C.text, fontFamily: F.body, fontSize: 13,
                  cursor: "pointer", flex: 1, minWidth: 80,
                }}
                  value={taskXp} onChange={e => setTaskXp(+e.target.value)}>
                  <option value={25}>25 XP</option>
                  <option value={50}>50 XP</option>
                  <option value={75}>75 XP</option>
                  <option value={100}>100 XP</option>
                </select>
                <button className="nf-btn" style={btn(C.green, true)} onClick={handleAddTask}>
                  ✓ Confirm
                </button>
              </div>
            </div>
          )}

          <div style={col_(7)}>
            {tasks.length === 0 && (
              <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 32, fontFamily: F.body }}>
                No quests yet — add your first mission!
              </div>
            )}
            {tasks.map(t => (
              <div key={t.id}
                className="nf-card-hover"
                style={{
                  ...row(), padding: "10px 14px", borderRadius: 9,
                  background: t.done ? `${C.green}0a` : C.surface2,
                  border: `1px solid ${t.done ? C.green + "30" : C.border}`,
                  opacity: t.done ? 0.55 : 1,
                  transition: "all 0.2s ease",
                  "--hover-col": t.done ? C.green : C.accent,
                } as React.CSSProperties}>
                <button
                  onClick={() => !t.done && completeTask(t.id)}
                  style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    border: `2px solid ${t.done ? C.green : C.muted}`,
                    background: t.done ? `${C.green}25` : "transparent",
                    cursor: t.done ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s ease", padding: 0,
                  }}>
                  {t.done && <span style={{ color: C.green, fontSize: 13, fontWeight: 700 }}>✓</span>}
                </button>
                <span style={{
                  flex: 1, fontSize: 13, fontFamily: F.body,
                  textDecoration: t.done ? "line-through" : "none",
                  color: t.done ? C.muted : C.text,
                }}>
                  {t.text}
                </span>
                <span style={tag(C.gold, true)}>+{t.xp_reward}</span>
                <span style={{ ...tag(C.muted, true), fontSize: 10 }}>{t.category}</span>
                <button
                  className="nf-btn"
                  onClick={() => deleteTask(t.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: "0 2px", fontSize: 13 }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={col_(16)}>

          {/* Path Mastery */}
          <div style={card()}>
            <h2 style={h2}>🌐 Path Mastery</h2>
            <div style={col_(14)}>
              {Object.entries(PATH_META).map(([key, m]) => {
                const nodes = skillNodes[key] ?? [];
                const p = pathProgress(nodes);
                return (
                  <div key={key}>
                    <div style={{ ...row(), justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 600, color: m.col }}>
                        {m.icon} {m.label}
                      </span>
                      <span style={mono(11, C.muted)}>{p}%</span>
                    </div>
                    <div style={bar}><div style={fill(p, m.col)} className="nf-bar-fill"/></div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Goals */}
          <div style={glassCard(C.purple)}>
            <h2 style={{ ...h2, color: C.purple }}>🎯 Active Goals</h2>
            <div style={col_(14)}>
              {goals.length === 0 && (
                <div style={{ color: C.muted, fontSize: 12, fontFamily: F.body }}>No goals set yet.</div>
              )}
              {goals.map(g => (
                <div key={g.id}>
                  <div style={{ ...row(), justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontFamily: F.body, fontSize: 13, color: C.text }}>{g.text}</span>
                    <span style={mono(10, C.muted)}>{g.progress}%</span>
                  </div>
                  <div style={bar}><div style={fill(g.progress, C.purple)} className="nf-bar-fill"/></div>
                  <div style={{ ...mono(9, C.muted), marginTop: 3 }}>Target: {g.deadline}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Oakley tip */}
          <div style={{
            ...glassCard(C.teal),
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ ...mono(9, C.teal), letterSpacing: 3, marginBottom: 10 }}>
              💡 LEARNING PROTOCOL — OAKLEY
            </div>
            <p style={{ fontFamily: F.body, fontSize: 13, lineHeight: 1.75, color: C.text, margin: 0 }}>
              "{tip}"
            </p>
          </div>
        </div>
      </div>

      {/* ── Activity Feed ────────────────────────────────────────────────── */}
      {activity.length > 0 && (
        <div style={card()}>
          <h2 style={h2}>⚡ Recent Activity</h2>
          <div style={col_(4)}>
            {activity.slice(0, 8).map(a => (
              <div key={a.id} style={{
                ...row(10), padding: "7px 0",
                borderBottom: `1px solid ${C.border}`,
              }}>
                <span style={tag(C.gold, true)}>+{a.xp}</span>
                <span style={{ flex: 1, fontFamily: F.body, fontSize: 12, color: C.text2 }}>{a.description}</span>
                <span style={mono(9, C.muted)}>{new Date(a.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
