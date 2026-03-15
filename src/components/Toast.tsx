// ============================================================
// Neural Forge — src/components/Toast.tsx
// Animated XP / level-up toasts (top-right corner)
// ============================================================

import React from "react";
import { C, F } from "../tokens";
import type { Toast as ToastData } from "../hooks/useGameState";

const TYPE_STYLE: Record<string, { bg: string; border: string; icon: string }> = {
  xp:      { bg: C.surface,   border: C.accent,  icon: "⚡" },
  levelup: { bg: "#1a0f00",   border: C.gold,    icon: "⬆" },
  skill:   { bg: "#0f0025",   border: C.purple,  icon: "🔼" },
  warn:    { bg: "#150010",   border: C.red,     icon: "⚠" },
  info:    { bg: C.surface,   border: C.teal,    icon: "ℹ" },
};

interface Props { toasts: ToastData[]; }

export default function ToastStack({ toasts }: Props) {
  return (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 8,
      pointerEvents: "none",
    }}>
      {toasts.map(t => {
        const s = TYPE_STYLE[t.type] || TYPE_STYLE.xp;
        return (
          <div key={t.id} style={{
            display:       "flex",
            alignItems:    "center",
            gap:           10,
            padding:       "11px 18px",
            borderRadius:  10,
            background:    s.bg,
            border:        `1px solid ${s.border}66`,
            boxShadow:     `0 4px 24px rgba(0,0,0,0.7), 0 0 16px ${s.border}33`,
            fontFamily:    F.display,
            fontSize:      14,
            fontWeight:    700,
            letterSpacing: 0.5,
            color:         t.type === "levelup" ? C.gold : s.border,
            maxWidth:      320,
            animation:     t.dying
              ? "nf-toast-out 0.45s ease forwards"
              : "nf-toast-in  0.35s cubic-bezier(0.34,1.56,0.64,1) forwards",
            backdropFilter: "blur(12px)",
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
            <span>{t.msg}</span>
            {t.type === "levelup" && (
              <div style={{
                position:  "absolute",
                inset:     0,
                borderRadius: 10,
                background: `linear-gradient(90deg, transparent, ${C.gold}22, transparent)`,
                animation: "nf-shimmer 1s linear infinite",
                pointerEvents: "none",
              }}/>
            )}
          </div>
        );
      })}
    </div>
  );
}
