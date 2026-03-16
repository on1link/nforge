// ============================================================
// Neural Forge — src/components/Skills.tsx
// Ragnarok Online-style skill tree, fully wired to Tauri API
// ============================================================

import { useEffect, useState } from "react";
import type { SkillData, SkillNode } from "../api";
import type { UseGameState } from "../hooks/useGameState";
import { C, F, bar, bezier, btn, card, col_, fill, glassCard, h1, h3, levelArc, mono, row, tag } from "../tokens";

export default function Skills({ user, skillNodes, loadSkillPath, levelUpSkill }: Props) {
  const [path, setPath] = useState("mle");

  // FIXED: Changed from SkillData to SkillNode to match what you actually select
  const [selNode, setSelNode] = useState<SkillNode | null>(null);

  useEffect(() => { loadSkillPath(path); }, [path, loadSkillPath]);

  // ── Gather Data ───────────────────────────────────────────────────────────
  const nodes = skillNodes[path] ?? [];
  const meta = TREE_META[path];
  const col = meta.col;
  const sp = user?.sp ?? 0;

  console.log("RAW SKILL STATE:", skillNodes);
  console.log("NODES FOR CURRENT PATH:", nodes);
  // NOTE: Adjust `user?.skillData?.[path]?.levels` to match exactly where levels live in your user state
  const userLevels = (user as any)?.skillData?.[path]?.levels ?? {};

  const data: SkillData = {
    nodes: nodes,
    levels: userLevels,
  };

  const prog = pathProgress(data);
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  // ── Derive node state ──────────────────────────────────────────────────────
  const nodeState = (n: SkillNode, d: SkillData) => {
    const currentLevel = d.levels[n.id]?.level || 0;
    if (currentLevel >= 10) return "maxed";

    const prereqIds = getPrereqs(n);
    const unlocked = prereqIds.every(pid => (d.levels[pid]?.level || 0) >= 1);

    if (prereqIds.length > 0 && !unlocked) return "locked";
    if (currentLevel >= 5) return "expert";
    if (currentLevel >= 1) return "learning";

    return "available";
  };

  const nodeFill = (n: SkillNode, d: SkillData, baseCol: string) => {
    const st = nodeState(n, d);
    if (st === "locked") return "#07071a";
    if (st === "maxed") return "#1a1200";

    const currentLevel = d.levels[n.id]?.level || 0;
    const hex = Math.max(14, Math.round((currentLevel / 10) * 65)).toString(16).padStart(2, "0");
    return `${baseCol}${hex}`;
  };

  const nodeBorder = (n: SkillNode, d: SkillData, baseCol: string) => {
    const st = nodeState(n, d);
    if (st === "locked") return "#1e1e3c";
    if (st === "maxed") return "#ffd700";
    return baseCol;
  };

  // ── Build connections ──────────────────────────────────────────────────────
  const conns: { from: SkillNode; to: SkillNode }[] = [];
  nodes.forEach(n => {
    getPrereqs(n).forEach(pid => {
      const p = nodeMap[pid];
      if (p) conns.push({ from: p, to: n });
    });
  });

  // ── Selected node helpers ─────────────────────────────────────────────────
  const sn = selNode ? nodeMap[selNode.id] : null;
  const snSt = sn ? nodeState(sn, data) : null;
  const snLv = sn ? (data.levels[sn.id]?.level || 0) : 0;
  const snPrereqs = sn ? getPrereqs(sn) : [];
  const snShared = sn ? getShared(sn) : [];

  return (
    <div className="nf-view" style={col_(18)}>

      {/* Header */}
      <div style={{ ...row(16), justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontFamily: F.mono, color: col, fontSize: 10, letterSpacing: 4, marginBottom: 4 }}>
            // SKILL FORGE
          </div>
          <h1 style={h1}>Skill Tree</h1>
        </div>

        {/* SP counter */}
        <div style={{ ...glassCard(C.purple), padding: "12px 20px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: F.mono, fontSize: 32, color: C.purple, lineHeight: 1, fontWeight: 700 }}>{sp}</div>
            <div style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 2, marginTop: 2 }}>SKILL POINTS</div>
          </div>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, maxWidth: 140, lineHeight: 1.6 }}>
            Complete quests &amp; sessions to earn SP, then spend to level skills.
          </div>
        </div>
      </div>

      {/* Path tabs */}
      <div style={{ ...row(8), flexWrap: "wrap" }}>
        {Object.entries(TREE_META).map(([key, m]) => (
          <button key={key} className="nf-btn"
            onClick={() => { setPath(key); setSelNode(null); }}
            style={{
              ...btn(m.col),
              opacity: path === key ? 1 : 0.35,
              background: path === key ? `${m.col}22` : "transparent",
            }}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Path progress banner */}
      <div style={{ ...glassCard(col), padding: "14px 20px" }}>
        <div style={row(16)}>
          <div style={{ fontSize: 36, flexShrink: 0 }}>{meta.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ ...row(), justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: F.display, fontSize: 16, fontWeight: 700, color: col }}>{meta.label}</span>
              <span style={mono(12) as React.CSSProperties}>{prog}% mastery</span>
            </div>
            <div style={{ ...bar, height: 8 }}>
              <div style={fill(prog, col, 8)} className="nf-bar-fill" />
            </div>
          </div>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontFamily: F.mono, fontSize: 32, color: col, lineHeight: 1 }}>{prog}</div>
            <div style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 2 }}>MASTERY %</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ ...row(16), flexWrap: "wrap" }}>
        {[
          { l: "Locked", bg: "#07071a", bd: "#1e1e3c", dash: false },
          { l: "Available", bg: `${col}18`, bd: col, dash: false },
          { l: "Learning", bg: `${col}33`, bd: col, dash: false },
          { l: "Expert", bg: `${col}55`, bd: col, dash: false },
          { l: "Mastered", bg: "#1a1200", bd: "#ffd700", dash: false },
          { l: "Shared", bg: "none", bd: C.gold, dash: true },
        ].map(x => (
          <div key={x.l} style={{ ...row(5), fontSize: 11, fontFamily: F.display, color: C.muted }}>
            <svg width={16} height={16}>
              <circle cx={8} cy={8} r={6} fill={x.bg} stroke={x.bd} strokeWidth={1.5} strokeDasharray={x.dash ? "3,2" : "none"} />
            </svg>
            {x.l}
          </div>
        ))}
        <div style={{ marginLeft: "auto", ...mono(9) }}>Click node → inspect &amp; level up</div>
      </div>

      {/* Tree + panel */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── SVG Canvas ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowX: "auto", background: C.surface2, borderRadius: 14, border: `1px solid ${C.border}`, padding: "8px 4px" }}>
          <svg width={CW} height={CH} style={{ display: "block" }}>
            {/* Tier grid lines */}
            {[128, 248, 368, 488].map(y => (
              <line key={y} x1={10} y1={y} x2={CW - 10} y2={y} stroke={C.border} strokeWidth={1} strokeDasharray="4,10" opacity={0.5} />
            ))}

            {/* Tier labels */}
            {TIER_LABELS.map((lbl, i) => (
              <text key={i} x={14} y={50 + i * 120} fontSize={7.5} fill={C.muted} fontFamily={F.mono} letterSpacing={2.5} opacity={0.5}>{lbl}</text>
            ))}

            {/* Connections */}
            {conns.map((c, i) => {
              const fl = data.levels[c.from.id]?.level || 0;
              const tl = data.levels[c.to.id]?.level || 0;
              const active = fl > 0 && tl > 0;
              const avail = fl > 0 && getPrereqs(c.to).every(p => (data.levels[p]?.level || 0) >= 1);

              return (
                <path key={i}
                  d={bezier(c.from.canvas_x, c.from.canvas_y, c.to.canvas_x, c.to.canvas_y, R)}
                  stroke={active ? col : avail ? col + "55" : "#1a1a3e"}
                  strokeWidth={active ? 2.5 : 1.5}
                  fill="none"
                  strokeDasharray={active ? "none" : "5,4"}
                  opacity={active ? 0.9 : avail ? 0.5 : 0.3}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map(node => {
              const st = nodeState(node, data);
              const isSel = selNode?.id === node.id;
              const un = st !== "locked";
              const nodeShared = getShared(node);
              const isShared = nodeShared.length > 1;
              const currentLevel = data.levels[node.id]?.level || 0;

              return (
                <g key={`${node.path_id}-${node.id}`}
                  className={`skill-node${!un ? " locked" : ""}`}
                  style={{ cursor: un ? "pointer" : "not-allowed" }}
                  onClick={() => un && setSelNode(isSel ? null : node)}>

                  {/* Selection halo */}
                  {isSel && <circle cx={node.canvas_x} cy={node.canvas_y} r={R + 11} fill="none" stroke={col} strokeWidth={1.5} opacity={0.25} />}

                  {/* Shared multi-path gold ring */}
                  {isShared && <circle cx={node.canvas_x} cy={node.canvas_y} r={R + 5} fill="none" stroke="#ffc107" strokeWidth={1.5} strokeDasharray="4,3" opacity={0.65} />}

                  {/* Available pulse ring */}
                  {st === "available" && <circle cx={node.canvas_x} cy={node.canvas_y} r={R + 2} fill="none" stroke={col} strokeWidth={1.2} opacity={0.45} strokeDasharray="3,4" style={{ animation: "nf-pulse 2s ease-in-out infinite" }} />}

                  {/* Main circle */}
                  <circle cx={node.canvas_x} cy={node.canvas_y} r={R}
                    fill={nodeFill(node, data, col)}
                    stroke={nodeBorder(node, data, col)}
                    strokeWidth={isSel ? 3 : 2}
                    opacity={un ? 1 : 0.35} />

                  {/* Level arc */}
                  {currentLevel > 0 && (
                    <path d={levelArc(node.canvas_x, node.canvas_y, R - 5, currentLevel / 10)}
                      stroke={st === "maxed" ? "#ffd700" : col}
                      strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.95} />
                  )}

                  {/* Icon */}
                  <text x={node.canvas_x} y={node.canvas_y} textAnchor="middle" dominantBaseline="middle" fontSize={un ? 15 : 12} opacity={un ? 1 : 0.25}>
                    {!un ? "🔒" : node.icon}
                  </text>

                  {/* Level label */}
                  {currentLevel > 0 && (
                    <text x={node.canvas_x} y={node.canvas_y + R - 7} textAnchor="middle" fontSize={8} fontFamily={F.mono} fontWeight="bold" fill={st === "maxed" ? "#ffd700" : col}>
                      {currentLevel === 10 ? "MAX" : `${currentLevel}/10`}
                    </text>
                  )}

                  {/* SP cost badge */}
                  {st === "available" && (
                    <g>
                      <circle cx={node.canvas_x + R - 1} cy={node.canvas_y - R + 1} r={9} fill="#0d0d23" stroke={C.purple} strokeWidth={1.5} />
                      <text x={node.canvas_x + R - 1} y={node.canvas_y - R + 2} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill={C.purple} fontFamily={F.mono}>1</text>
                    </g>
                  )}

                  {/* Mastered star */}
                  {st === "maxed" && (
                    <text x={node.canvas_x + R} y={node.canvas_y - R + 4} textAnchor="middle" fontSize={11}>⭐</text>
                  )}

                  {/* Shared path badges */}
                  {isShared && nodeShared.filter(p => p !== path).map((p, bi) => (
                    <g key={p}>
                      <rect x={node.canvas_x - R + 4 + bi * 17} y={node.canvas_y + R + 5} width={14} height={10} rx={2} fill={`${PATH_COL[p]}22`} stroke={PATH_COL[p]} strokeWidth={1} />
                      <text x={node.canvas_x - R + 11 + bi * 17} y={node.canvas_y + R + 12} textAnchor="middle" fontSize={7} fill={PATH_COL[p]} fontFamily={F.mono} fontWeight="bold">
                        {PATH_LBL[p]}
                      </text>
                    </g>
                  ))}

                  {/* Node name */}
                  <text x={node.canvas_x} y={node.canvas_y + R + (isShared ? 22 : 17)} textAnchor="middle" fontSize={10} fill={un ? C.text : C.muted} fontFamily={F.display} fontWeight={600}>
                    {node.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* ── Detail Panel ────────────────────────────────────────────────── */}
        <div style={{ width: 240, flexShrink: 0, ...col_(12) }}>
          {sn ? (
            <div style={card(col)}>
              {/* Icon + title */}
              <div style={{ textAlign: "center", padding: "16px 0 14px" }}>
                <div style={{ fontSize: 44, marginBottom: 10, filter: snSt === "locked" ? "grayscale(1)" : "none" }}>
                  {snSt !== "locked" ? sn.icon : "🔒"}
                </div>
                <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 700, color: col, marginBottom: 8 }}>
                  {sn.name}
                </div>
                <div style={{ ...row(5), justifyContent: "center", flexWrap: "wrap" }}>
                  {snShared.map(p => (
                    <span key={p} style={{ ...tag(PATH_COL[p], true), fontSize: 9 }}>{PATH_LBL[p]}</span>
                  ))}
                </div>
              </div>

              {/* Level dots */}
              <div style={{ marginBottom: 16 }}>
                <div style={h3}>Level {snLv}/10</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} style={{
                      width: 18, height: 18, borderRadius: "50%",
                      background: i < snLv ? (snSt === "maxed" ? "#ffd700" : col) : "transparent",
                      border: `2px solid ${i < snLv ? (snSt === "maxed" ? "#ffd700" : col) : "#1e1e3c"}`,
                      boxShadow: i < snLv ? `0 0 6px ${col}` : "none",
                      transition: "all 0.2s ease",
                    }} />
                  ))}
                </div>
                <div style={{ ...mono(10), marginTop: 6 }}>
                  {snLv === 0 ? "Not started" : snLv === 10 ? "MASTERED" : snLv >= 7 ? "Expert" : snLv >= 4 ? "Skilled" : "Learning"}
                </div>
              </div>

              {/* Description */}
              <p style={{ fontFamily: F.body, fontSize: 12, lineHeight: 1.75, color: C.text2, margin: "0 0 14px" }}>
                {sn.description}
              </p>

              {/* Prerequisites */}
              {snPrereqs.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={h3}>Requires</div>
                  <div style={{ ...col_(4), marginTop: 5 }}>
                    {snPrereqs.map(pid => {
                      const pn = nodeMap[pid];
                      const met = (data.levels[pid]?.level ?? 0) >= 1;
                      return (
                        <div key={pid} style={{ ...row(6), fontFamily: F.body, fontSize: 11, color: met ? C.green : C.muted }}>
                          <span>{met ? "✓" : "✗"}</span>
                          <span>{pn?.name ?? pid}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Level-up button */}
              {snSt !== "locked" && snLv < 10 && (
                <button className="nf-btn"
                  onClick={() => levelUpSkill(path, sn.id)}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 9,
                    fontFamily: F.display, fontSize: 13, fontWeight: 700,
                    letterSpacing: 1.5, textTransform: "uppercase",
                    border: `2px solid ${sp >= 1 ? col : "#1e1e3c"}`,
                    background: sp >= 1 ? `${col}22` : "#0a0a1a",
                    color: sp >= 1 ? col : "#2a2a5a",
                    cursor: sp >= 1 ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "all 0.2s ease",
                  }}>
                  {sp >= 1 ? `⬡ Level Up — 1 SP` : "⬡ Need More SP"}
                </button>
              )}
              {snLv >= 10 && (
                <div style={{ textAlign: "center", padding: 10, fontFamily: F.display, fontSize: 13, color: "#ffd700", fontWeight: 700, letterSpacing: 1 }}>
                  ⭐ SKILL MASTERED ⭐
                </div>
              )}
              {snSt === "locked" && (
                <div style={{ textAlign: "center", padding: 10, fontFamily: F.body, fontSize: 11, color: C.muted }}>
                  Unlock prerequisites first.
                </div>
              )}
            </div>
          ) : (
            <div style={{ ...card(), padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>🌐</div>
              <div style={{ fontFamily: F.body, fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
                Click an <span style={{ color: col }}>unlocked node</span> to inspect, level up, and see prerequisites.
              </div>
              <div style={{ ...mono(10), marginTop: 14 }}>
                <span style={{ color: C.purple }}>{sp} SP</span> available
              </div>
            </div>
          )}

          {/* Path summary */}
          <div style={card()}>
            <div style={h3}>Path Progress</div>
            <div style={{ fontFamily: F.mono, fontSize: 26, color: col, fontWeight: 700, margin: "6px 0 6px" }}>
              {prog}%
            </div>
            <div style={bar}><div style={fill(prog, col)} className="nf-bar-fill" /></div>
            <div style={{ ...mono(10), marginTop: 8 }}>
              {nodes.filter(n => (data.levels[n.id]?.level || 0) > 0).length}/{nodes.length} skills started
            </div>
            <div style={mono(10)}>
              {nodes.filter(n => (data.levels[n.id]?.level || 0) >= 10).length} mastered
            </div>
            <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10, fontFamily: F.mono, fontSize: 9, color: C.muted, lineHeight: 2 }}>
              <span style={{ color: C.gold }}>EARN SP</span><br />
              +1 SP / quest done<br />
              +1 SP / grind session<br />
              +3 SP / XP level up
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
const R = 28; // node radius
const CW = 720;
const CH = 590;

const TREE_META: Record<string, { col: string; icon: string; label: string }> = {
  mle: { col: C.mle, icon: "⚡", label: "Machine Learning Engineer" },
  ds: { col: C.ds, icon: "📊", label: "Data Scientist" },
  de: { col: C.de, icon: "🗄", label: "Data Engineer" },
  aie: { col: C.aie, icon: "🤖", label: "AI Engineer" }
};

const PATH_COL: Record<string, string> = { mle: C.mle, ds: C.ds, de: C.de, aie: C.aie };
const PATH_LBL: Record<string, string> = { mle: "MLE", ds: "DS", de: "DE", aie: "AIE" };
const TIER_LABELS = ["FOUNDATIONS", "CORE SKILLS", "INTERMEDIATE", "ADVANCED", "MASTERY"];

const pathProgress = (data: SkillData) => {
  if (!data.nodes.length) return 0;
  const total = data.nodes.reduce((s, n) => {
    const currentLevel = data.levels[n.id]?.level || 0;
    return s + currentLevel;
  }, 0);
  return Math.round((total / (data.nodes.length * 10)) * 100);
};

// Safe helper to parse the prerequisites string into an array
const getPrereqs = (n: SkillNode | any): string[] => {
  const raw = n.prereqs || n.prerequisites;
  if (!raw) return [];

  if (Array.isArray(raw)) return raw; // Already an array

  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to parse prerequisites for node", n.idraw);
    return [];
  }
};

// Safe helper to parse shared paths if they exist
const getShared = (n: SkillNode | any): string[] => {
  const raw = n.shared;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw; // Already an array
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse shared paths for node", n.id);
    return [];
  }
};


type Props = Pick<UseGameState, "user" | "skillNodes" | "loadSkillPath" | "levelUpSkill">;
