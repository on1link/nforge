# ============================================================
# Neural Forge — graph/router.py
# Knowledge graph API endpoints
# ============================================================

from __future__ import annotations
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

from .builder import build_graph, get_or_build_graph, to_d3_json, graph_stats

router = APIRouter()


@router.get("/data")
async def get_graph_data():
    """Return full graph as D3.js JSON."""
    G    = await get_or_build_graph()
    data = to_d3_json(G)
    return data


@router.get("/stats")
async def get_graph_stats():
    G = await get_or_build_graph()
    return graph_stats(G)


@router.get("/neighbours/{node_id:path}")
async def get_neighbours(node_id: str, depth: int = 2):
    """Return subgraph around a node up to given depth."""
    import networkx as nx
    G = await get_or_build_graph()
    if node_id not in G:
        return {"nodes": [], "links": []}
    # BFS up to depth
    sub_nodes = set([node_id])
    frontier  = {node_id}
    for _ in range(depth):
        new_frontier = set()
        for n in frontier:
            new_frontier.update(G.predecessors(n))
            new_frontier.update(G.successors(n))
        sub_nodes.update(new_frontier)
        frontier = new_frontier
    subgraph = G.subgraph(sub_nodes)
    return to_d3_json(subgraph)


@router.post("/rebuild")
async def rebuild_graph(background_tasks: BackgroundTasks):
    """Rebuild graph from scratch (background)."""
    background_tasks.add_task(build_graph)
    return {"status": "rebuild started"}


@router.get("/path")
async def find_path(src: str, dst: str):
    """Find shortest path between two nodes."""
    import networkx as nx
    G = await get_or_build_graph()
    try:
        path = nx.shortest_path(G, src, dst)
        return {"path": path, "length": len(path) - 1}
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return {"path": [], "error": "No path found"}


@router.get("/export/graphml")
async def export_graphml():
    """Export graph as GraphML XML string."""
    import io
    import networkx as nx
    from fastapi.responses import Response
    G = await get_or_build_graph()
    buf = io.BytesIO()
    nx.write_graphml(G, buf)
    return Response(content=buf.getvalue(), media_type="application/xml",
                    headers={"Content-Disposition": "attachment; filename=neural-forge-graph.graphml"})
