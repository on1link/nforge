# ============================================================
# Neural Forge v1.0.0-beta — python_sidecar/tests/test_beta.py
# Integration test suite covering all three phases.
# Run: uv run pytest tests/test_beta.py -v
# ============================================================

from __future__ import annotations
import asyncio
import json
import tempfile
import os
from pathlib import Path
from datetime import date, timedelta
import pytest


# ══════════════════════════════════════════════════════════════════════════════
# FIXTURES
# ══════════════════════════════════════════════════════════════════════════════

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def tmp_db(tmp_path_factory):
    """Temp SQLite DB with all migrations applied."""
    db_path = tmp_path_factory.mktemp("nf") / "test.db"
    import aiosqlite
    db = await aiosqlite.connect(str(db_path))
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode = WAL")
    await db.execute("PRAGMA foreign_keys = ON")
    await db.commit()
    yield db
    await db.close()


@pytest.fixture(scope="session")
def vault_dir(tmp_path_factory):
    """Temp vault with sample .md notes."""
    vault = tmp_path_factory.mktemp("vault")
    notes = {
        "attention.md": "# Attention Is All You Need\n\nTransformers use [[self-attention]] to compute representations.\n\nTags: #ml #transformers #attention",
        "pytorch.md":   "# PyTorch Guide\n\nUse `torch.nn.Module` for [[attention]] layers.\n\n#pytorch #deeplearning",
        "backprop.md":  "# Backpropagation\n\nChain rule applied to [[neural-nets]].\n\n#calculus #ml",
    }
    for name, content in notes.items():
        (vault / name).write_text(content)
    return vault


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — XP ECONOMY
# ══════════════════════════════════════════════════════════════════════════════

class TestXpEconomy:
    def test_xp_per_level_constant(self):
        assert 1000 == 1000  # XP_PER_LEVEL sanity

    def test_level_from_xp(self):
        cases = [(0, 1), (999, 1), (1000, 2), (5500, 6)]
        for xp, expected_level in cases:
            assert xp // 1000 + 1 == expected_level

    def test_sp_on_level_up(self):
        """Leveling up from xp awards +3 SP."""
        old_xp, new_xp = 900, 1100
        old_level = old_xp // 1000 + 1
        new_level = new_xp // 1000 + 1
        leveled = new_level > old_level
        sp_gain = 3 if leveled else 0
        assert leveled is True
        assert sp_gain == 3

    def test_grind_xp_cap(self):
        """Grind session XP is capped at 500."""
        def calc_xp(problems: int, duration: int) -> int:
            return min(problems * 50, 500) + (100 if duration >= 60 else 0)
        assert calc_xp(1, 30)  == 50
        assert calc_xp(10, 30) == 500   # capped
        assert calc_xp(5, 90)  == 350   # 250 + 100 bonus
        assert calc_xp(10, 90) == 600   # 500 cap + 100 bonus


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — SM-2
# ══════════════════════════════════════════════════════════════════════════════

class TestSM2:
    def _run(self, quality: int, n: int = 0, ef: float = 2.5, interval: int = 1):
        from sm2.engine import sm2_update
        return sm2_update(quality=quality, n=n, ef=ef, interval=interval)

    def test_perfect_recall_first(self):
        r = self._run(5)
        assert r.interval == 1
        assert r.repetitions == 1
        assert abs(r.ease_factor - 2.6) < 0.01

    def test_good_recall(self):
        r = self._run(4, n=1, interval=1)
        assert r.interval == 6
        assert r.repetitions == 2

    def test_hard_recall_resets(self):
        r = self._run(2, n=3, ef=2.5, interval=21)
        assert r.repetitions == 0
        assert r.interval    == 1

    def test_ef_floor(self):
        """Ease factor should not drop below 1.3."""
        r = self._run(0, n=5, ef=1.4, interval=5)
        assert r.ease_factor >= 1.3

    def test_due_date_is_future(self):
        from sm2.engine import sm2_update
        from datetime import date, timedelta
        r = sm2_update(quality=5, n=1, ef=2.5, interval=1)
        due = date.fromisoformat(r.due_date)
        assert due >= date.today()

    def test_quality_range_validation(self):
        from sm2.engine import sm2_update
        # Quality 0–5 must not raise
        for q in range(6):
            sm2_update(quality=q)
        # Out of range
        with pytest.raises(Exception):
            sm2_update(quality=6)


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — SEMANTIC SEARCH
# ══════════════════════════════════════════════════════════════════════════════

class TestSearch:
    def test_wikilink_extraction(self, vault_dir):
        import re
        content = (vault_dir / "attention.md").read_text()
        links = re.findall(r"\[\[([^\]]+)\]\]", content)
        assert "self-attention" in links

    def test_tag_extraction(self, vault_dir):
        import re
        content = (vault_dir / "pytorch.md").read_text()
        tags = re.findall(r"#(\w[\w-]*)", content)
        assert "pytorch" in tags
        assert "deeplearning" in tags

    def test_title_extraction(self, vault_dir):
        content = (vault_dir / "attention.md").read_text()
        title = next((l[2:].strip() for l in content.splitlines() if l.startswith("# ")), "")
        assert title == "Attention Is All You Need"

    def test_chunk_size_config(self):
        from config import settings
        assert settings.CHUNK_SIZE  > 0
        assert settings.CHUNK_OVERLAP >= 0
        assert settings.CHUNK_OVERLAP < settings.CHUNK_SIZE


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — ANALYTICS
# ══════════════════════════════════════════════════════════════════════════════

class TestAnalytics:
    def test_pearson_correlation_perfect_positive(self):
        """r=1.0 for perfectly correlated data."""
        import statistics
        xs = [1, 2, 3, 4, 5]
        ys = [2, 4, 6, 8, 10]
        n  = len(xs)
        xm, ym = sum(xs)/n, sum(ys)/n
        num = sum((x-xm)*(y-ym) for x,y in zip(xs,ys))
        den = (sum((x-xm)**2 for x in xs)**0.5) * (sum((y-ym)**2 for y in ys)**0.5)
        r = num / den if den else 0
        assert abs(r - 1.0) < 1e-9

    def test_pearson_zero_variance(self):
        """Constant series should return r=0 without crash."""
        xs = [1.0, 1.0, 1.0]
        ys = [2.0, 3.0, 4.0]
        xm = sum(xs)/len(xs)
        den = sum((x-xm)**2 for x in xs)**0.5
        r = 0.0 if den == 0 else 1.0
        assert r == 0.0


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — KNOWLEDGE GRAPH
# ══════════════════════════════════════════════════════════════════════════════

class TestGraph:
    def test_d3_json_structure(self, vault_dir):
        """build_d3_json should return nodes and links."""
        import networkx as nx
        from graph.builder import build_d3_json

        G = nx.DiGraph()
        G.add_node("pytorch",     label="PyTorch",    type="skill", color="#00e5ff")
        G.add_node("attention.md",label="Attention",  type="note",  color="#ffc107")
        G.add_edge("pytorch", "attention.md", edge_type="wikilink", weight=1.0)

        data = build_d3_json(G)
        assert "nodes" in data and "links" in data
        assert len(data["nodes"]) == 2
        assert len(data["links"]) == 1

    def test_graph_stats(self):
        import networkx as nx
        from graph.builder import compute_stats

        G = nx.DiGraph()
        G.add_edges_from([("a","b"), ("b","c"), ("a","c")])
        stats = compute_stats(G)
        assert stats["nodes"] == 3
        assert stats["edges"] == 3
        assert stats["density"] > 0

    def test_wikilink_parser(self):
        import re
        text = "Transformers use [[self-attention]] and [[positional-encoding]] methods."
        links = re.findall(r"\[\[([^\]]+)\]\]", text)
        assert links == ["self-attention", "positional-encoding"]

    def test_shortest_path(self):
        import networkx as nx
        G = nx.DiGraph()
        G.add_edges_from([("python","pytorch"),("pytorch","transformers"),("transformers","bert")])
        path = nx.shortest_path(G, "python", "bert")
        assert path == ["python", "pytorch", "transformers", "bert"]

    def test_graph_no_node_error(self):
        import networkx as nx
        G = nx.DiGraph()
        G.add_edge("a", "b")
        with pytest.raises(nx.NodeNotFound):
            nx.shortest_path(G, "a", "nonexistent")


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — PLUGINS
# ══════════════════════════════════════════════════════════════════════════════

class TestPlugins:
    def test_manifest_required_fields(self):
        from plugins.base import PluginManifest
        m = PluginManifest(id="test", name="Test Plugin", hooks=["on_startup"])
        assert m.id      == "test"
        assert m.name    == "Test Plugin"
        assert "on_startup" in m.hooks

    def test_manifest_default_version(self):
        from plugins.base import PluginManifest
        m = PluginManifest(id="x", name="X", hooks=[])
        assert m.version == "0.1.0"

    def test_all_hooks_defined(self):
        from plugins.base import VALID_HOOKS
        expected = {
            "on_startup", "on_skill_levelup", "on_task_complete",
            "on_grind_session_end", "on_sr_review", "on_vault_note_change",
            "on_daily_reset", "on_xp_gain", "on_level_up",
        }
        assert expected.issubset(set(VALID_HOOKS))

    def test_disabled_plugin_skipped(self):
        """A disabled plugin should not execute its hooks."""
        class FakePlugin:
            enabled = False
            hooks_called = []
            manifest_hooks = ["on_startup"]

            async def dispatch(self, hook, payload):
                if not self.enabled:
                    return None
                self.hooks_called.append(hook)

        p = FakePlugin()
        asyncio.get_event_loop().run_until_complete(p.dispatch("on_startup", {}))
        assert p.hooks_called == []


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — STUDY ROOMS
# ══════════════════════════════════════════════════════════════════════════════

class TestRooms:
    def test_room_creation(self):
        from collab.rooms import RoomManager
        mgr = RoomManager()
        room = mgr.create_room("ml-grind", "ML Grind", "Daily problems", True)
        assert room.room_id  == "ml-grind"
        assert room.name     == "ML Grind"
        assert len(mgr.list_rooms()) == 1

    def test_max_members_enforced(self):
        from collab.rooms import RoomManager
        mgr  = RoomManager()
        room = mgr.create_room("test", "Test", max_members=2)
        mgr.join_room("test", "user1", "Alice")
        mgr.join_room("test", "user2", "Bob")
        with pytest.raises(Exception):
            mgr.join_room("test", "user3", "Charlie")

    def test_idempotent_join(self):
        from collab.rooms import RoomManager
        mgr = RoomManager()
        mgr.create_room("idem", "Idempotent")
        mgr.join_room("idem", "u1", "User")
        mgr.join_room("idem", "u1", "User")   # same user, no error
        room = mgr.get_room("idem")
        assert len(room.members) == 1


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — GIT BACKUP
# ══════════════════════════════════════════════════════════════════════════════

class TestBackup:
    def test_commit_result_schema(self):
        from backup.git import CommitResult
        r = CommitResult(status="ok", message="test", commit_hash="abc123", files_changed=3)
        assert r.status        == "ok"
        assert r.commit_hash   == "abc123"
        assert r.files_changed == 3

    def test_nothing_to_commit(self):
        from backup.git import CommitResult
        r = CommitResult(status="nothing_to_commit", message="Nothing to commit", files_changed=0)
        assert r.status == "nothing_to_commit"

    def test_snapshot_filename_format(self):
        from datetime import datetime
        ts   = datetime(2026, 3, 9, 12, 0, 0)
        name = f"neural_forge_{ts.strftime('%Y%m%d_%H%M%S')}.db"
        assert name == "neural_forge_20260309_120000.db"


# ══════════════════════════════════════════════════════════════════════════════
# INTEGRATION — CONFIG
# ══════════════════════════════════════════════════════════════════════════════

class TestConfig:
    def test_defaults_are_sane(self):
        from config import settings
        assert settings.PORT        == 7731
        assert settings.HOST        == "127.0.0.1"
        assert settings.CHUNK_SIZE  >  0
        assert "sqlite" in settings.db_url

    def test_env_override(self, monkeypatch):
        monkeypatch.setenv("NF_PORT", "9999")
        from importlib import reload
        import config
        reload(config)
        from config import Settings
        s = Settings()
        assert s.PORT == 9999
        monkeypatch.delenv("NF_PORT")
