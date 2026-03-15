// ============================================================
// Neural Forge — src/components/Analytics.tsx
// Analytics dashboard — XP trend, platform breakdown, skill
// velocity, SR health, sleep-performance correlation
// ============================================================

import { useEffect, useState } from "react";
import type { AnalyticsOverview } from "../api";
import * as api from "../api";
import { C, F } from "../tokens";

// ── Tiny chart helpers ────────────────────────────────────────────────────────
function Sparkline({ data, col, h = 48 }: { data: number[]; col: string; h?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 280;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 4)}`).join(" ");
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`sg-${col.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.3" />
          <stop offset="100%" stopColor={col} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#sg-${col.slice(1)})`} />
      <polyline points={pts} stroke={col} strokeWidth={2} fill="none" strokeLinejoin="round" />
      {/* Last point dot */}
      {data.length > 0 && (() => {
        const last = data[data.length - 1];
        const lx = w;
        const ly = h - (last / max) * (h - 4);
        return <circle cx={lx} cy={ly} r={3} fill={col} />;
      })()}
    </svg>
  );
}

function BarChart({ data, col, height = 120 }: { data: { label: string; value: number; col?: string }[]; col: string; height?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const barW = Math.floor((280 - (data.length - 1) * 4) / data.length);
  return (
    <svg width={280} height={height + 20} style={{ overflow: "visible" }}>
      {data.map((d, i) => {
        const bh = Math.max(2, (d.value / max) * height);
        const x = i * (barW + 4);
        const y = height - bh;
        const c = d.col ?? col;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} rx={3} fill={`${c}88`} />
            <text x={x + barW / 2} y={height + 14} textAnchor="middle"
              fontSize={8} fill={C.muted} fontFamily={F.mono}>
              {d.label.slice(0, 5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutGauge({ pct, col, size = 80 }: { pct: number; col: string; size?: number }) {
  const r = size / 2 - 8;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, pct / 100));
  return (
    <svg width={size} height={size}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={C.border} strokeWidth={7} />
      <circle cx={c} cy={c} r={r} fill="none" stroke={col} strokeWidth={7}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${c} ${c})`}
        style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      <text x={c} y={c + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={14} fontFamily={F.mono} fontWeight="bold" fill={col}>
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function Analytics() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [sleep, setSleep] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"week" | "skills" | "sr" | "sleep">("week");

  useEffect(() => {
    (async () => {
      try {
        const [ov, sl] = await Promise.all([
          api.analyticsOverview(),
          api.analyticsSleepCorrelation(30),
        ]);
        setData(ov);
        setSleep(sl);
      } catch {
        setData(MOCK_DATA);
        setSleep(MOCK_SLEEP);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, fontFamily: F.mono, color: C.muted, letterSpacing: 3 }}>
      LOADING ANALYTICS…
    </div>
  );
  if (!data) return null;

  const xpValues = data.xp_trend.map(t => t.xp);
  const weekDays = data.xp_trend.slice(-7).map(t => ({ label: t.day.slice(5), value: t.xp }));
  const retentionN = parseInt(data.sr?.retention ?? "0");
  const completionN = data.week?.completion_rate ?? 0;
  const sleepScoreN = data.sleep ? Math.round((data.sleep.avg_hours / 9) * 100) : 0;

  const tabStyle = (id: string) => ({
    padding: "8px 16px", borderRadius: 7, border: `1px solid ${tab === id ? C.accent : C.border}`,
    background: tab === id ? `${C.accent}18` : "transparent", color: tab === id ? C.accent : C.muted,
    cursor: "pointer", fontFamily: F.display, fontSize: 12, fontWeight: 700,
    letterSpacing: 1.5, textTransform: "uppercase" as const, transition: "all 0.18s ease",
  });

  const statCard = (v: string | number, l: string, col: string, sub?: string) => (
    <div key={l} style={{
      background: `linear-gradient(135deg,${C.surface} 0%,${col}0a 100%)`,
      border: `1px solid ${col}33`, borderRadius: 12, padding: "16px 18px",
      boxShadow: `0 0 20px ${col}0d`,
    }}>
      <div style={{ fontFamily: F.mono, fontSize: 28, color: col, fontWeight: 700, lineHeight: 1 }}>{v}</div>
      <div style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 2, marginTop: 5, textTransform: "uppercase" }}>{l}</div>
      {sub && <div style={{ fontFamily: F.body, fontSize: 10, color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="nf-view" style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontFamily: F.mono, color: C.accent, fontSize: 10, letterSpacing: 4, marginBottom: 4 }}>// ANALYTICS</div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const, fontFamily: F.display }}>
            Learning Analytics
          </div>
        </div>
        <button onClick={async () => { await api.analyticsSnapshot().catch(() => { }); }}
          style={{
            padding: "8px 18px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent",
            color: C.muted, cursor: "pointer", fontFamily: F.display, fontSize: 11, fontWeight: 700, letterSpacing: 1.2
          }}>
          ↻ Snapshot
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {statCard(data.week?.xp_gained ?? 0, "XP This Week", C.gold)}
        {statCard(data.week?.tasks_done ?? 0, "Tasks Done", C.green, `${Math.round(completionN)}% completion`)}
        {statCard(data.sr?.due_today ?? 0, "SR Due Today", C.purple, data.sr?.retention ?? "—")}
        {statCard(`${data.sleep?.avg_hours ?? 0}h`, "Avg Sleep", C.teal, `Energy ${data.sleep?.avg_energy ?? 0}/10`)}
      </div>

      {/* Gauges */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {[
          { label: "Task Completion", pct: completionN, col: C.green },
          { label: "SR Retention", pct: retentionN, col: C.purple },
          { label: "Sleep Score", pct: sleepScoreN, col: C.teal },
        ].map(({ label, pct, col }) => (
          <div key={label} style={{ background: C.surface, border: `1px solid ${col}22`, borderRadius: 12, padding: "20px 18px", display: "flex", alignItems: "center", gap: 16 }}>
            <DonutGauge pct={pct} col={col} size={72} />
            <div>
              <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 700, color: col, marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
                {label === "Task Completion" && `${data.week?.tasks_done ?? 0} / ${data.week?.tasks_created ?? 0} tasks`}
                {label === "SR Retention" && `${data.sr?.due_today ?? 0} cards due`}
                {label === "Sleep Score" && `${data.sleep?.avg_hours ?? 0}h avg / 9h target`}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6 }}>
        {(["week", "skills", "sr", "sleep"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>
            {t === "week" ? "📅 Week" : t === "skills" ? "⬡ Skills" : t === "sr" ? "🧠 SR" : "🌙 Sleep"}
          </button>
        ))}
      </div>

      {/* ── WEEK TAB ─────────────────────────────────────────────────────── */}
      {tab === "week" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: F.display, fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>XP TREND (30 DAYS)</div>
            {xpValues.length > 0
              ? <Sparkline data={xpValues} col={C.gold} h={80} />
              : <div style={{ color: C.muted, fontFamily: F.body, fontSize: 12 }}>No data yet</div>}
            <div style={{ fontFamily: F.mono, fontSize: 20, color: C.gold, fontWeight: 700, marginTop: 10 }}>
              {data.week?.xp_gained.toLocaleString()} XP
            </div>
            <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted }}>this week</div>
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: F.display, fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>LAST 7 DAYS</div>
            <BarChart data={weekDays.map(d => ({ label: d.label, value: d.value, col: C.accent }))} col={C.accent} />
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, gridColumn: "span 2" }}>
            <div style={{ fontFamily: F.display, fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>PLATFORM BREAKDOWN (30 DAYS)</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {(data.platform_stats ?? []).map(p => (
                <div key={p.platform} style={{ flex: 1, minWidth: 100, background: C.surface2, borderRadius: 9, padding: "12px 14px", border: `1px solid ${C.border}`, textAlign: "center" }}>
                  <div style={{ fontFamily: F.mono, fontSize: 18, color: C.accent, fontWeight: 700 }}>{p.sessions}</div>
                  <div style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 3 }}>{p.platform}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: C.gold, marginTop: 2 }}>+{p.xp} XP</div>
                </div>
              ))}
              {(data.platform_stats ?? []).length === 0 && <div style={{ color: C.muted, fontFamily: F.body, fontSize: 12 }}>No sessions logged yet.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── SKILLS TAB ───────────────────────────────────────────────────── */}
      {tab === "skills" && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontFamily: F.display, fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 14 }}>TOP SKILLS BY LEVEL</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(data.top_skills ?? []).length > 0 ? (data.top_skills ?? []).map(s => {
              const pct = (s.level / 10) * 100;
              const col = { mle: C.mle, de: C.de, ds: C.ds }[s.path_id] ?? C.accent;
              return (
                <div key={`${s.node_id}-${s.path_id}`} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 600, color: C.text, width: 140, flexShrink: 0 }}>{s.name}</div>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: C.border, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: 6, borderRadius: 3, background: `linear-gradient(90deg,${col}bb,${col})`, boxShadow: `0 0 6px ${col}88`, transition: "width 0.6s ease" }} />
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 11, color: col, width: 40, textAlign: "right", flexShrink: 0 }}>
                    Lv.{s.level}
                  </div>
                  <div style={{ padding: "1px 6px", borderRadius: 4, background: `${col}1e`, color: col, fontSize: 9, fontWeight: 700, fontFamily: F.display, letterSpacing: 0.8 }}>
                    {s.path_id.toUpperCase()}
                  </div>
                </div>
              );
            }) : <div style={{ color: C.muted, fontFamily: F.body, fontSize: 12 }}>Level up skills to see them here.</div>}
          </div>
        </div>
      )}

      {/* ── SR TAB ───────────────────────────────────────────────────────── */}
      {tab === "sr" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            { v: data.sr?.due_today ?? 0, l: "Due Today", col: C.purple },
            { v: data.sr?.retention ?? "—", l: "Retention Rate", col: C.green },
            { v: (data.sr?.avg_quality ?? 0).toFixed(2), l: "Avg Quality", col: C.gold },
          ].map(({ v, l, col }) => (
            <div key={l} style={{ background: `linear-gradient(135deg,${C.surface},${col}0a)`, border: `1px solid ${col}33`, borderRadius: 12, padding: "20px 18px" }}>
              <div style={{ fontFamily: F.mono, fontSize: 30, color: col, fontWeight: 700 }}>{v}</div>
              <div style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 2, marginTop: 5, textTransform: "uppercase" }}>{l}</div>
            </div>
          ))}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: F.display, fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>QUALITY GUIDE</div>
            {[
              { q: "0-2", l: "Reset", col: C.red, desc: "Review again tomorrow" },
              { q: "3", l: "Hard", col: C.gold, desc: "+1 day interval" },
              { q: "4", l: "Good", col: C.accent, desc: "×EF interval advance" },
              { q: "5", l: "Perfect", col: C.green, desc: "Max interval advance" },
            ].map(({ q, l, col, desc }) => (
              <div key={q} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: `${col}18`, border: `1.5px solid ${col}55`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.mono, fontSize: 11, color: col, fontWeight: 700, flexShrink: 0 }}>{q}</div>
                <div>
                  <div style={{ fontFamily: F.display, fontSize: 11, fontWeight: 600, color: col }}>{l}</div>
                  <div style={{ fontFamily: F.body, fontSize: 10, color: C.muted }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SLEEP TAB ────────────────────────────────────────────────────── */}
      {tab === "sleep" && sleep && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.teal}22`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: F.display, fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 8 }}>SLEEP HOURS TREND</div>
            <Sparkline data={(sleep?.points ?? []).map((p: any) => p.hours)} col={C.teal} h={80} />
            <div style={{ fontFamily: F.mono, fontSize: 18, color: C.teal, fontWeight: 700, marginTop: 10 }}>
              {data.sleep?.avg_hours ?? 0}h avg
            </div>
            <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted }}>past 30 days</div>
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.gold}22`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: F.display, fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 8 }}>SLEEP → NEXT-DAY XP</div>
            <BarChart data={(sleep?.points ?? []).slice(-7).map((p: any) => ({ label: p.date?.slice(5) ?? "", value: p.next_day_xp ?? 0, col: C.gold }))} col={C.gold} />
            <div style={{ fontFamily: F.mono, fontSize: 14, color: sleep?.corr_hours_xp ?? 0 > 0.3 ? C.green : C.muted, marginTop: 8 }}>
              corr = {sleep?.corr_hours_xp?.toFixed(3) ?? "—"}
            </div>
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, gridColumn: "span 2" }}>
            <div style={{ fontFamily: F.display, fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>INSIGHT</div>
            <div style={{ fontFamily: F.body, fontSize: 14, lineHeight: 1.8, color: C.text }}>
              💡 {sleep.insight}
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
              {[
                { l: "Hours → XP", v: sleep.corr_hours_xp?.toFixed(3), col: sleep.corr_hours_xp > 0.3 ? C.green : C.muted },
                { l: "Quality → XP", v: sleep.corr_quality_xp?.toFixed(3), col: sleep.corr_quality_xp > 0.3 ? C.green : C.muted },
                { l: "Avg Energy", v: `${data.sleep?.avg_energy ?? 0}/10`, col: C.accent },
              ].map(({ l, v, col }) => (
                <div key={l}>
                  <div style={{ fontFamily: F.mono, fontSize: 18, color: col, fontWeight: 700 }}>{v ?? "—"}</div>
                  <div style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 2, textTransform: "uppercase", marginTop: 3 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_DATA: AnalyticsOverview = {
  user: { xp: 2350, level: 3, sp: 8, streak: 12 },
  week: { xp_gained: 840, tasks_done: 9, tasks_created: 12, completion_rate: 75, grind_sessions: 5, grind_xp: 420 },
  sr: { due_today: 4, avg_quality: 3.8, retention: "76%" },
  sleep: { avg_hours: 7.2, avg_energy: 7.4 },
  xp_trend: Array.from({ length: 30 }, (_, i) => ({
    day: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
    xp: Math.round(Math.random() * 120 + 20),
  })),
  top_skills: [
    { node_id: "pytorch", path_id: "mle", name: "PyTorch", level: 4 },
    { node_id: "numpy", path_id: "mle", name: "NumPy", level: 3 },
    { node_id: "stats", path_id: "mle", name: "Statistics", level: 2 },
    { node_id: "sklearn", path_id: "mle", name: "Scikit-learn", level: 2 },
    { node_id: "python", path_id: "mle", name: "Python", level: 4 },
  ],
  platform_stats: [
    { platform: "leetcode", sessions: 8, xp: 480 },
    { platform: "deepml", sessions: 5, xp: 300 },
    { platform: "tensortonic", sessions: 3, xp: 180 },
  ],
};
const MOCK_SLEEP = {
  points: Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10),
    hours: 6.5 + Math.random() * 2,
    quality: Math.floor(Math.random() * 3) + 2,
    energy: Math.floor(Math.random() * 4) + 5,
    next_day_xp: Math.round(Math.random() * 120),
  })),
  corr_hours_xp: 0.41,
  corr_quality_xp: 0.28,
  insight: "Moderate positive correlation: sleeping 7.5h+ tends to produce 35% more XP the following day.",
};
