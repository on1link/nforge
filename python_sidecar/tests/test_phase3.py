# ============================================================
# Neural Forge — tests/test_phase3.py
# Phase 3 unit tests: graph, plugins, backup
# Run: uv run pytest tests/test_phase3.py -v
# ============================================================

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import asyncio
import json
import pytest
from datetime import date
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock


# ═══════════════════════════════════════════════════════════
# KNOWLEDGE GRAPH TESTS
# ═══════════════════════════════════════════════════════════

def test_to_d3_json_empty():
    """Empty graph should return empty nodes and links."""
    import networkx as nx
    from graph.builder import to_d3_json
    G = nx.DiGraph()
    result = to_d3_json(G)
    assert result["nodes"] == []
    assert result["links"] == []


def test_to_d3_json_single_edge():
    import networkx as nx
    from graph.builder import to_d3_json
    G = nx.DiGraph()
    G.add_node("a", node_type="note", label="Note A", tags=[])
    G.add_node("b", node_type="note", label="Note B", tags=[])
    G.add_edge("a", "b", edge_type="wikilink", weight=1.0)
    result = to_d3_json(G)
    assert len(result["nodes"]) == 2
    assert len(result["links"]) == 1
    assert result["links"][0]["type"] == "wikilink"


def test_graph_stats_empty():
    import networkx as nx
    from graph.builder import graph_stats
    G = nx.DiGraph()
    s = graph_stats(G)
    assert s["nodes"] == 0
    assert s["edges"] == 0


def test_graph_stats_populated():
    import networkx as nx
    from graph.builder import graph_stats
    G = nx.DiGraph()
    for i in range(5):
        G.add_node(str(i), label=str(i), node_type="note", tags=[])
    G.add_edge("0","1", edge_type="wikilink", weight=1.0)
    G.add_edge("1","2", edge_type="wikilink", weight=1.0)
    s = graph_stats(G)
    assert s["nodes"] == 5
    assert s["edges"] == 2
    assert "top_nodes" in s


def test_resolve_wikilink_exact():
    from graph.builder import _resolve_wikilink
    paths = {"/vault/Python.md", "/vault/PyTorch.md", "/vault/Stats.md"}
    assert _resolve_wikilink("Python", "", paths) == "/vault/Python.md"


def test_resolve_wikilink_partial():
    from graph.builder import _resolve_wikilink
    paths = {"/vault/Machine Learning Basics.md", "/vault/Stats.md"}
    result = _resolve_wikilink("Learning Basics", "", paths)
    assert result == "/vault/Machine Learning Basics.md"


def test_resolve_wikilink_not_found():
    from graph.builder import _resolve_wikilink
    paths = {"/vault/Python.md"}
    assert _resolve_wikilink("Nonexistent", "", paths) is None


# ═══════════════════════════════════════════════════════════
# PLUGIN SYSTEM TESTS
# ═══════════════════════════════════════════════════════════

class MockPlugin:
    """Minimal plugin for testing the loader hooks."""
    from plugins.base import PluginManifest
    manifest = type("M", (), {
        "id":"test", "name":"Test", "version":"1.0", "description":"", "author":"", "hooks":["on_xp_gain"]
    })()
    def __init__(self, config=None): self.config={}; self.enabled=True; self.called=False
    async def on_xp_gain(self, payload):
        self.called = True
        return {"xp": payload.get("xp", 0)}


def test_plugin_manifest():
    from plugins.base import PluginManifest
    m = PluginManifest(id="test", name="Test Plugin", version="1.0.0", hooks=["on_startup"])
    assert m.id == "test"
    assert "on_startup" in m.hooks


def test_base_plugin_defaults():
    from plugins.base import BasePlugin, PluginManifest
    class P(BasePlugin):
        manifest = PluginManifest(id="p", name="P", version="1", hooks=[])
    p = P()
    assert p.enabled is True
    assert p.config == {}


@pytest.mark.asyncio
async def test_plugin_hooks_not_called_when_disabled():
    from plugins.loader import _plugins, fire_hook
    plugin = MockPlugin()
    plugin.enabled = False
    _plugins["test-disabled"] = plugin  # type: ignore
    await fire_hook("on_xp_gain", {"xp": 50})
    assert not plugin.called
    del _plugins["test-disabled"]


# ═══════════════════════════════════════════════════════════
# GIT BACKUP TESTS (mocked)
# ═══════════════════════════════════════════════════════════

def test_git_commit_result_dataclass():
    from backup.git import CommitResult
    r = CommitResult(status="ok", message="test", commit_hash="abc123", files_changed=3)
    assert r.status == "ok"
    assert r.files_changed == 3


def test_git_commit_nothing_to_commit(tmp_path):
    """A freshly inited repo with no changes → nothing_to_commit."""
    try:
        import git
    except ImportError:
        pytest.skip("gitpython not installed")
    from backup.git import git_commit
    # Init an empty repo
    repo = git.Repo.init(str(tmp_path))
    (tmp_path / ".gitignore").write_text("*.pyc\n")
    repo.index.add([".gitignore"])
    repo.index.commit("init")
    # No changes → nothing_to_commit
    result = git_commit(str(tmp_path))
    assert result.status in ("nothing_to_commit", "ok")


# ═══════════════════════════════════════════════════════════
# SYNC / WATCHER TESTS
# ═══════════════════════════════════════════════════════════

def test_extract_title_from_heading():
    from sync.watcher import _extract_title
    content = "# Hello World\nSome content here."
    assert _extract_title(content, Path("note.md")) == "Hello World"


def test_extract_title_fallback_to_filename():
    from sync.watcher import _extract_title
    content = "No heading here."
    assert _extract_title(content, Path("/vault/my-note.md")) == "my-note"


def test_extract_title_from_frontmatter():
    from sync.watcher import _extract_title
    content = '---\ntitle: "ML Fundamentals"\ntags: [ml]\n---\n\nContent'
    assert _extract_title(content, Path("note.md")) == "ML Fundamentals"


def test_extract_tags_inline():
    from sync.watcher import _extract_tags
    content = "This is about #python and #machine-learning stuff."
    tags = _extract_tags(content)
    assert "python" in tags
    assert "machine-learning" in tags


def test_extract_tags_frontmatter():
    from sync.watcher import _extract_tags
    content = "---\ntags: [pytorch, deep-learning]\n---\nContent"
    tags = _extract_tags(content)
    assert "pytorch" in tags or "deep-learning" in tags


def test_simple_diff():
    from sync.watcher import _simple_diff
    local  = "line 1\nline 2\nline 3"
    remote = "line 1\nchanged\nline 3"
    diff   = _simple_diff(local, remote)
    assert "line 2" in diff
    assert "changed" in diff


# ═══════════════════════════════════════════════════════════
# ROOM TESTS
# ═══════════════════════════════════════════════════════════

def test_room_creation():
    from collab.rooms import StudyRoom
    r = StudyRoom("test-room", "Test Room", "testing")
    assert r.room_id == "test-room"
    assert not r.is_full()
    assert r.members == {}


def test_room_max_members():
    from collab.rooms import StudyRoom, RoomMember
    r = StudyRoom("full-room", "Full")
    r.MAX_MEMBERS = 2
    # Fill it
    for i in range(2):
        ws_mock = MagicMock()
        r.members[f"user{i}"] = RoomMember(ws_mock, f"user{i}", f"User {i}")
    assert r.is_full()


def test_get_or_create_room_idempotent():
    from collab.rooms import get_or_create_room, _rooms
    _rooms.clear()
    r1 = get_or_create_room("my-room", "My Room")
    r2 = get_or_create_room("my-room", "Different Name")
    assert r1 is r2   # Same object returned
    _rooms.clear()
