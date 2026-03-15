// ============================================================
// Neural Forge — src/PluginManager.tsx
// Plugin manager: browse, enable/disable, configure, event log
// ============================================================

import React, { useState, useEffect } from "react";
import { C, F } from "../tokens";

const row  = (gap = 8): React.CSSProperties => ({ display:"flex", alignItems:"center", gap });
const col_ = (gap = 14): React.CSSProperties => ({ display:"flex", flexDirection:"column", gap });
const card = (col?: string): React.CSSProperties => ({
  background: col ? `linear-gradient(135deg,${C.surface},${col}0a)` : C.surface,
  border:`1px solid ${col?col+"33":C.border}`, borderRadius:12, padding:18,
});
const btn  = (col: string, sm?: boolean): React.CSSProperties => ({
  background:`${col}1a`, border:`1px solid ${col}55`, color:col,
  padding:sm?"5px 11px":"9px 18px", borderRadius:7, cursor:"pointer",
  fontFamily:F.display, fontSize:sm?11:13, fontWeight:700, letterSpacing:1.2,
  display:"inline-flex", alignItems:"center", gap:5, whiteSpace:"nowrap",
  textTransform:"uppercase", transition:"all 0.18s",
});

// ── Mock plugins (real data from /plugins/ endpoint) ─────────────────────────
const MOCK_PLUGINS = [
  { id:"anki-export",     name:"Anki Export",      version:"1.2.0", enabled:true,  hooks:["on_sr_review"],            description:"Exports SR cards to Anki-compatible .apkg files for offline study.", author:"neural-forge-team" },
  { id:"xp-webhook",      name:"XP Webhook",        version:"0.8.1", enabled:false, hooks:["on_xp_gain","on_level_up"],description:"Posts XP events to a Discord/Slack webhook for team accountability.", author:"community"         },
  { id:"daily-digest",    name:"Daily Digest",      version:"1.0.0", enabled:true,  hooks:["on_daily_reset"],          description:"Generates a daily Obsidian note summarising tasks done, XP gained, and SR performance.", author:"neural-forge-team" },
  { id:"pomodoro",        name:"Pomodoro Timer",    version:"0.5.0", enabled:false, hooks:["on_grind_session_end"],    description:"Auto-starts 25/5 pomodoro timers around grind sessions.", author:"community"         },
  { id:"github-tracker",  name:"GitHub Activity",   version:"1.1.0", enabled:true,  hooks:["on_daily_reset","on_task_complete"], description:"Fetches daily GitHub commit count and awards XP for code contributions.", author:"neural-forge-team" },
];

const MOCK_EVENTS = [
  { plugin_id:"daily-digest", hook:"on_daily_reset", duration_ms:320, error:null,  fired_at:"2026-03-08 08:00:02" },
  { plugin_id:"anki-export",  hook:"on_sr_review",   duration_ms:45,  error:null,  fired_at:"2026-03-08 09:14:21" },
  { plugin_id:"anki-export",  hook:"on_sr_review",   duration_ms:41,  error:null,  fired_at:"2026-03-08 09:14:55" },
  { plugin_id:"xp-webhook",   hook:"on_xp_gain",     duration_ms:0,   error:"Plugin disabled", fired_at:"2026-03-08 10:02:33" },
  { plugin_id:"github-tracker",hook:"on_daily_reset",duration_ms:890, error:null,  fired_at:"2026-03-08 08:00:03" },
];

const HOOK_COL: Record<string, string> = {
  on_sr_review:       C.purple, on_xp_gain:         C.gold,
  on_level_up:        C.green,  on_skill_levelup:    C.accent,
  on_task_complete:   C.green,  on_grind_session_end:C.gold,
  on_daily_reset:     C.teal,   on_vault_note_change:C.teal,
  on_startup:         C.muted,
};

type Tab = "installed" | "events" | "create";

export default function PluginManager() {
  const [plugins,   setPlugins]   = useState(MOCK_PLUGINS);
  const [events,    setEvents]    = useState(MOCK_EVENTS);
  const [tab,       setTab]       = useState<Tab>("installed");
  const [selected,  setSelected]  = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    fetch("http://localhost:7731/plugins/").then(r=>r.json()).then(setPlugins).catch(()=>{});
    fetch("http://localhost:7731/plugins/events?limit=30").then(r=>r.json()).then(setEvents).catch(()=>{});
  }, []);

  const toggle = async (id: string, enabled: boolean) => {
    setPlugins(ps => ps.map(p => p.id===id ? {...p, enabled} : p));
    fetch("http://localhost:7731/plugins/toggle", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ plugin_id:id, enabled }),
    }).catch(()=>{});
  };

  const sel = plugins.find(p => p.id === selected);

  const tabBtn = (id: Tab, label: string, col: string) => (
    <button onClick={() => setTab(id)} style={{ ...btn(col), opacity:tab===id?1:0.32, background:tab===id?`${col}22`:"transparent" }}>
      {label}
    </button>
  );

  return (
    <div style={col_()}>
      <div>
        <div style={{ fontFamily:F.mono, color:C.gold, fontSize:10, letterSpacing:4, marginBottom:4 }}>// PLUGINS</div>
        <div style={{ fontFamily:F.display, fontSize:26, fontWeight:700, letterSpacing:3, textTransform:"uppercase" }}>Plugin Manager</div>
      </div>
      <div style={{ fontFamily:F.body, fontSize:13, color:C.muted, lineHeight:1.8 }}>
        Extend Neural Forge with hooks into every learning event. Plugins live in{" "}
        <code style={{ background:C.surface2, padding:"1px 6px", borderRadius:4, color:C.accent, fontSize:12 }}>
          ~/.local/share/neural-forge/plugins/
        </code>
      </div>

      {/* Tabs */}
      <div style={row(6)}>
        {tabBtn("installed", "⬡ Installed", C.gold)}
        {tabBtn("events",    "📋 Event Log", C.purple)}
        {tabBtn("create",    "⊕ Create",    C.green)}
      </div>

      {/* ── INSTALLED ───────────────────────────────────────────────────── */}
      {tab === "installed" && (
        <div style={{ display:"flex", gap:14 }}>
          {/* Plugin list */}
          <div style={{ flex:1, ...col_(10) }}>
            {plugins.map(p => (
              <div key={p.id}
                onClick={() => setSelected(selected===p.id?null:p.id)}
                style={{ ...card(p.enabled?C.gold:C.muted), cursor:"pointer", transition:"all 0.18s",
                  borderColor: selected===p.id ? (p.enabled?C.gold:C.muted)+"88" : undefined,
                  boxShadow: selected===p.id ? `0 0 20px ${p.enabled?C.gold:C.muted}18` : "none" }}>
                <div style={{ ...row(), justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                  <div style={{ ...row(10) }}>
                    {/* Toggle */}
                    <div
                      onClick={e => { e.stopPropagation(); toggle(p.id, !p.enabled); }}
                      style={{ width:38, height:20, borderRadius:10, background:p.enabled?C.gold:C.border,
                        position:"relative", cursor:"pointer", transition:"background 0.2s", flexShrink:0 }}>
                      <div style={{ position:"absolute", top:2, left:p.enabled?20:2, width:16, height:16,
                        borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 3px #0005" }} />
                    </div>
                    <div>
                      <div style={{ fontFamily:F.display, fontSize:14, fontWeight:700, color:p.enabled?C.text:C.muted, letterSpacing:0.5 }}>{p.name}</div>
                      <div style={{ fontFamily:F.mono, fontSize:9, color:C.muted }}>v{p.version} · {p.author}</div>
                    </div>
                  </div>
                  <div style={{ ...row(4), flexWrap:"wrap" }}>
                    {p.hooks.slice(0,3).map(h => (
                      <span key={h} style={{ padding:"1px 6px", borderRadius:4, background:`${HOOK_COL[h]||C.accent}18`,
                        color:HOOK_COL[h]||C.accent, fontSize:9, fontWeight:700, fontFamily:F.mono }}>
                        {h.replace("on_","")}
                      </span>
                    ))}
                    {p.hooks.length > 3 && <span style={{ fontSize:9, color:C.muted, fontFamily:F.mono }}>+{p.hooks.length-3}</span>}
                  </div>
                </div>
                {selected === p.id && (
                  <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${C.border}`, animation:"fadein 0.15s ease" }}>
                    <div style={{ fontFamily:F.body, fontSize:13, color:C.muted, lineHeight:1.75, marginBottom:12 }}>
                      {p.description}
                    </div>
                    <div style={row(8)}>
                      <button style={{ ...btn(C.gold, true) }}>⚙ Configure</button>
                      <button onClick={e => { e.stopPropagation(); toggle(p.id, !p.enabled); }}
                        style={{ ...btn(p.enabled?C.red:C.green, true) }}>
                        {p.enabled?"Disable":"Enable"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Stats panel */}
          <div style={{ width:180, ...col_(10), flexShrink:0 }}>
            <div style={{ fontFamily:F.display, fontSize:10, color:C.muted, letterSpacing:2 }}>STATS</div>
            {[
              { v: plugins.filter(p=>p.enabled).length,  l:"Enabled",     col:C.green  },
              { v: plugins.filter(p=>!p.enabled).length, l:"Disabled",    col:C.muted  },
              { v: events.filter(e=>!e.error).length,    l:"Hooks Fired", col:C.gold   },
              { v: events.filter(e=>e.error).length,     l:"Errors",      col:C.red    },
            ].map(({ v, l, col }) => (
              <div key={l} style={{ ...card(col), padding:"12px 14px", textAlign:"center" }}>
                <div style={{ fontFamily:F.mono, fontSize:22, color:col, fontWeight:700 }}>{v}</div>
                <div style={{ fontFamily:F.display, fontSize:9, color:C.muted, letterSpacing:2, marginTop:3, textTransform:"uppercase" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── EVENT LOG ───────────────────────────────────────────────────── */}
      {tab === "events" && (
        <div style={col_(8)}>
          <div style={{ fontFamily:F.display, fontSize:10, color:C.muted, letterSpacing:2 }}>
            RECENT HOOK EXECUTIONS
          </div>
          {events.map((ev, i) => (
            <div key={i} style={{ ...row(), gap:12, padding:"10px 14px", borderRadius:9, background:ev.error?`${C.red}08`:C.surface, border:`1px solid ${ev.error?C.red+"33":C.border}` }}>
              <span style={{ padding:"2px 7px", borderRadius:4, background:`${HOOK_COL[ev.hook]||C.accent}18`, color:HOOK_COL[ev.hook]||C.accent, fontSize:9, fontWeight:700, fontFamily:F.mono, whiteSpace:"nowrap" }}>
                {ev.hook.replace("on_","")}
              </span>
              <span style={{ fontFamily:F.body, fontSize:12, color:C.text, flex:1 }}>{ev.plugin_id}</span>
              {ev.error
                ? <span style={{ fontFamily:F.mono, fontSize:10, color:C.red }}>{ev.error}</span>
                : <span style={{ fontFamily:F.mono, fontSize:10, color:C.muted }}>{ev.duration_ms}ms</span>
              }
              <span style={{ fontFamily:F.mono, fontSize:9, color:C.muted, flexShrink:0 }}>
                {new Date(ev.fired_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── CREATE ──────────────────────────────────────────────────────── */}
      {tab === "create" && (
        <div style={col_(14)}>
          <div style={{ fontFamily:F.body, fontSize:13, color:C.muted, lineHeight:1.8 }}>
            A plugin is a single Python file with a class that extends <code style={{ background:C.surface2, padding:"1px 5px", borderRadius:4, color:C.accent, fontSize:12 }}>BasePlugin</code>.
          </div>
          <div style={{ ...card(C.green), fontFamily:F.mono, fontSize:12, lineHeight:2.0, color:C.text2, whiteSpace:"pre", overflowX:"auto", padding:20 }}>
{`# ~/.local/share/neural-forge/plugins/my_plugin.py
from plugins.base import BasePlugin, PluginManifest

class MyPlugin(BasePlugin):
    manifest = PluginManifest(
        id          = "my-plugin",
        name        = "My Plugin",
        version     = "1.0.0",
        description = "Notifies Discord on level-up",
        author      = "you",
        hooks       = ["on_level_up", "on_xp_gain"],
    )

    async def on_level_up(self, payload: dict):
        level = payload["level"]
        # Send to Discord webhook, write vault note, etc.
        await self.notify(
            "Level up!",
            f"Reached level {level} 🎉"
        )

    async def on_xp_gain(self, payload: dict):
        if payload["xp"] >= 500:
            await self.award_xp(50, "Bonus: big XP event")
`}
          </div>
          <div style={{ fontFamily:F.display, fontSize:11, color:C.muted, letterSpacing:2 }}>AVAILABLE HOOKS</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {Object.entries(HOOK_COL).map(([h, col]) => (
              <span key={h} style={{ padding:"4px 10px", borderRadius:6, background:`${col}18`, border:`1px solid ${col}44`, color:col, fontFamily:F.mono, fontSize:11 }}>
                {h}
              </span>
            ))}
          </div>
          <div style={{ ...card(), padding:16, fontFamily:F.body, fontSize:13, color:C.muted, lineHeight:1.8 }}>
            Save your plugin file to the plugins directory, then restart the sidecar or call{" "}
            <code style={{ background:C.surface2, padding:"1px 5px", borderRadius:4, color:C.accent, fontSize:12 }}>
              POST /plugins/reload
            </code>{" "}
            to hot-reload without restarting.
          </div>
        </div>
      )}
    </div>
  );
}
