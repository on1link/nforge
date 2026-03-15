# ============================================================
# Neural Forge — plugins/examples/xp_webhook.py
# Posts XP events to Discord/Slack/custom webhook.
# Config: { "webhook_url": "https://...", "min_xp": 100 }
# ============================================================

import httpx
from plugins.base import BasePlugin, PluginManifest


class XpWebhookPlugin(BasePlugin):
    manifest = PluginManifest(
        id          = "xp-webhook",
        name        = "XP Webhook",
        version     = "0.8.1",
        description = "Posts level-up and big XP events to a Discord/Slack webhook.",
        author      = "community",
        hooks       = ["on_level_up", "on_xp_gain", "on_skill_levelup"],
        config_schema = {
            "webhook_url": { "type": "string", "description": "Discord/Slack webhook URL" },
            "min_xp":      { "type": "integer", "default": 100, "description": "Min XP to trigger" },
        },
    )

    async def on_level_up(self, payload: dict) -> None:
        level = payload.get("level", "?")
        await self._post(f"🎉 **Leveled up to {level}!** in Neural Forge")

    async def on_skill_levelup(self, payload: dict) -> None:
        name  = payload.get("skill_name", "?")
        level = payload.get("level", "?")
        await self._post(f"⬡ **{name}** reached level {level}!")

    async def on_xp_gain(self, payload: dict) -> None:
        xp  = payload.get("xp", 0)
        min_xp = self.config.get("min_xp", 100)
        if xp >= min_xp:
            reason = payload.get("reason", "XP gained")
            await self._post(f"⚡ +{xp} XP — {reason}")

    async def _post(self, message: str) -> None:
        url = self.config.get("webhook_url", "")
        if not url:
            return
        try:
            # Discord format
            payload = {"content": message, "username": "Neural Forge"}
            # Slack format fallback
            if "hooks.slack.com" in url:
                payload = {"text": message}
            async with httpx.AsyncClient(timeout=8) as client:
                await client.post(url, json=payload)
        except Exception as e:
            import structlog
            structlog.get_logger().error("Webhook post failed", error=str(e))
