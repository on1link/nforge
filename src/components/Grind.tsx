// ============================================================
// Neural Forge — src/components/Grind.tsx
// Grind Station — 7 platforms, session logger, history
// ============================================================

import React, { useState, useEffect } from "react";
import {
  C, F, card, glassCard, btn, dangerBtn, tag, bar, fill,
  h1, h2, h3, row, col_, grid, mono, inp, sel,
} from "../tokens";
import type { UseGameState } from "../hooks/useGameState";

const PLATFORMS: { id: string; label: string; url: string; icon: string; col: string; desc: string }[] = [
  { id: "leetcode",      label: "LeetCode",       url: "https://leetcode.com",              icon: "⚡", col: C.gold,   desc: "DSA problems, interview prep" },
  { id: "tensortonic",   label: "Tensortonic",     url: "https://tensortonic.com",           icon: "🔬", col: C.accent, desc: "ML theory deep dives" },
  { id: "mldl",          label: "MLDL.Study",      url: "https://mldl.study",                icon: "🧠", col: C.purple, desc: "ML/DL structured courses" },
  { id: "deepml",        label: "deep-ml.com",     url: "https://deep-ml.com",               icon: "🤖", col: C.green,  desc: "Hands-on ML coding challenges" },
  { id: "datainterview", label: "DataInterview",   url: "https://datainterviewpro.com",      icon: "💼", col: C.orange, desc: "Data science interview Qs" },
  { id: "mlstack",       label: "MLStack.cafe",    url: "https://mlstack.cafe",              icon: "☕", col: C.pink,   desc: "ML engineering flashcards" },
  { id: "simulations",   label: "Simulations",     url: "#",                                 icon: "🔭", col: C.teal,   desc: "Custom ML experiments" },
];

const DIFFICULTIES = ["Easy", "Medium", "Hard"];

const XP_MAP: Record<string, number> = { Easy: 30, Medium: 60, Hard: 100 };

type Props = Pick<UseGameState, "sessions" | "loadSessions" | "logSession">;

export default function Grind({ sessions, loadSessions, logSession }: Props) {
  const [activePlat, setActivePlat] = useState(PLATFORMS[0]);
  const [topic,      setTopic]      = useState("");
  const [diff,       setDiff]       = useState("Medium");
  const [notes,      setNotes]      = useState("");
  const [logging,    setLogging]    = useState(false);

  useEffect(() => { loadSessions(activePlat.id); }, [activePlat.id]);

  const platSessions = sessions[activePlat.id] ?? [];
  const xpReward     = XP_MAP[diff] ?? 60;

  const handleLog = async () => {
    if (!topic.trim()) return;
    setLogging(true);
    try {
      await logSession({ platform: activePlat.id, topic: topic.trim(), difficulty: diff, xp_reward: xpReward, notes });
      setTopic(""); setNotes("");
    } finally {
      setLogging(false);
    }
  };

  const diffCol = { Easy: C.green, Medium: C.gold, Hard: C.red }[diff] ?? C.gold;

  return (
    <div className="nf-view" style={col_(18)}>

      {/* Header */}
      <div>
        <div style={{ fontFamily: F.mono, color: C.accent, fontSize: 10, letterSpacing: 4, marginBottom: 4 }}>
          // GRIND STATION
        </div>
        <h1 style={h1}>Grind Station</h1>
      </div>

      {/* Platform grid */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {PLATFORMS.map(p => {
          const active = activePlat.id === p.id;
          const cnt    = (sessions[p.id] ?? []).length;
          return (
            <button key={p.id}
              className="nf-btn"
              onClick={() => setActivePlat(p)}
              style={{
                padding:       "10px 14px",
                borderRadius:  10,
                border:        `1.5px solid ${active ? p.col : C.border}`,
                background:    active ? `${p.col}18` : C.surface2,
                cursor:        "pointer",
                display:       "flex",
                flexDirection: "column",
                alignItems:    "center",
                gap:           4,
                minWidth:      90,
                boxShadow:     active ? `0 0 18px ${p.col}33` : "none",
                transition:    "all 0.18s ease",
                position:      "relative",
              }}>
              <span style={{ fontSize: 20 }}>{p.icon}</span>
              <span style={{ fontFamily: F.display, fontSize: 11, fontWeight: 700, color: active ? p.col : C.muted, letterSpacing: 0.5 }}>
                {p.label}
              </span>
              {cnt > 0 && (
                <span style={{
                  position: "absolute", top: -5, right: -5,
                  ...tag(p.col, true),
                  fontSize: 9, borderRadius: 99,
                  padding: "0px 5px",
                }}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={grid(2, 18)}>

        {/* ── Log Form ──────────────────────────────────────────────── */}
        <div style={glassCard(activePlat.col)}>
          <div style={{ ...row(12), marginBottom: 20 }}>
            <span style={{ fontSize: 28 }}>{activePlat.icon}</span>
            <div>
              <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 700, color: activePlat.col }}>
                {activePlat.label}
              </div>
              <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted }}>
                {activePlat.desc}
              </div>
            </div>
          </div>

          <div style={col_(12)}>
            <div>
              <div style={{ fontFamily: F.display, fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 5 }}>
                TOPIC / PROBLEM
              </div>
              <input
                style={{
                  ...inp,
                  borderColor: topic ? `${activePlat.col}55` : C.border,
                  boxShadow:   topic ? `0 0 12px ${activePlat.col}22` : "none",
                  transition:  "all 0.2s ease",
                }}
                placeholder={`e.g. Binary Tree LCA, Transformers attention…`}
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleLog()}
              />
            </div>

            <div>
              <div style={{ fontFamily: F.display, fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 7 }}>
                DIFFICULTY
              </div>
              <div style={row(8)}>
                {DIFFICULTIES.map(d => {
                  const dc = { Easy: C.green, Medium: C.gold, Hard: C.red }[d]!;
                  return (
                    <button key={d}
                      className="nf-btn"
                      onClick={() => setDiff(d)}
                      style={{
                        flex:       1,
                        padding:    "9px 0",
                        borderRadius: 8,
                        border:     `1.5px solid ${diff === d ? dc : C.border}`,
                        background: diff === d ? `${dc}22` : "transparent",
                        color:      diff === d ? dc : C.muted,
                        cursor:     "pointer",
                        fontFamily: F.display,
                        fontSize:   13,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        transition: "all 0.15s ease",
                      }}>
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div style={{ fontFamily: F.display, fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 5 }}>
                NOTES (OPTIONAL)
              </div>
              <textarea
                style={{
                  ...inp,
                  height:   72,
                  resize:   "none",
                  lineHeight: 1.6,
                }}
                placeholder="Key insight, edge case, technique used…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {/* XP preview */}
            <div style={{
              ...row(), justifyContent: "space-between",
              background: C.surface2, borderRadius: 9,
              padding: "10px 14px",
              border: `1px solid ${C.border}`,
            }}>
              <span style={{ fontFamily: F.body, fontSize: 13, color: C.muted }}>Session reward</span>
              <div style={row(8)}>
                <span style={tag(C.gold)}>+{xpReward} XP</span>
                <span style={tag(C.purple)}>+1 SP</span>
              </div>
            </div>

            <button
              className="nf-btn"
              onClick={handleLog}
              disabled={!topic.trim() || logging}
              style={{
                padding:       "13px",
                borderRadius:  9,
                border:        `2px solid ${topic.trim() ? activePlat.col : C.border}`,
                background:    topic.trim() ? `${activePlat.col}22` : C.surface2,
                color:         topic.trim() ? activePlat.col : C.muted,
                cursor:        topic.trim() ? "pointer" : "not-allowed",
                fontFamily:    F.display,
                fontSize:      15,
                fontWeight:    700,
                letterSpacing: 2,
                textTransform: "uppercase",
                width:         "100%",
                display:       "flex",
                alignItems:    "center",
                justifyContent: "center",
                gap:           8,
                transition:    "all 0.18s ease",
              }}>
              {logging ? "⏳ Logging…" : `⚡ Log Session — +${xpReward} XP`}
            </button>
          </div>
        </div>

        {/* ── Session History ──────────────────────────────────────── */}
        <div style={card()}>
          <div style={{ ...row(), justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ ...h2, margin: 0 }}>{activePlat.icon} History</h2>
            <span style={mono(11, C.muted)}>{platSessions.length} sessions</span>
          </div>

          {platSessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: C.muted, fontFamily: F.body, fontSize: 13 }}>
              No sessions yet.<br/>
              <span style={{ fontSize: 11, marginTop: 6, display: "block" }}>Log your first grind above!</span>
            </div>
          ) : (
            <div style={{ ...col_(6), maxHeight: 440, overflowY: "auto", paddingRight: 4 }}>
              {platSessions.map(s => {
                const dc = { Easy: C.green, Medium: C.gold, Hard: C.red }[s.difficulty] ?? C.gold;
                return (
                  <div key={s.id}
                    className="nf-card-hover"
                    style={{
                      padding:      "11px 14px",
                      borderRadius: 9,
                      background:   C.surface2,
                      border:       `1px solid ${C.border}`,
                      "--hover-col": activePlat.col,
                    } as React.CSSProperties}>
                    <div style={{ ...row(), justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 600, color: C.text }}>
                        {s.topic}
                      </span>
                      <div style={row(5)}>
                        <span style={tag(dc, true)}>{s.difficulty}</span>
                        <span style={tag(C.gold, true)}>+{s.xp_reward}</span>
                      </div>
                    </div>
                    {s.notes && (
                      <p style={{ fontFamily: F.body, fontSize: 11, color: C.muted, margin: "5px 0 0", lineHeight: 1.6 }}>
                        {s.notes}
                      </p>
                    )}
                    <div style={{ ...mono(9, C.muted), marginTop: 5 }}>
                      {new Date(s.created_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Aggregate stats */}
          {platSessions.length > 0 && (
            <div style={{
              marginTop: 14,
              borderTop: `1px solid ${C.border}`,
              paddingTop: 12,
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 10,
              textAlign: "center",
            }}>
              {[
                { v: platSessions.length, l: "Sessions" },
                { v: platSessions.reduce((s, x) => s + x.xp_reward, 0), l: "XP Earned" },
                { v: platSessions.filter(x => x.difficulty === "Hard").length, l: "Hard Clears" },
              ].map(({ v, l }) => (
                <div key={l}>
                  <div style={{ fontFamily: F.mono, fontSize: 20, color: activePlat.col, fontWeight: 700 }}>{v}</div>
                  <div style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase" }}>{l}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
