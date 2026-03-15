# ============================================================
# Neural Forge — plugins/loader.py
# Discovers, loads, and dispatches hooks to all enabled plugins.
# ============================================================

from __future__ import annotations
import importlib.util
import json
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional

import structlog

from .base import BasePlugin, PluginManifest

log = structlog.get_logger()

_plugins: Dict[str, BasePlugin] = {}
_PLUGIN_DIR = Path.home() / ".local/share/neural-forge/plugins"


async def load_all_plugins() -> None:
    """Discover and load all plugins from the plugin directory."""
    global _plugins
    _PLUGIN_DIR.mkdir(parents=True, exist_ok=True)

    from db import get_db
    db = await get_db()

    for py_file in _PLUGIN_DIR.glob("*.py"):
        plugin_id = py_file.stem
        try:
            plugin_cls = _load_plugin_class(py_file)
            if plugin_cls is None:
                continue

            # Load config from DB
            async with db.execute(
                "SELECT config, enabled FROM plugins WHERE id=?", (plugin_id,)
            ) as cur:
                row = await cur.fetchone()

            config  = json.loads(row["config"]) if row else {}
            enabled = row["enabled"] if row else True

            instance = plugin_cls(config=config)
            instance.enabled = bool(enabled)
            _plugins[plugin_id] = instance

            # Register in DB
            m = instance.manifest
            await db.execute(
                """INSERT INTO plugins (id,name,version,description,author,file_path,hooks)
                   VALUES (?,?,?,?,?,?,?)
                   ON CONFLICT(id) DO UPDATE SET
                   name=excluded.name, version=excluded.version""",
                (plugin_id, m.name, m.version, m.description,
                 m.author, str(py_file), json.dumps(m.hooks))
            )
            log.info("Plugin loaded", plugin=plugin_id, hooks=m.hooks)

        except Exception as e:
            log.error("Failed to load plugin", plugin=py_file.stem, error=str(e))

    await db.commit()
    # Fire on_startup for all plugins
    await fire_hook("on_startup", {})


def _load_plugin_class(path: Path) -> Optional[type]:
    """Load a Python file and return its BasePlugin subclass."""
    spec   = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[path.stem] = module
    spec.loader.exec_module(module)

    for attr in dir(module):
        obj = getattr(module, attr)
        if (isinstance(obj, type)
                and issubclass(obj, BasePlugin)
                and obj is not BasePlugin
                and hasattr(obj, "manifest")):
            return obj
    return None


async def fire_hook(hook: str, payload: dict) -> list:
    """Fire a hook on all enabled plugins that registered for it."""
    results = []
    from db import get_db
    db = await get_db()

    for plugin_id, plugin in _plugins.items():
        if not plugin.enabled:
            continue
        if hook not in plugin.manifest.hooks and hook != "on_startup":
            continue

        start = time.monotonic()
        error = None
        result = None
        try:
            fn     = getattr(plugin, hook, None)
            if fn:
                result = await fn(payload)
            results.append({"plugin": plugin_id, "result": result})
        except Exception as e:
            error  = str(e)
            log.error("Plugin hook error", plugin=plugin_id, hook=hook, error=error)

        duration_ms = int((time.monotonic() - start) * 1000)
        await db.execute(
            "INSERT INTO plugin_events (plugin_id,hook,payload,result,error,duration_ms) VALUES (?,?,?,?,?,?)",
            (plugin_id, hook, json.dumps(payload)[:1000],
             json.dumps(result)[:500] if result else None, error, duration_ms)
        )

    await db.commit()
    return results


def get_all_plugins() -> list:
    return [
        {
            "id":      pid,
            "name":    p.manifest.name,
            "version": p.manifest.version,
            "enabled": p.enabled,
            "hooks":   p.manifest.hooks,
        }
        for pid, p in _plugins.items()
    ]


def set_plugin_enabled(plugin_id: str, enabled: bool) -> bool:
    if plugin_id in _plugins:
        _plugins[plugin_id].enabled = enabled
        return True
    return False
