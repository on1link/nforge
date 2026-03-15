// ============================================================
// Neural Forge — src/components/Projects.tsx
// Mission Board — Kanban: Backlog → Active → Completed
// ============================================================

import React, { useState } from "react";
import {
  C, F, card, glassCard, btn, dangerBtn, tag, bar, fill,
  h1, h2, h3, row, col_, grid, mono, inp, sel,
} from "../tokens";
import type { UseGameState } from "../hooks/useGameState";
import type { Project } from "../api";

const TYPES = ["Learning", "Competition", "Research", "Portfolio", "Kaggle"];

const TYPE_COL: Record<string, string> = {
  Learning:    C.accent,
  Competition: C.gold,
  Research:    C.purple,
  Portfolio:   C.green,
  Kaggle:      C.orange,
};
const TYPE_ICON: Record<string, string> = {
  Learning: "📚", Competition: "🏆", Research: "🔬", Portfolio: "💼", Kaggle: "🐢",
};

const STATUS_META = [
  { id: "backlog", label: "BACKLOG",     icon: "📋", col: C.muted  },
  { id: "active",  label: "IN PROGRESS", icon: "⚡", col: C.accent },
  { id: "done",    label: "COMPLETED",   icon: "✓",  col: C.green  },
];

const XP_DEFAULTS: Record<string, number> = {
  Learning: 200, Competition: 800, Research: 600, Portfolio: 400, Kaggle: 700,
};

type Props = Pick<UseGameState, "projects" | "createProject" | "moveProject" | "deleteProject">;

export default function Projects({ projects, createProject, moveProject, deleteProject }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [title,    setTitle]    = useState("");
  const [ptype,    setPtype]    = useState("Learning");

  const byStatus = (s: string) => projects.filter(p => p.status === s);

  const handleCreate = async () => {
    if (!title.trim()) return;
    await createProject(title.trim(), ptype);
    setTitle(""); setShowForm(false);
  };

  const totalXp  = projects.filter(p => p.status === "done").reduce((s, p) => s + p.xp_reward, 0);
  const activeN  = byStatus("active").length;
  const doneN    = byStatus("done").length;

  return (
    <div className="nf-view" style={col_(18)}>

      {/* Header */}
      <div style={{ ...row(), justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontFamily: F.mono, color: C.accent, fontSize: 10, letterSpacing: 4, marginBottom: 4 }}>
            // MISSION BOARD
          </div>
          <h1 style={h1}>Mission Board</h1>
        </div>
        <button className="nf-btn"
          onClick={() => setShowForm(o => !o)}
          style={btn(C.accent)}>
          {showForm ? "✕ Cancel" : "+ New Mission"}
        </button>
      </div>

      {/* Stats row */}
      <div style={grid(4, 12)}>
        {[
          { v: projects.length, l: "Total",      col: C.muted  },
          { v: activeN,         l: "Active",     col: C.accent },
          { v: doneN,           l: "Completed",  col: C.green  },
          { v: totalXp,         l: "XP Earned",  col: C.gold   },
        ].map(({ v, l, col }) => (
          <div key={l} style={{ ...glassCard(col), textAlign: "center", padding: "14px 10px" }}>
            <div style={{ fontFamily: F.mono, fontSize: 26, color: col, fontWeight: 700, lineHeight: 1 }}>{v.toLocaleString()}</div>
            <div style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 2, marginTop: 4, textTransform: "uppercase" }}>{l}</div>
          </div>
        ))}
      </div>

      {/* New project form */}
      {showForm && (
        <div style={{ ...glassCard(C.accent), animation: "nf-fadein 0.18s ease" }}>
          <h2 style={h2}>🆕 New Mission</h2>
          <div style={grid(2, 14)}>
            <div>
              <div style={{ fontFamily: F.display, fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 5 }}>
                MISSION TITLE
              </div>
              <input
                autoFocus
                style={{ ...inp, borderColor: title ? `${C.accent}55` : C.border }}
                placeholder="e.g. Build a Transformer from scratch…"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div>
              <div style={{ fontFamily: F.display, fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 5 }}>
                TYPE
              </div>
              <select
                style={{ ...sel }}
                value={ptype}
                onChange={e => setPtype(e.target.value)}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ ...row(), justifyContent: "space-between", marginTop: 14, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>
              Reward: <span style={{ color: C.gold, fontWeight: 700 }}>+{XP_DEFAULTS[ptype]} XP</span> on completion
            </div>
            <button className="nf-btn" onClick={handleCreate} style={btn(C.accent)}>
              ⚡ Create Mission
            </button>
          </div>
        </div>
      )}

      {/* Kanban columns */}
      <div style={grid(3, 16)}>
        {STATUS_META.map(sm => {
          const cards = byStatus(sm.id);
          return (
            <div key={sm.id} style={{
              ...card(),
              borderColor: `${sm.col}22`,
              display: "flex",
              flexDirection: "column",
              minHeight: 320,
            }}>
              {/* Column header */}
              <div style={{
                ...row(), justifyContent: "space-between",
                marginBottom: 14, paddingBottom: 12,
                borderBottom: `2px solid ${sm.col}33`,
              }}>
                <div style={{ ...row(8) }}>
                  <span style={{ fontSize: 16, color: sm.col }}>{sm.icon}</span>
                  <span style={{ fontFamily: F.display, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: sm.col }}>
                    {sm.label}
                  </span>
                </div>
                <span style={{
                  fontFamily: F.mono,
                  background: `${sm.col}1a`,
                  border: `1px solid ${sm.col}44`,
                  color: sm.col,
                  borderRadius: 99, padding: "1px 9px", fontSize: 11, fontWeight: 700,
                }}>
                  {cards.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{ ...col_(8), flex: 1 }}>
                {cards.length === 0 && (
                  <div style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    color: C.muted, fontFamily: F.body, fontSize: 12, textAlign: "center",
                    padding: 24, opacity: 0.5, border: `1px dashed ${C.border}`, borderRadius: 8,
                  }}>
                    {sm.id === "backlog" ? "Add a mission above" : "Nothing here yet"}
                  </div>
                )}
                {cards.map(p => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onMove={(newStatus) => moveProject(p.id, newStatus)}
                    onDelete={() => deleteProject(p.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Individual project card ───────────────────────────────────────────────────
function ProjectCard({
  project, onMove, onDelete,
}: {
  project:  Project;
  onMove:   (s: string) => void;
  onDelete: () => void;
}) {
  const col   = TYPE_COL[project.project_type] ?? C.muted;
  const icon  = TYPE_ICON[project.project_type] ?? "📁";

  const nextStatus   = project.status === "backlog" ? "active" : project.status === "active" ? "done" : null;
  const prevStatus   = project.status === "done" ? "active" : project.status === "active" ? "backlog" : null;
  const nextLabel    = project.status === "backlog" ? "▶ Start" : project.status === "active" ? "✓ Complete" : null;

  return (
    <div
      className="nf-card-hover"
      style={{
        padding:      "12px 14px",
        borderRadius: 10,
        background:   C.surface2,
        border:       `1px solid ${C.border}`,
        "--hover-col": col,
        animation:    "nf-fadein 0.18s ease",
      } as React.CSSProperties}>

      {/* Type + title */}
      <div style={{ ...row(8), marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ flex: 1, fontFamily: F.display, fontSize: 14, fontWeight: 600, color: C.text }}>
          {project.title}
        </span>
      </div>

      {/* Tags */}
      <div style={{ ...row(5), flexWrap: "wrap", marginBottom: 10 }}>
        <span style={tag(col, true)}>{project.project_type}</span>
        <span style={tag(C.gold, true)}>+{project.xp_reward} XP</span>
        {project.status === "done" && project.completed_at && (
          <span style={tag(C.green, true)}>
            {new Date(project.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ ...row(5), flexWrap: "wrap" }}>
        {nextStatus && (
          <button className="nf-btn"
            onClick={() => onMove(nextStatus)}
            style={{ ...btn(col, true), flex: 1 }}>
            {nextLabel}
          </button>
        )}
        {prevStatus && (
          <button className="nf-btn"
            onClick={() => onMove(prevStatus)}
            style={{ ...btn(C.muted, true) }}>
            ← Back
          </button>
        )}
        <button className="nf-btn"
          onClick={onDelete}
          style={dangerBtn(true)}>
          ✕
        </button>
      </div>
    </div>
  );
}
