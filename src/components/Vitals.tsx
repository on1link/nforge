// ============================================================
// Neural Forge — src/components/Vitals.tsx
// Vitals — sleep logger, 7-day averages, dopamine drain blocker
// ============================================================

import React, { useState } from "react";
import {
  C, F, card, glassCard, btn, tag, bar, fill,
  h1, h2, h3, row, col_, grid, mono,
} from "../tokens";
import type { UseGameState } from "../hooks/useGameState";

const QUALITY_LABELS = ["Terrible", "Bad", "OK", "Good", "Excellent"];
const QUALITY_COLS   = [C.red, C.orange, C.gold, C.accent, C.green];

const BLOCKED = [
  { name: "Reddit",         icon: "👽", desc: "Infinite scroll rabbit holes" },
  { name: "Twitter / X",    icon: "𝕏",  desc: "Dopamine microbursts" },
  { name: "Instagram",      icon: "📸", desc: "Social comparison loop" },
  { name: "TikTok",         icon: "🎵", desc: "Max-entropy distraction" },
  { name: "Facebook",       icon: "f",  desc: "Feed manipulation" },
  { name: "YouTube Shorts", icon: "▶",  desc: "Short-form addiction" },
  { name: "Twitch",         icon: "💬", desc: "Passive entertainment" },
];

type Props = Pick<UseGameState, "sleepLogs" | "logSleep">;

export default function Vitals({ sleepLogs, logSleep }: Props) {
  const [hours,   setHours]   = useState(7.5);
  const [quality, setQuality] = useState(3);
  const [energy,  setEnergy]  = useState(7);
  const [logging, setLogging] = useState(false);

  const handleLog = async () => {
    setLogging(true);
    try { await logSleep(hours, quality, energy); }
    finally { setLogging(false); }
  };

  // 7-day averages
  const recent7 = sleepLogs.slice(0, 7);
  const avgHours   = recent7.length ? +(recent7.reduce((s, l) => s + l.hours,   0) / recent7.length).toFixed(1) : 0;
  const avgQuality = recent7.length ? +(recent7.reduce((s, l) => s + l.quality, 0) / recent7.length).toFixed(1) : 0;
  const avgEnergy  = recent7.length ? +(recent7.reduce((s, l) => s + l.energy,  0) / recent7.length).toFixed(1) : 0;

  const hoursCol   = hours >= 8 ? C.green : hours >= 6.5 ? C.gold : C.red;
  const qualityCol = QUALITY_COLS[quality] ?? C.gold;

  return (
    <div className="nf-view" style={col_(18)}>

      {/* Header */}
      <div>
        <div style={{ fontFamily: F.mono, color: C.green, fontSize: 10, letterSpacing: 4, marginBottom: 4 }}>
          // VITALS MONITOR
        </div>
        <h1 style={h1}>Vitals</h1>
      </div>

      {/* 7-day summary */}
      <div style={grid(3, 14)}>
        {[
          { v: `${avgHours}h`,          l: "Avg Sleep",      col: hoursCol,   icon: "🌙" },
          { v: QUALITY_LABELS[Math.round(avgQuality)] ?? "—", l: "Avg Quality", col: QUALITY_COLS[Math.round(avgQuality)] ?? C.gold, icon: "💤" },
          { v: `${avgEnergy}/10`,        l: "Avg Energy",     col: C.accent,   icon: "⚡" },
        ].map(({ v, l, col, icon }) => (
          <div key={l} style={{ ...glassCard(col), textAlign: "center", padding: "18px 12px" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
            <div style={{ fontFamily: F.mono, fontSize: 22, color: col, fontWeight: 700 }}>{v || "—"}</div>
            <div style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 2, marginTop: 4, textTransform: "uppercase" }}>
              {l} (7d)
            </div>
          </div>
        ))}
      </div>

      <div style={grid(2, 18)}>

        {/* ── Sleep Log Form ──────────────────────────────────────── */}
        <div style={glassCard(C.teal)}>
          <h2 style={{ ...h2, color: C.teal }}>🌙 Log Recovery</h2>

          <div style={col_(18)}>
            {/* Hours slider */}
            <div>
              <div style={{ ...row(), justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontFamily: F.display, fontSize: 10, letterSpacing: 2, color: C.muted }}>
                  SLEEP HOURS
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 20, color: hoursCol, fontWeight: 700 }}>
                  {hours}h
                </div>
              </div>
              <input type="range" min={0} max={12} step={0.5}
                value={hours} onChange={e => setHours(+e.target.value)}
                style={{ width: "100%", accentColor: hoursCol }}
              />
              <div style={{ ...row(), justifyContent: "space-between", fontFamily: F.mono, fontSize: 9, color: C.muted, marginTop: 3 }}>
                <span>0h</span>
                <span style={{ color: C.green }}>8h optimal</span>
                <span>12h</span>
              </div>
            </div>

            {/* Quality picker */}
            <div>
              <div style={{ fontFamily: F.display, fontSize: 10, letterSpacing: 2, color: C.muted, marginBottom: 8 }}>
                SLEEP QUALITY
              </div>
              <div style={row(6)}>
                {QUALITY_LABELS.map((lbl, i) => (
                  <button key={i}
                    className="nf-btn"
                    onClick={() => setQuality(i)}
                    style={{
                      flex:       1,
                      padding:    "8px 4px",
                      borderRadius: 8,
                      border:     `1.5px solid ${quality === i ? QUALITY_COLS[i] : C.border}`,
                      background: quality === i ? `${QUALITY_COLS[i]}22` : "transparent",
                      color:      quality === i ? QUALITY_COLS[i] : C.muted,
                      cursor:     "pointer",
                      fontFamily: F.display,
                      fontSize:   10,
                      fontWeight: 700,
                      letterSpacing: 0.3,
                      transition: "all 0.15s ease",
                    }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Energy slider */}
            <div>
              <div style={{ ...row(), justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontFamily: F.display, fontSize: 10, letterSpacing: 2, color: C.muted }}>
                  MORNING ENERGY
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 20, color: C.accent, fontWeight: 700 }}>
                  {energy}/10
                </div>
              </div>
              <input type="range" min={1} max={10} step={1}
                value={energy} onChange={e => setEnergy(+e.target.value)}
                style={{ width: "100%", accentColor: C.accent }}
              />
              <div style={bar}>
                <div style={fill((energy / 10) * 100, C.accent)} className="nf-bar-fill" />
              </div>
            </div>

            <button
              className="nf-btn"
              onClick={handleLog}
              disabled={logging}
              style={{
                padding:       "13px",
                borderRadius:  9,
                border:        `2px solid ${C.teal}`,
                background:    `${C.teal}18`,
                color:         C.teal,
                cursor:        logging ? "not-allowed" : "pointer",
                fontFamily:    F.display,
                fontSize:      14,
                fontWeight:    700,
                letterSpacing: 2,
                textTransform: "uppercase",
                width:         "100%",
                transition:    "all 0.18s ease",
                display:       "flex",
                alignItems:    "center",
                justifyContent: "center",
                gap:           8,
              }}>
              {logging ? "⏳ Logging…" : "🌙 Log Recovery — +30 XP"}
            </button>
          </div>
        </div>

        {/* ── Sleep History ─────────────────────────────────────────── */}
        <div style={card()}>
          <h2 style={h2}>📅 Recovery History</h2>
          {sleepLogs.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: C.muted, fontFamily: F.body, fontSize: 13 }}>
              No logs yet. Start tracking tonight!
            </div>
          ) : (
            <div style={{ col_: 0, display: "flex", flexDirection: "column", gap: 6, maxHeight: 380, overflowY: "auto" }}>
              {sleepLogs.map(l => {
                const qc = QUALITY_COLS[l.quality] ?? C.gold;
                const hc = l.hours >= 8 ? C.green : l.hours >= 6.5 ? C.gold : C.red;
                return (
                  <div key={l.id}
                    className="nf-card-hover"
                    style={{
                      ...row(), justifyContent: "space-between",
                      padding: "9px 12px", borderRadius: 8,
                      background: C.surface2,
                      border: `1px solid ${C.border}`,
                      "--hover-col": qc,
                    } as React.CSSProperties}>
                    <span style={mono(11, C.muted)}>{l.log_date}</span>
                    <div style={row(5)}>
                      <span style={tag(hc, true)}>{l.hours}h</span>
                      <span style={tag(qc, true)}>{QUALITY_LABELS[l.quality]}</span>
                      <span style={tag(C.accent, true)}>⚡ {l.energy}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Dopamine Drain Blocker ────────────────────────────────────── */}
      <div style={glassCard(C.red)}>
        <div style={{ ...row(), justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ ...h2, color: C.red, margin: 0 }}>🚫 Dopamine Drain Blocker</h2>
          <div style={row(8)}>
            <span style={tag(C.green)}>✓ Active via /etc/hosts</span>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          {BLOCKED.map(site => (
            <div key={site.name}
              className="nf-card-hover"
              style={{
                padding:      "10px 14px",
                borderRadius: 9,
                background:   C.surface,
                border:       `1px solid ${C.red}33`,
                display:      "flex",
                gap:          10,
                alignItems:   "center",
                "--hover-col": C.red,
              } as React.CSSProperties}>
              <span style={{ fontSize: 18, opacity: 0.7 }}>{site.icon}</span>
              <div>
                <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 600, color: C.text }}>{site.name}</div>
                <div style={{ fontFamily: F.body, fontSize: 10, color: C.muted }}>{site.desc}</div>
              </div>
              <span style={{ marginLeft: "auto", ...tag(C.red, true) }}>BLOCKED</span>
            </div>
          ))}
        </div>

        <div style={{
          background:   C.surface,
          borderRadius: 9,
          padding:      "12px 16px",
          border:       `1px solid ${C.border}`,
        }}>
          <div style={{ fontFamily: F.display, fontSize: 11, color: C.muted, letterSpacing: 1.5, marginBottom: 8 }}>
            SETUP INSTRUCTIONS
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 11, color: C.text2, lineHeight: 2.2 }}>
            <span style={{ color: C.accent }}>Linux/macOS:</span> Launch Neural Forge with <code style={{ background: C.surface2, padding: "2px 6px", borderRadius: 4, color: C.gold }}>sudo ./neural-forge</code>
            <br />
            <span style={{ color: C.accent }}>Windows:</span> Run as Administrator to write to hosts file
            <br />
            <span style={{ color: C.accent }}>Auto-reapply:</span> Blocker daemon checks every 5 minutes
          </div>
        </div>
      </div>
    </div>
  );
}
