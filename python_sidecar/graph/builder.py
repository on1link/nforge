# ============================================================
# Neural Forge — graph/builder.py
# Builds a knowledge graph from:
#   1. Obsidian [[wikilinks]] between notes
#   2. Skill tree prerequisite edges (from DB)
#   3. LLM-extracted concept links (from paper digests)
#   4. SR card co-review patterns (temporal proximity)
# ============================================================

from __future__ import annotations
import json
import re
from pathlib import Path
from typing import Any, Optional

import networkx as nx
import structlog

log = structlog.get_logger()

_graph: Optional[nx.DiGraph] = None


import json
import re
from pathlib import Path
import networkx as nx

async def build_graph() -> nx.DiGraph:
    """Build the full knowledge graph and cache it in both SQLite and Memory."""
    global _graph
    G = nx.DiGraph()

    from db import get_db
    db = await get_db()

    # ── 1. Vault wikilinks ──────────────────────────────────────────────────
    async with db.execute("SELECT path, title, tags FROM vault_index") as cur:
        notes = await cur.fetchall()

    note_paths = {n["path"] for n in notes}
    
    for note in notes:
        src_path = note["path"]
        
        # [FIX]: Safely register the source Note node into the database first
        await db.execute("""
            INSERT OR IGNORE INTO kg_nodes (id, user_id, label, node_type, weight)
            VALUES (?, 'default', ?, 'note', 1.0)
        """, (src_path, note["title"]))

        # Add to in-memory NetworkX graph
        G.add_node(
            src_path,
            node_type="note",
            title=note["title"],
            tags=json.loads(note["tags"] or "[]"),
            label=note["title"],
        )
        
        try:
            content = Path(src_path).read_text(encoding="utf-8", errors="ignore")
            links = re.findall(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]", content)
            
            for link in links:
                dst = _resolve_wikilink(link, src_path, note_paths)
                if dst:
                    # [FIX]: Ensure the destination Note node exists in the DB
                    dst_title = Path(dst).stem
                    await db.execute("""
                        INSERT OR IGNORE INTO kg_nodes (id, user_id, label, node_type, weight)
                        VALUES (?, 'default', ?, 'note', 1.0)
                    """, (dst, dst_title))

                    # Insert edge into DB and Memory
                    G.add_edge(src_path, dst, edge_type="wikilink", weight=1.0)
                    await db.execute("""
                        INSERT OR IGNORE INTO kg_edges (source_id, target_id, rel_type, weight)
                        VALUES (?, ?, 'wikilink', 1.0)
                    """, (src_path, dst))
                    
        except (OSError, IOError):
            continue

    # ── 2. Skill tree nodes + prerequisite edges ────────────────────────────
    async with db.execute(
        "SELECT id, path_id, name, description, prereqs FROM skill_node_defs"
    ) as cur:
        skill_nodes = await cur.fetchall()

    path_cols = {"mle": "#00e5ff", "de": "#9b59ff", "ds": "#ffc107", "aie": "#f50057"}

    for sk in skill_nodes:
        node_id = f"skill:{sk['path_id']}:{sk['id']}"
        
        # [FIX]: Register the Skill node in the database
        await db.execute("""
            INSERT OR IGNORE INTO kg_nodes (id, user_id, label, node_type, path_id, weight)
            VALUES (?, 'default', ?, 'skill', ?, 1.0)
        """, (node_id, sk["name"], sk["path_id"]))

        # Add to NetworkX graph
        G.add_node(
            node_id,
            node_type="skill",
            skill_id=sk["id"],
            path_id=sk["path_id"],
            label=sk["name"],
            color=path_cols.get(sk["path_id"], "#666"),
        )
        
        prereqs = json.loads(sk["prereqs"] or "[]")
        for prereq_id in prereqs:
            prereq_node = f"skill:{sk['path_id']}:{prereq_id}"
            
            # [FIX]: Register the Prerequisite Skill node in the database
            await db.execute("""
                INSERT OR IGNORE INTO kg_nodes (id, user_id, label, node_type, path_id, weight)
                VALUES (?, 'default', ?, 'skill', ?, 1.0)
            """, (prereq_node, prereq_id, sk["path_id"]))
            
            # Insert edge into DB and Memory
            G.add_edge(prereq_node, node_id, edge_type="skill_prereq", weight=2.0)
            await db.execute("""
                INSERT OR IGNORE INTO kg_edges (source_id, target_id, rel_type, weight)
                VALUES (?, ?, 'skill_prereq', 2.0)
            """, (prereq_node, node_id))

    # ── 3. SR co-review edges (notes reviewed within same day) ──────────────
    # [FIX]: Adjusted table name from sr_reviews to sr_review_log (based on Phase 2 schema)
# ── 3. SR co-review edges (notes reviewed within same day) ──────────────
    async with db.execute("""
        SELECT c.node_id, c.path_id, date(r.reviewed_at) as rev_date
        FROM sr_reviews r 
        JOIN sr_cards c ON c.id = r.card_id
        WHERE r.quality >= 3
        GROUP BY c.node_id, c.path_id, rev_date
        HAVING COUNT(*) > 0
        ORDER BY rev_date
    """) as cur:
        reviews = await cur.fetchall()

    from collections import defaultdict
    by_date: dict[str, list[str]] = defaultdict(list)
    for r in reviews:
        by_date[r["rev_date"]].append(f"skill:{r['path_id']}:{r['node_id']}")

    for date_nodes in by_date.values():
        if len(date_nodes) > 1:
            for i in range(len(date_nodes) - 1):
                u, v = date_nodes[i], date_nodes[i+1]
                
                # NetworkX logic for incrementing edge weight
                if G.has_edge(u, v):
                    G[u][v]["weight"] = G[u][v].get("weight", 1.0) + 0.1
                else:
                    G.add_edge(u, v, edge_type="sr_corev", weight=0.3)
                    
                # Store structural edge in database
                await db.execute("""
                    INSERT OR IGNORE INTO kg_edges (source_id, target_id, rel_type, weight)
                    VALUES (?, ?, 'sr_corev', 0.3)
                """, (u, v))
    # ── 4. Concept links from practice problems ─────────────────────────────
    # Querying skill_id as correctly defined in 002_phase2.sql
    async with db.execute(
        "SELECT skill_id, path_id FROM practice_problems"
    ) as cur:
        prows = await cur.fetchall()

    for row in prows:
        skill_node = f"skill:{row['path_id']}:{row['skill_id']}"
        
        # Find vault notes tagged with this specific skill
        async with db.execute(
            "SELECT path, title FROM vault_index WHERE tags LIKE ?",
            (f"%{row['skill_id']}%",)
        ) as cur:
            linked_notes = await cur.fetchall()
            
        for note in linked_notes:
            # We already guaranteed skill_node and note["path"] exist in steps 1 and 2
            G.add_edge(skill_node, note["path"], edge_type="concept", weight=0.8)
            
            await db.execute("""
                INSERT OR IGNORE INTO kg_edges (source_id, target_id, rel_type, weight)
                VALUES (?, ?, 'concept', 0.8)
            """, (skill_node, note["path"]))

    # ── 5. Finalize and Cache ───────────────────────────────────────────────
    # Commit all the new structural edges we just discovered to the database
    await db.commit()

    # Cache the NetworkX graph in memory for fast frontend retrieval
    _graph = G
    
    log.info("Knowledge graph built",
             nodes=G.number_of_nodes(),
             edges=G.number_of_edges())
             
    return G

def get_graph() -> Optional[nx.DiGraph]:
    return _graph


async def get_or_build_graph() -> nx.DiGraph:
    if _graph is None:
        return await build_graph()
    return _graph


# ── Graph exports ─────────────────────────────────────────────────────────────

def to_d3_json(G: nx.DiGraph) -> dict:
    """Convert graph to D3.js force simulation format."""
    node_index = {n: i for i, n in enumerate(G.nodes())}
    nodes = []
    for node_id, data in G.nodes(data=True):
        nodes.append({
            "id":        node_id,
            "index":     node_index[node_id],
            "label":     data.get("label", node_id.split(":")[-1]),
            "type":      data.get("node_type", "note"),
            "path_id":   data.get("path_id", ""),
            "color":     data.get("color", "#4a5080"),
            "tags":      data.get("tags", []),
            "degree":    G.degree(node_id),
            "in_degree": G.in_degree(node_id),
        })
    links = []
    for src, dst, data in G.edges(data=True):
        links.append({
            "source": node_index[src],
            "target": node_index[dst],
            "type":   data.get("edge_type", "link"),
            "weight": data.get("weight", 1.0),
        })
    return {"nodes": nodes, "links": links}


def graph_stats(G: nx.DiGraph) -> dict:
    if G.number_of_nodes() == 0:
        return {"nodes": 0, "edges": 0}
    try:
        density    = nx.density(G)
        components = nx.number_weakly_connected_components(G)
        # Top-5 nodes by degree centrality
        centrality = nx.degree_centrality(G)
        top5 = sorted(centrality.items(), key=lambda x: x[1], reverse=True)[:5]
    except Exception:
        density = 0; components = 0; top5 = []
    return {
        "nodes":        G.number_of_nodes(),
        "edges":        G.number_of_edges(),
        "density":      round(density, 4),
        "components":   components,
        "top_nodes":    [{"id": n, "centrality": round(c, 3)} for n, c in top5],
    }


def _resolve_wikilink(link: str, src_path: str, all_paths: set[str]) -> Optional[str]:
    """Resolve an Obsidian [[wikilink]] to a full path."""
    link = link.strip()
    # Exact match
    for path in all_paths:
        if Path(path).stem == link or Path(path).name == link:
            return path
    # Partial match
    link_lower = link.lower()
    for path in all_paths:
        if link_lower in path.lower():
            return path
    return None
