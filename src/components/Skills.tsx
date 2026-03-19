// ============================================================
// Neural Forge — src/components/Skills.tsx
// Ragnarok Online–style skill tree, updated for 002_skill_cycle:
//   - Levels 0–5 (mastery-driven, not SP-only)
//   - Level key: "node_id::path_id"
//   - Detail panel: subtopic mastery bars + resources
//   - Unlock check: prereqs via v_node_mastery
//   - SP "Boost" still available as shortcut (+15 mastery / subtopic)
// ============================================================

import { useEffect, useState } from "react";
import type {
  LearningResource,
  NodeLevel,
  SkillData, SkillNode,
  Subtopic
} from "../api";
import { api } from "../api";
import type { UseGameState } from "../hooks/useGameState";
import {
  C, F, bar, bezier, btn, card, col_, fill, glassCard,
  h1, h3, levelArc, mono, row, tag
} from "../tokens";

// ── Constants ─────────────────────────────────────────────────────────────────
const R = 28;   // node radius
const CW = 720;
const CH = 620;
const MAX_LEVEL = 5;

const TREE_META: Record<string, { col: string; icon: string; label: string }> = {
  mle: { col: C.mle, icon: "⚡", label: "Machine Learning Engineer" },
  ds: { col: C.ds, icon: "📊", label: "Data Scientist" },
  de: { col: C.de, icon: "🗄", label: "Data Engineer" },
  aie: { col: C.aie, icon: "🤖", label: "AI Engineer" },
};

const PATH_COL: Record<string, string> = { mle: C.mle, ds: C.ds, de: C.de, aie: C.aie };
const PATH_LBL: Record<string, string> = { mle: "MLE", ds: "DS", de: "DE", aie: "AIE" };
const TIER_LABELS = ["FOUNDATIONS", "CORE SKILLS", "INTERMEDIATE", "ADVANCED", "MASTERY"];

// ── Helpers ───────────────────────────────────────────────────────────────────
const getPrereqs = (n: SkillNode): string[] => {
  const raw = n.prereqs;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
};
const getShared = (n: SkillNode): string[] => {
  const raw = n.shared;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
};

const levelKey = (nodeId: string, pathId: string) => `${nodeId}::${pathId}`;

const getNodeLevel = (levels: SkillData["levels"], nodeId: string, pathId: string): NodeLevel =>
  levels[levelKey(nodeId, pathId)] ?? { level: 0, avg_mastery: 0, mastered_subtopics: 0, xp_invested: 0, unlocked: false };

const pathProgress = (data: SkillData, path: string): number => {
  // Guard against the backend returning a HashMap (Object) instead of an Array
  const safeNodes = Array.isArray(data.nodes) ? data.nodes : Object.values(data.nodes || {});

  const pathNodes = safeNodes.filter((n: any) => n.path_id === path);
  if (!pathNodes.length) return 0;

  const total = pathNodes.reduce((s, n: any) => s + getNodeLevel(data.levels, n.id, path).level, 0);
  return Math.round((total / (pathNodes.length * MAX_LEVEL)) * 100);
};

// Mastery level → visual state
const nodeState = (levels: SkillData["levels"], n: SkillNode, path: string) => {
  const nl = getNodeLevel(levels, n.id, path);
  if (!nl.unlocked) return "locked";
  if (nl.level >= MAX_LEVEL) return "maxed";
  if (nl.level >= 4) return "expert";
  if (nl.level >= 1) return "learning";
  return "available";
};

// ── Mastery badge colors ──────────────────────────────────────────────────────
const BADGE_COL: Record<string, string> = {
  bronze: "#cd7f32", silver: "#c0c0c0", gold: "#ffd700", master: "#00e5ff", legend: "#ff00ff",
};

// ── Subtopic mastery bar ──────────────────────────────────────────────────────
function SubtopicBar({ sub }: { sub: Subtopic }) {
  const pct = sub.mastery;
  const color = pct >= 80 ? C.green : pct >= 40 ? C.gold : C.muted;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ ...row(6), justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontFamily: F.body, fontSize: 11, color: pct >= 1 ? C.text2 : C.muted }}>{sub.name}</span>
        <div style={{ ...row(6) }}>
          {sub.practice_count > 0 && (
            <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>
              {sub.accuracy}% acc
            </span>
          )}
          <span style={{ fontFamily: F.mono, fontSize: 10, color, fontWeight: 700 }}>{pct}%</span>
        </div>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: C.border, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%", borderRadius: 3,
          background: `linear-gradient(90deg,${color}88,${color})`,
          transition: "width 0.5s ease",
          boxShadow: pct >= 80 ? `0 0 6px ${color}66` : "none",
        }} />
      </div>
    </div>
  );
}

// ── Resource list item ────────────────────────────────────────────────────────
const TYPE_ICON: Record<string, string> = {
  book: "📚", course: "🎓", paper: "📄", video: "📹", blog: "🔗", tool: "🛠"
};

function ResourceItem({ res }: { res: LearningResource }) {
  const col = res.finished ? C.green : res.pct_complete > 0 ? C.gold : C.muted;
  return (
    <div style={{ ...row(10), padding: "8px 0", borderBottom: `1px solid ${C.border}30` }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{TYPE_ICON[res.type] ?? "📌"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: F.body, fontSize: 11, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {res.url ? (
            <a href={res.url} target="_blank" rel="noreferrer"
              style={{ color: C.accent, textDecoration: "none" }}>{res.title}</a>
          ) : res.title}
        </div>
        <div style={{ ...row(6), marginTop: 2 }}>
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted }}>{res.est_hours}h</span>
          {res.is_free && <span style={{ ...tag(C.green, true) as object, fontSize: 8 }}>FREE</span>}
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: "right" }}>
        <div style={{ fontFamily: F.mono, fontSize: 10, color, fontWeight: 700 }}>
          {res.finished ? "✓" : res.pct_complete > 0 ? `${res.pct_complete}%` : "—"}
        </div>
        {!res.finished && res.pct_complete === 0 && (
          <button
            onClick={() => api.updateResourceProgress(res.id, 1)}
            style={{ fontFamily: F.display, fontSize: 8, color: C.muted, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer", padding: "1px 5px", marginTop: 2 }}>
            Start
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Skills({ user, skillNodes, loadSkillPath, levelUpSkill }: Props) {
  const [path, setPath] = useState("mle");
  const [selNode, setSelNode] = useState<SkillNode | null>(null);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [panel, setPanel] = useState<"subtopics" | "resources">("subtopics");
  const [boosting, setBoosting] = useState(false);

  useEffect(() => { loadSkillPath(path); }, [path, loadSkillPath]);

  const rawNodes = skillNodes[path] ?? [];
  const nodes = Array.isArray(rawNodes) ? rawNodes : Object.values(rawNodes);

  const meta = TREE_META[path];
  const col = meta.col;
  const sp = user?.sp ?? 0;
  const userLevels = (user as any)?.skillData?.[path]?.levels ?? {};

  const data: SkillData = {
    nodes: nodes,
    levels: userLevels,
  };

  const prog = pathProgress(data, path);
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  // ── Load subtopics + resources when a node is selected ───────────────────
  useEffect(() => {
    let active = true;
    setSubtopics([]);
    setResources([]);

    if (!selNode) return;

    api.getSubtopics(selNode.id, path).then(data => {
      if (active) setSubtopics(data);
    }).catch(() => { });

    api.listResources(selNode.id, path).then(data => {
      if (active) setResources(data);
    }).catch(() => { });

    return () => { active = false; };
  }, [selNode?.id, path]);

  // ── Connection lines ──────────────────────────────────────────────────────
  const conns: { from: SkillNode; to: SkillNode }[] = [];
  nodes.forEach(n => {
    getPrereqs(n).forEach(pid => {
      const p = nodeMap[pid];
      if (p) conns.push({ from: p, to: n });
    });
  });

  // ── Selected node helpers ─────────────────────────────────────────────────
  const sn = selNode ? nodeMap[selNode.id] : null;
  const snNL = sn ? getNodeLevel(data.levels, sn.id, path) : null;
  const snSt = sn ? nodeState(data.levels, sn, path) : null;
  const snLv = snNL?.level ?? 0;
  const snPre = sn ? getPrereqs(sn) : [];
  const snSh = sn ? getShared(sn) : [];

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
        <div style={{ ...glassCard(C.purple) as object, padding: "12px 20px", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: F.mono, fontSize: 32, color: C.purple, lineHeight: 1, fontWeight: 700 }}>{sp}</div>
            <div style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 2, marginTop: 2 }}>SKILL POINTS</div>
          </div>
          <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, maxWidth: 140, lineHeight: 1.6 }}>
            Practice subtopics or spend SP to boost a skill.
          </div>
        </div>
      </div>

      {/* Path tabs */}
      <div style={{ ...row(8), flexWrap: "wrap" }}>
        {Object.entries(TREE_META).map(([key, m]) => (
          <button key={key} className="nf-btn"
            onClick={() => { setPath(key); setSelNode(null); }}
            style={{ ...btn(m.col), opacity: path === key ? 1 : 0.35, background: path === key ? `${m.col}22` : "transparent" }}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Path progress banner */}
      <div style={{ ...glassCard(col) as object, padding: "14px 20px" }}>
        <div style={row(16)}>
          <div style={{ fontSize: 36, flexShrink: 0 }}>{meta.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ ...row(), justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: F.display, fontSize: 16, fontWeight: 700, color: col }}>{meta.label}</span>
              <span style={mono(12) as React.CSSProperties}>{prog}% mastery</span>
            </div>
            <div style={bar}>
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
              <circle cx={8} cy={8} r={6} fill={x.bg} stroke={x.bd} strokeWidth={1.5}
                strokeDasharray={x.dash ? "3,2" : "none"} />
            </svg>
            {x.l}
          </div>
        ))}
        <div style={{ marginLeft: "auto", ...mono(9) }}>Click node → inspect · practice · boost</div>
      </div>

      {/* Tree + panel */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── SVG canvas ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowX: "auto", background: C.surface2, borderRadius: 14, border: `1px solid ${C.border}`, padding: "8px 4px" }}>
          <svg width={CW} height={CH} style={{ display: "block" }}>
            {/* Tier grid */}
            {[128, 248, 368, 488, 608].map(y => (
              <line key={y} x1={10} y1={y} x2={CW - 10} y2={y} stroke={C.border} strokeWidth={1} strokeDasharray="4,10" opacity={0.5} />
            ))}
            {TIER_LABELS.map((lbl, i) => (
              <text key={i} x={14} y={50 + i * 120} fontSize={7.5} fill={C.muted} fontFamily={F.mono} letterSpacing={2.5} opacity={0.5}>{lbl}</text>
            ))}

            {/* Connections */}
            {conns.map((c, i) => {
              const fl = getNodeLevel(data.levels, c.from.id, path).level;
              const tl = getNodeLevel(data.levels, c.to.id, path).level;
              const active = fl > 0 && tl > 0;
              const avail = fl > 0 && getPrereqs(c.to).every(pid => getNodeLevel(data.levels, pid, path).level >= 1);
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
              const nl = getNodeLevel(data.levels, node.id, path);
              const st = nodeState(data.levels, node, path);
              const isSel = selNode?.id === node.id;
              const un = st !== "locked";
              const shared = getShared(node);
              const isShared = shared.length > 1;

              // Fill intensity from mastery (0–100 → hex)
              const fillHex = () => {
                if (st === "locked") return "#07071a";
                if (st === "maxed") return "#1a1200";
                const h = Math.max(14, Math.round((nl.level / MAX_LEVEL) * 90));
                return `${col}${h.toString(16).padStart(2, "0")}`;
              };
              const borderCol = () => {
                if (st === "locked") return "#1e1e3c";
                if (st === "maxed") return "#ffd700";
                return col;
              };

              return (
                <g key={`${node.path_id}-${node.id}`}
                  className={`skill-node${!un ? " locked" : ""}`}
                  style={{ cursor: un ? "pointer" : "not-allowed" }}
                  onClick={() => un && setSelNode(isSel ? null : node)}>

                  {isSel && <circle cx={node.canvas_x} cy={node.canvas_y} r={R + 11} fill="none" stroke={col} strokeWidth={1.5} opacity={0.25} />}
                  {isShared && <circle cx={node.canvas_x} cy={node.canvas_y} r={R + 5} fill="none" stroke="#ffc107" strokeWidth={1.5} strokeDasharray="4,3" opacity={0.65} />}
                  {st === "available" && <circle cx={node.canvas_x} cy={node.canvas_y} r={R + 2} fill="none" stroke={col} strokeWidth={1.2} opacity={0.45} strokeDasharray="3,4" style={{ animation: "nf-pulse 2s ease-in-out infinite" }} />}

                  <circle cx={node.canvas_x} cy={node.canvas_y} r={R}
                    fill={fillHex()} stroke={borderCol()} strokeWidth={isSel ? 3 : 2} opacity={un ? 1 : 0.35} />

                  {/* Mastery arc (0–MAX_LEVEL) */}
                  {nl.level > 0 && (
                    <path d={levelArc(node.canvas_x, node.canvas_y, R - 5, nl.level / MAX_LEVEL)}
                      stroke={st === "maxed" ? "#ffd700" : col} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.95} />
                  )}

                  <text x={node.canvas_x} y={node.canvas_y} textAnchor="middle" dominantBaseline="middle" fontSize={un ? 15 : 12} opacity={un ? 1 : 0.25}>
                    {!un ? "🔒" : node.icon}
                  </text>

                  {nl.level > 0 && (
                    <text x={node.canvas_x} y={node.canvas_y + R - 7} textAnchor="middle" fontSize={8}
                      fontFamily={F.mono} fontWeight="bold" fill={st === "maxed" ? "#ffd700" : col}>
                      {nl.level === MAX_LEVEL ? "MAX" : `${nl.level}/${MAX_LEVEL}`}
                    </text>
                  )}

                  {/* Mastery % badge */}
                  {un && nl.avg_mastery > 0 && (
                    <text x={node.canvas_x} y={node.canvas_y + R + 29} textAnchor="middle" fontSize={7.5}
                      fontFamily={F.mono} fill={C.muted} opacity={0.7}>
                      {Math.round(nl.avg_mastery)}%
                    </text>
                  )}

                  {st === "available" && (
                    <g>
                      <circle cx={node.canvas_x + R - 1} cy={node.canvas_y - R + 1} r={9} fill="#0d0d23" stroke={C.purple} strokeWidth={1.5} />
                      <text x={node.canvas_x + R - 1} y={node.canvas_y - R + 2} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill={C.purple} fontFamily={F.mono}>1</text>
                    </g>
                  )}

                  {st === "maxed" && (
                    <text x={node.canvas_x + R} y={node.canvas_y - R + 4} textAnchor="middle" fontSize={11}>⭐</text>
                  )}

                  {isShared && shared.filter(p => p !== path).map((p, bi) => (
                    <g key={p}>
                      <rect x={node.canvas_x - R + 4 + bi * 17} y={node.canvas_y + R + 5} width={14} height={10} rx={2}
                        fill={`${PATH_COL[p]}22`} stroke={PATH_COL[p]} strokeWidth={1} />
                      <text x={node.canvas_x - R + 11 + bi * 17} y={node.canvas_y + R + 12} textAnchor="middle" fontSize={7}
                        fill={PATH_COL[p]} fontFamily={F.mono} fontWeight="bold">{PATH_LBL[p]}</text>
                    </g>
                  ))}

                  <text x={node.canvas_x} y={node.canvas_y + R + (isShared ? 26 : 22)} textAnchor="middle"
                    fontSize={10} fill={un ? C.text : C.muted} fontFamily={F.display} fontWeight={600}>
                    {node.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* ── Detail panel ────────────────────────────────────────────────── */}
        <div style={{ width: 248, flexShrink: 0, ...col_(12) }}>
          {sn && snNL ? (
            <div style={card(col)}>
              {/* Icon + title */}
              <div style={{ textAlign: "center", padding: "14px 0 12px" }}>
                <div style={{ fontSize: 42, marginBottom: 8, filter: snSt === "locked" ? "grayscale(1)" : "none" }}>
                  {snSt !== "locked" ? sn.icon : "🔒"}
                </div>
                <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 700, color: col, marginBottom: 6 }}>{sn.name}</div>
                <div style={{ ...row(4), justifyContent: "center", flexWrap: "wrap" }}>
                  {snSh.map(p => <span key={p} style={{ ...tag(PATH_COL[p], true) as object, fontSize: 9 }}>{PATH_LBL[p]}</span>)}
                </div>
              </div>

              {/* Mastery summary */}
              <div style={{ background: `${col}0d`, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
                <div style={{ ...row(), justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={h3}>Level {snLv}/{MAX_LEVEL}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 11, color: col }}>{Math.round(snNL.avg_mastery)}% avg</span>
                </div>
                {/* Level pips (5) */}
                <div style={{ display: "flex", gap: 4 }}>
                  {Array.from({ length: MAX_LEVEL }).map((_, i) => (
                    <div key={i} style={{
                      flex: 1, height: 6, borderRadius: 3,
                      background: i < snLv ? (snSt === "maxed" ? "#ffd700" : col) : C.border,
                      boxShadow: i < snLv ? `0 0 5px ${col}88` : "none",
                      transition: "all 0.25s",
                    }} />
                  ))}
                </div>
                <div style={{ ...mono(9), marginTop: 5, display: "flex", justifyContent: "space-between" }}>
                  <span>{snNL.mastered_subtopics} subtopics mastered</span>
                  <span style={{ color: C.gold }}>{snNL.xp_invested} XP invested</span>
                </div>
              </div>

              {/* Panel tabs */}
              <div style={{ ...row(0), marginBottom: 10, borderRadius: 7, overflow: "hidden", border: `1px solid ${C.border}` }}>
                {(["subtopics", "resources"] as const).map(tab => (
                  <button key={tab} onClick={() => setPanel(tab)} style={{
                    flex: 1, padding: "6px 0", background: panel === tab ? `${col}22` : "transparent",
                    border: "none", cursor: "pointer", fontFamily: F.display, fontSize: 10,
                    color: panel === tab ? col : C.muted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                    transition: "all 0.15s",
                  }}>
                    {tab === "subtopics" ? "🧩 Topics" : "📚 Resources"}
                  </button>
                ))}
              </div>

              {/* Subtopics panel */}
              {panel === "subtopics" && (
                <div style={col_(0)}>
                  {subtopics.length > 0
                    ? subtopics.map(sub => <SubtopicBar key={sub.id} sub={sub} />)
                    : (
                      <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, textAlign: "center", padding: "12px 0" }}>
                        No subtopics loaded
                      </div>
                    )
                  }
                </div>
              )}

              {/* Resources panel */}
              {panel === "resources" && (
                <div>
                  {resources.length > 0
                    ? resources.map(r => <ResourceItem key={r.id} res={r} />)
                    : (
                      <div style={{ fontFamily: F.body, fontSize: 11, color: C.muted, textAlign: "center", padding: "12px 0" }}>
                        No resources for this node
                      </div>
                    )
                  }
                </div>
              )}

              {/* Description */}
              <p style={{ fontFamily: F.body, fontSize: 11, lineHeight: 1.75, color: C.text2, margin: "14px 0" }}>
                {sn.description}
              </p>

              {/* Prerequisites */}
              {snPre.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={h3}>Requires</div>
                  <div style={{ ...col_(4), marginTop: 5 }}>
                    {snPre.map(pid => {
                      const pn = nodeMap[pid];
                      const met = getNodeLevel(data.levels, pid, path).level >= 1;
                      return (
                        <div key={pid} style={{ ...row(6), fontFamily: F.body, fontSize: 11, color: met ? C.green : C.muted }}>
                          <span>{met ? "✓" : "✗"}</span>
                          <span>{pn?.name ?? pid}</span>
                          {met && <span style={{ fontFamily: F.mono, fontSize: 9, color: C.green, marginLeft: "auto" }}>Lv.{getNodeLevel(data.levels, pid, path).level}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {/* Action buttons */}
              {snSt !== "locked" && (
                <div style={col_(8)}>
                  {/* Practice via AI (Always available if unlocked) */}
                  <button className="nf-btn"
                    onClick={() => api.llmPractice(sn.id, "medium")}
                    style={{
                      width: "100%", padding: "10px", borderRadius: 9,
                      fontFamily: F.display, fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase",
                      border: `2px solid ${col}`, background: `${col}15`, color: col, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8
                    }}>
                    🧠 Practice this skill
                  </button>

                  {/* SP boost (Hidden if Maxed) */}
                  {snLv < MAX_LEVEL ? (
                    <button className="nf-btn"
                      disabled={sp < 1 || boosting}
                      onClick={handleBoost}
                      style={{
                        width: "100%", padding: "10px", borderRadius: 9,
                        // ... rest of your boost button styles
                      }}>
                      {boosting ? "Boosting…" : sp >= 1 ? "⬡ SP Boost (+15 mastery) — 1 SP" : "⬡ Need More SP"}
                    </button>
                  ) : (
                    <div style={{ textAlign: "center", padding: 10, fontFamily: F.display, fontSize: 13, color: "#ffd700", fontWeight: 700, letterSpacing: 1 }}>
                      ⭐ SKILL MASTERED ⭐
                    </div>
                  )}
                </div>
              )}

              {/* Locked state message */}
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
                Click an <span style={{ color: col }}>unlocked node</span> to inspect subtopics, practice, and level up.
              </div>
              <div style={{ ...mono(10), marginTop: 14 }}>
                <span style={{ color: C.purple }}>{sp} SP</span> available
              </div>
            </div>
          )}

          {/* Path summary */}
          <div style={card()}>
            <div style={h3}>Path Progress</div>
            <div style={{ fontFamily: F.mono, fontSize: 26, color: col, fontWeight: 700, margin: "6px 0" }}>{prog}%</div>
            <div style={bar}><div style={fill(prog, col)} className="nf-bar-fill" /></div>
            <div style={{ ...mono(10), marginTop: 8 }}>
              {nodes.filter(n => n.path_id === path && getNodeLevel(data.levels, n.id, path).level > 0).length}/{nodes.filter(n => n.path_id === path).length} skills started
            </div>
            <div style={mono(10)}>
              {nodes.filter(n => n.path_id === path && getNodeLevel(data.levels, n.id, path).level >= MAX_LEVEL).length} mastered
            </div>
            <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10, fontFamily: F.mono, fontSize: 9, color: C.muted, lineHeight: 2 }}>
              <span style={{ color: C.gold }}>EARN MASTERY</span><br />
              Practice problems → +8 mastery<br />
              SR review (quality 5) → +6 mastery<br />
              Grind session → up to +20 mastery<br />
              SP boost → +15 all subtopics
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type Props = Pick<UseGameState, "user" | "skillNodes" | "loadSkillPath" | "levelUpSkill">;