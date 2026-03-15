// ============================================================
// Neural Forge v1.0.0-beta — src/components/Sidebar.tsx
// Full navigation sidebar — all Phase 1, 2, 3 views.
// ============================================================

import type { View } from "../App";
import { C, F } from "../tokens";

const XP_PER_LVL = 1000;

interface NavSection { label: string; items: NavItem[]; }
interface NavItem { id: View; icon: string; label: string; col?: string; badge?: number; }

function buildNav(srDue: number): NavSection[] {
  return [
    {
      label: "Core", items: [
        { id: "dashboard", icon: "⊞", label: "Command", col: C.accent },
        { id: "skills", icon: "⬡", label: "Skills", col: C.mle },
        { id: "grind", icon: "⚡", label: "Grind", col: C.gold },
        { id: "projects", icon: "⎇", label: "Projects", col: C.purple },
        { id: "vitals", icon: "♡", label: "Vitals", col: C.green },
        //      { id:"vault",     icon:"📓", label:"Vault",    col:C.teal    },
      ]
    },
    {
      label: "Intelligence", items: [
        { id: "sr", icon: "🧠", label: "Reviews", col: C.purple, badge: srDue > 0 ? srDue : undefined },
        //      { id:"ai",        icon:"🤖", label:"AI Tutor", col:C.accent  },
        { id: "analytics", icon: "📈", label: "Analytics", col: C.gold },
      ]
    },
    {
      label: "Ecosystem", items: [
        //      { id:"graph",     icon:"🕸", label:"Graph",    col:C.teal    },
        //      { id:"rooms",     icon:"👥", label:"Rooms",    col:C.green   },
        //      { id:"plugins",   icon:"⬡", label:"Plugins",  col:C.gold    },
        { id: "settings", icon: "⚙", label: "Settings", col: C.muted },
      ]
    },
  ];
}

interface Props {
  currentView: View;
  onNavigate: (v: View) => void;
  gameState: { user: any; loading: boolean };
  srDue?: number;
}

export default function Sidebar({ currentView, onNavigate, gameState, srDue = 0 }: Props) {
  const user = gameState.user;
  const xpInLvl = (user?.xp ?? 0) % XP_PER_LVL;
  const xpPct = (xpInLvl / XP_PER_LVL) * 100;
  const nav = buildNav(srDue);

  return (
    <div style={{ width: 192, flexShrink: 0, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", zIndex: 100, boxShadow: `2px 0 24px rgba(0,0,0,0.5)`, overflowY: "auto" }}>
      {/* Logo + user card */}
      <div style={{ padding: "18px 14px 12px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${C.accent}18`, border: `1.5px solid ${C.accent}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: `0 0 12px ${C.accent}33`, flexShrink: 0 }}>⬡</div>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 12, fontWeight: 700, letterSpacing: 3, color: C.accent, lineHeight: 1.1 }}>NEURAL</div>
            <div style={{ fontFamily: F.display, fontSize: 12, fontWeight: 700, letterSpacing: 3, color: C.gold, lineHeight: 1.1 }}>FORGE</div>
          </div>
        </div>
        {user && (
          <div style={{ background: `${C.accent}08`, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 10px 7px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
              <span style={{ fontFamily: F.display, fontSize: 11, color: C.text2, letterSpacing: 1 }}>{user.username}</span>
              <span style={{ fontFamily: F.mono, fontSize: 10, color: C.gold }}>Lv.{user.level}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: C.border, overflow: "hidden", marginBottom: 4 }}>
              <div style={{ width: `${xpPct}%`, height: "100%", borderRadius: 2, background: `linear-gradient(90deg,${C.accent}bb,${C.accent})`, transition: "width 0.5s ease", boxShadow: `0 0 6px ${C.accent}88` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>{xpInLvl}/{XP_PER_LVL}</span>
              <span style={{ fontFamily: F.mono, fontSize: 9, color: C.gold }}>⬡{user.sp} SP</span>
            </div>
            {user.streak > 0 && <div style={{ marginTop: 4, fontFamily: F.mono, fontSize: 9, color: C.green }}>🔥 {user.streak}d streak</div>}
          </div>
        )}
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: "8px 0" }}>
        {nav.map(section => (
          <div key={section.label}>
            <div style={{ padding: "8px 14px 3px", fontFamily: F.display, fontSize: 8, color: C.muted, letterSpacing: 3, textTransform: "uppercase" }}>{section.label}</div>
            {section.items.map(item => {
              const active = currentView === item.id;
              const col = item.col ?? C.accent;
              return (
                <button key={item.id} onClick={() => onNavigate(item.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 14px", background: active ? `${col}18` : "transparent", borderLeft: `3px solid ${active ? col : "transparent"}`, border: "none", cursor: "pointer", transition: "all 0.15s" }}>
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontFamily: F.display, fontSize: 11, fontWeight: 600, letterSpacing: 1, color: active ? col : C.muted, textTransform: "uppercase", flex: 1, textAlign: "left" }}>{item.label}</span>
                  {(item.badge ?? 0) > 0 && (
                    <span style={{ minWidth: 17, height: 17, borderRadius: 9, background: C.red, color: "#fff", fontFamily: F.mono, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", flexShrink: 0 }}>{item.badge! > 99 ? "99+" : item.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Beta badge */}
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>v1.0.0-beta</span>
        <span style={{ padding: "2px 6px", borderRadius: 4, background: `${C.gold}22`, color: C.gold, fontFamily: F.display, fontSize: 9, fontWeight: 700, letterSpacing: 2, border: `1px solid ${C.gold}44` }}>BETA</span>
      </div>
    </div>
  );
}
