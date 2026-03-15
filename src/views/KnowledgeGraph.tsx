// ============================================================
// Neural Forge — src/components/KnowledgeGraph.tsx
// D3 force-directed knowledge graph:
// skill nodes + vault notes + concept links.
// Click to inspect, drag to rearrange, scroll to zoom.
// ============================================================

import { useEffect, useRef, useState } from "react";
// 'invoke' ahora vive en el core
import { invoke } from "@tauri-apps/api/core";
import { C, F } from "../tokens";

interface GraphNode {
  id: string;
  label: string;
  type: "skill" | "note" | "concept" | "paper" | "project";
  path_id?: string;
  weight: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  weight: number;
}

const TYPE_COL: Record<string, string> = {
  skill: C.accent, note: C.teal, concept: C.gold,
  paper: C.purple, project: C.green,
};
const TYPE_ICON: Record<string, string> = {
  skill: "⬡", note: "📓", concept: "💡", paper: "📄", project: "🗂",
};
const PATH_COL: Record<string, string> = { mle: C.mle, de: C.de, ds: C.ds };

const EDGE_COL: Record<string, string> = {
  prerequisite: "#ffffff18", related: "#00e5ff22",
  covers: "#ffc10722", cites: "#9b59ff22",
  part_of: "#00ff8822",
};

// ── Mock data for preview ─────────────────────────────────────────────────────
const MOCK_GRAPH = {
  nodes: [
    { id: "python", label: "Python", type: "skill", path_id: "mle", weight: 40 },
    { id: "pytorch", label: "PyTorch", type: "skill", path_id: "mle", weight: 40 },
    { id: "nn", label: "Neural Nets", type: "skill", path_id: "mle", weight: 30 },
    { id: "transformers", label: "Transformers", type: "skill", path_id: "mle", weight: 20 },
    { id: "stats", label: "Statistics", type: "skill", path_id: "mle", weight: 20 },
    { id: "numpy", label: "NumPy", type: "skill", path_id: "mle", weight: 30 },
    { id: "cuda", label: "CUDA/GPU", type: "skill", path_id: "mle", weight: 10 },
    { id: "n1", label: "Attention Is All You Need", type: "paper", weight: 25 },
    { id: "n2", label: "PyTorch Notes", type: "note", weight: 15 },
    { id: "n3", label: "Backprop Intuition", type: "note", weight: 12 },
    { id: "n4", label: "ML System Design", type: "project", weight: 20 },
    { id: "n5", label: "NLP Basics", type: "concept", weight: 18 },
  ],
  edges: [
    { source: "python", target: "pytorch", type: "prerequisite", weight: 1.5 },
    { source: "numpy", target: "pytorch", type: "prerequisite", weight: 1.2 },
    { source: "stats", target: "nn", type: "prerequisite", weight: 1.0 },
    { source: "pytorch", target: "nn", type: "prerequisite", weight: 1.5 },
    { source: "nn", target: "transformers", type: "prerequisite", weight: 1.3 },
    { source: "nn", target: "cuda", type: "related", weight: 0.8 },
    { source: "n1", target: "transformers", type: "covers", weight: 1.0 },
    { source: "n2", target: "pytorch", type: "covers", weight: 0.9 },
    { source: "n3", target: "nn", type: "covers", weight: 0.8 },
    { source: "n4", target: "pytorch", type: "part_of", weight: 0.7 },
    { source: "n5", target: "transformers", type: "related", weight: 0.6 },
  ],
};

export default function KnowledgeGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<any>(null);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [rebuilding, setRebuilding] = useState(false);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });

  const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI__;

  // ── Load graph ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const data = isTauri
          ? await invoke<any>("kg_get_graph")
          : MOCK_GRAPH;
        const d = data.nodes?.length ? data : MOCK_GRAPH;
        setGraphData(d);
        setStats({ nodes: d.nodes.length, edges: d.edges.length });
      } catch {
        setGraphData(MOCK_GRAPH);
        setStats({ nodes: MOCK_GRAPH.nodes.length, edges: MOCK_GRAPH.edges.length });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── D3 simulation ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!graphData || !svgRef.current) return;

    const svg = svgRef.current;
    const W = svg.clientWidth || 900;
    const H = svg.clientHeight || 640;

    // Clear
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Filter nodes
    const nodes: GraphNode[] = graphData.nodes
      .filter(n => filter === "all" || n.type === filter)
      .map(n => ({ ...n, x: W / 2 + (Math.random() - 0.5) * 300, y: H / 2 + (Math.random() - 0.5) * 300 }));

    const nodeIds = new Set(nodes.map(n => n.id));
    const edges: GraphEdge[] = graphData.edges.filter(
      e => nodeIds.has(e.source as string) && nodeIds.has(e.target as string)
    );

    // ── Build SVG structure ───────────────────────────────────────────────────
    const NS = "http://www.w3.org/2000/svg";
    const mk = (tag: string, attrs: Record<string, any>) => {
      const el = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
      return el;
    };

    // Defs: arrow markers + glow filter
    const defs = mk("defs", {});
    const arrowTypes = ["prerequisite", "related", "covers", "cites", "part_of"];
    arrowTypes.forEach(t => {
      const m = mk("marker", { id: `arrow-${t}`, markerWidth: 8, markerHeight: 6, refX: 16, refY: 3, orient: "auto" });
      const p = mk("polygon", { points: "0 0,8 3,0 6", fill: EDGE_COL[t]?.replace("22", "66").replace("18", "44") ?? "#ffffff33" });
      m.appendChild(p); defs.appendChild(m);
    });
    // Glow filter
    const filter_el = mk("filter", { id: "glow", x: "-20%", y: "-20%", width: "140%", height: "140%" });
    const blur = mk("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "3", result: "blur" });
    const merge_el = mk("feMerge", {});
    const mn1 = mk("feMergeNode", { in: "blur" });
    const mn2 = mk("feMergeNode", { in: "SourceGraphic" });
    merge_el.appendChild(mn1); merge_el.appendChild(mn2);
    filter_el.appendChild(blur); filter_el.appendChild(merge_el);
    defs.appendChild(filter_el);
    svg.appendChild(defs);

    // Zoom/pan group
    const g = mk("g", { class: "graph-root" });
    svg.appendChild(g);

    // Edge group
    const edgeG = mk("g", { class: "edges" });
    g.appendChild(edgeG);

    // Node group
    const nodeG = mk("g", { class: "nodes" });
    g.appendChild(nodeG);

    // ── Resolve node lookup ───────────────────────────────────────────────────
    const nodeMap: Record<string, GraphNode> = {};
    nodes.forEach(n => { nodeMap[n.id] = n; });

    const resolvedEdges = edges
      .map(e => ({
        ...e,
        source: nodeMap[e.source as string],
        target: nodeMap[e.target as string],
      }))
      .filter((e): e is GraphEdge & { source: GraphNode; target: GraphNode } => Boolean(e.source && e.target));

    // ── Draw edges ────────────────────────────────────────────────────────────
    const edgeEls: SVGLineElement[] = resolvedEdges.map(e => {
      const line = mk("line", {
        stroke: EDGE_COL[e.type] ?? "#ffffff15",
        "stroke-width": Math.max(0.5, (e.weight ?? 1) * 1.2),
        "marker-end": `url(#arrow-${e.type})`,
        opacity: 0.7,
      }) as SVGLineElement;
      edgeG.appendChild(line);
      return line;
    });

    // ── Draw nodes ────────────────────────────────────────────────────────────
    const nodeEls: SVGGElement[] = nodes.map(n => {
      const col = n.path_id ? (PATH_COL[n.path_id] ?? TYPE_COL[n.type]) : TYPE_COL[n.type];
      const r = Math.max(12, Math.min(32, Math.sqrt(n.weight) * 4));
      const icon = TYPE_ICON[n.type] ?? "●";

      const grp = mk("g", { class: "node", style: "cursor:pointer" }) as SVGGElement;

      // Outer glow ring
      const glow = mk("circle", { r: r + 6, fill: "none", stroke: col, "stroke-width": 1, opacity: 0.2 });
      // Main circle
      const circle = mk("circle", {
        r, fill: `${col}22`, stroke: col, "stroke-width": 2,
        filter: "url(#glow)", style: "transition:all 0.2s ease",
      });
      // Label
      const label = mk("text", {
        "text-anchor": "middle", dy: r + 14, fill: col,
        "font-family": "'Rajdhani',sans-serif", "font-size": 10, "font-weight": 700,
        "letter-spacing": 0.5,
      });
      label.textContent = n.label.length > 14 ? n.label.slice(0, 13) + "…" : n.label;

      // Icon
      const iconEl = mk("text", {
        "text-anchor": "middle", dy: 4, fill: col,
        "font-size": r * 0.7, opacity: 0.9,
      });
      iconEl.textContent = icon;

      grp.appendChild(glow); grp.appendChild(circle);
      grp.appendChild(iconEl); grp.appendChild(label);
      nodeG.appendChild(grp);

      // Click to select
      grp.addEventListener("click", (evt) => {
        evt.stopPropagation();
        setSelected(n);
        // Highlight
        circle.setAttribute("stroke-width", "3");
        circle.setAttribute("fill", `${col}44`);
      });

      // Drag
      let dragging = false;
      let dragStart = { x: 0, y: 0 };
      grp.addEventListener("mousedown", (evt) => {
        dragging = true;
        dragStart = { x: evt.clientX - (n.x ?? 0), y: evt.clientY - (n.y ?? 0) };
        n.fx = n.x; n.fy = n.y;
        evt.preventDefault();
      });
      window.addEventListener("mousemove", (evt) => {
        if (!dragging) return;
        n.fx = evt.clientX - dragStart.x;
        n.fy = evt.clientY - dragStart.y;
        tick();
      });
      window.addEventListener("mouseup", () => {
        if (dragging) { dragging = false; n.fx = null; n.fy = null; }
      });

      return grp;
    });

    // ── Click background to deselect ──────────────────────────────────────────
    svg.addEventListener("click", () => setSelected(null));

    // ── Force simulation (vanilla — no D3 import needed) ─────────────────────
    const REPULSION = -2000;
    const LINK_DIST = 130;
    const CENTER_PULL = 0.04;
    const DAMPING = 0.85;

    function applyForces() {
      // Repulsion (O(n²) — fine for <200 nodes)
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].vx = (nodes[i].vx ?? 0) * DAMPING;
        nodes[i].vy = (nodes[i].vy ?? 0) * DAMPING;
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = (nodes[j].x ?? 0) - (nodes[i].x ?? 0);
          const dy = (nodes[j].y ?? 0) - (nodes[i].y ?? 0);
          const d = Math.max(10, Math.sqrt(dx * dx + dy * dy));
          const f = REPULSION / (d * d);
          nodes[i].vx! -= (dx / d) * f;
          nodes[i].vy! -= (dy / d) * f;
          nodes[j].vx! += (dx / d) * f;
          nodes[j].vy! += (dy / d) * f;
        }
      }

      // Link attraction
      resolvedEdges.forEach(e => {
        const s = e.source as GraphNode;
        const t = e.target as GraphNode;
        if (!s || !t) return;
        const dx = (t.x ?? 0) - (s.x ?? 0);
        const dy = (t.y ?? 0) - (s.y ?? 0);
        const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const f = (d - LINK_DIST) * 0.03 * (e.weight ?? 1);
        s.vx! += (dx / d) * f;
        s.vy! += (dy / d) * f;
        t.vx! -= (dx / d) * f;
        t.vy! -= (dy / d) * f;
      });

      // Center gravity
      nodes.forEach(n => {
        n.vx! += (W / 2 - (n.x ?? 0)) * CENTER_PULL;
        n.vy! += (H / 2 - (n.y ?? 0)) * CENTER_PULL;

        if (n.fx !== null && n.fx !== undefined) { n.x = n.fx; n.vx = 0; }
        else n.x = (n.x ?? 0) + n.vx!;

        if (n.fy !== null && n.fy !== undefined) { n.y = n.fy; n.vy = 0; }
        else n.y = (n.y ?? 0) + n.vy!;
      });
    }

    function tick() {
      applyForces();
      // Update edge positions
      resolvedEdges.forEach((e, i) => {
        const s = e.source as GraphNode;
        const t = e.target as GraphNode;
        edgeEls[i].setAttribute("x1", String(s.x ?? 0));
        edgeEls[i].setAttribute("y1", String(s.y ?? 0));
        edgeEls[i].setAttribute("x2", String(t.x ?? 0));
        edgeEls[i].setAttribute("y2", String(t.y ?? 0));
      });
      // Update node positions
      nodes.forEach((n, i) => {
        nodeEls[i].setAttribute("transform", `translate(${n.x ?? 0},${n.y ?? 0})`);
      });
    }

    let frame: number;
    let iterations = 0;
    function animate() {
      if (iterations < 300) { tick(); iterations++; }
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    simRef.current = { stop: () => cancelAnimationFrame(frame) };

    // ── Zoom & pan ────────────────────────────────────────────────────────────
    let scale = 1, tx = 0, ty = 0;
    let panning = false, panStart = { x: 0, y: 0 };

    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      scale = Math.max(0.2, Math.min(4, scale * delta));
      g.setAttribute("transform", `translate(${tx},${ty}) scale(${scale})`);
    }, { passive: false });

    svg.addEventListener("mousedown", (e) => {
      if ((e.target as Element).closest(".node")) return;
      panning = true; panStart = { x: e.clientX - tx, y: e.clientY - ty };
    });
    window.addEventListener("mousemove", (e) => {
      if (!panning) return;
      tx = e.clientX - panStart.x; ty = e.clientY - panStart.y;
      g.setAttribute("transform", `translate(${tx},${ty}) scale(${scale})`);
    });
    window.addEventListener("mouseup", () => { panning = false; });

    return () => { if (simRef.current) simRef.current.stop(); };
  }, [graphData, filter]);

  const rebuild = async () => {
    setRebuilding(true);
    try {
      await invoke("kg_rebuild");
      const data = await invoke<any>("kg_get_graph");
      setGraphData(data);
      setStats({ nodes: data.nodes.length, edges: data.edges.length });
    } catch { } finally { setRebuilding(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontFamily: F.mono, color: C.gold, fontSize: 10, letterSpacing: 4, marginBottom: 4 }}>// KNOWLEDGE GRAPH</div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const, fontFamily: F.display }}>Knowledge Graph</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Filter */}
          {["all", "skill", "note", "paper", "project"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${filter === f ? C.gold : C.border}`, background: filter === f ? `${C.gold}18` : "transparent", color: filter === f ? C.gold : C.muted, cursor: "pointer", fontFamily: F.display, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "capitalize" as const }}>
              {f === "all" ? "All" : TYPE_ICON[f] + " " + f}
            </button>
          ))}
          <button onClick={rebuild} disabled={rebuilding}
            style={{ padding: "7px 16px", borderRadius: 7, border: `1px solid ${C.accent}55`, background: `${C.accent}18`, color: C.accent, cursor: "pointer", fontFamily: F.display, fontSize: 12, fontWeight: 700, letterSpacing: 1, opacity: rebuilding ? 0.5 : 1 }}>
            {rebuilding ? "⏳ Rebuilding…" : "↻ Rebuild"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 16 }}>
        {[
          { v: stats.nodes, l: "Nodes", col: C.accent },
          { v: stats.edges, l: "Connections", col: C.gold },
          { v: graphData?.nodes.filter(n => n.type === "skill").length ?? 0, l: "Skills", col: C.mle },
          { v: graphData?.nodes.filter(n => n.type === "note").length ?? 0, l: "Notes", col: C.teal },
        ].map(({ v, l, col }) => (
          <div key={l} style={{ padding: "8px 14px", borderRadius: 8, background: C.surface, border: `1px solid ${col}22` }}>
            <span style={{ fontFamily: F.mono, fontSize: 18, color: col, fontWeight: 700 }}>{v}</span>
            <span style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 2, textTransform: "uppercase", marginLeft: 8 }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Graph + panel */}
      <div style={{ display: "flex", gap: 14, flex: 1, minHeight: 520 }}>
        {/* Canvas */}
        <div ref={containerRef} style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", position: "relative" }}>
          {loading && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.mono, color: C.muted, letterSpacing: 3, fontSize: 11, animation: "nf-pulse 1s ease-in-out infinite" }}>
              BUILDING GRAPH…
            </div>
          )}
          <svg ref={svgRef} width="100%" height="100%" style={{ cursor: "grab", userSelect: "none" }} />

          {/* Legend */}
          <div style={{ position: "absolute", bottom: 16, left: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {Object.entries(TYPE_COL).map(([t, c]) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 6, background: `${c}0a`, border: `1px solid ${c}22` }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
                <span style={{ fontFamily: F.display, fontSize: 9, color: c, letterSpacing: 1, textTransform: "capitalize" }}>{t}</span>
              </div>
            ))}
          </div>

          {/* Controls hint */}
          <div style={{ position: "absolute", bottom: 16, right: 16, fontFamily: F.mono, fontSize: 9, color: C.dim, textAlign: "right" }}>
            Scroll to zoom · Drag nodes · Click to inspect
          </div>
        </div>

        {/* Node detail panel */}
        {selected && (
          <div style={{ width: 240, background: C.surface, border: `1px solid ${TYPE_COL[selected.type] ?? C.accent}33`, borderRadius: 14, padding: 20, animation: "nf-fadein 0.2s ease", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, color: TYPE_COL[selected.type] ?? C.accent, letterSpacing: 3 }}>
              {TYPE_ICON[selected.type]} {selected.type.toUpperCase()}
            </div>
            <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 700, color: C.text, lineHeight: 1.4 }}>
              {selected.label}
            </div>
            {selected.path_id && (
              <div style={{ padding: "3px 9px", borderRadius: 5, background: `${PATH_COL[selected.path_id]}18`, color: PATH_COL[selected.path_id], fontFamily: F.display, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, display: "inline-block" }}>
                {selected.path_id.toUpperCase()}
              </div>
            )}
            <div style={{ fontFamily: F.body, fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
              <div>Weight: <span style={{ color: C.gold }}>{selected.weight.toFixed(1)}</span></div>
              <div>Connections: <span style={{ color: C.accent }}>
                {graphData?.edges.filter(e => e.source === selected.id || e.target === selected.id).length ?? 0}
              </span></div>
            </div>
            {/* Linked nodes */}
            <div>
              <div style={{ fontFamily: F.display, fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>CONNECTED TO</div>
              {graphData?.edges
                .filter(e => e.source === selected.id || e.target === selected.id)
                .slice(0, 6)
                .map((e, i) => {
                  const otherId = e.source === selected.id ? e.target as string : e.source as string;
                  const other = graphData.nodes.find(n => n.id === otherId);
                  if (!other) return null;
                  return (
                    <div key={i} style={{ fontFamily: F.body, fontSize: 11, color: C.text2, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: TYPE_COL[other.type] }}>{TYPE_ICON[other.type]}</span>
                      <span style={{ cursor: "pointer" }} onClick={() => setSelected(other)}>{other.label}</span>
                      <span style={{ fontFamily: F.mono, fontSize: 9, color: C.muted, marginLeft: "auto" }}>{e.type}</span>
                    </div>
                  );
                })}
            </div>
            <button onClick={() => setSelected(null)}
              style={{ marginTop: "auto", padding: "7px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer", fontFamily: F.display, fontSize: 11, fontWeight: 700 }}>
              Close ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
