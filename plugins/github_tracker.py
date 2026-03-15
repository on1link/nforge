# ============================================================
# Neural Forge — plugins/examples/github_tracker.py
# Fetches daily GitHub contribution count and awards XP.
# Config: { "github_username": "yourname", "xp_per_commit": 30 }
# ============================================================

import httpx
from datetime import date
from plugins.base import BasePlugin, PluginManifest


class GithubTrackerPlugin(BasePlugin):
    manifest = PluginManifest(
        id          = "github-tracker",
        name        = "GitHub Activity",
        version     = "1.1.0",
        description = "Awards XP for GitHub commits. Fetches contribution graph from GitHub API.",
        author      = "neural-forge-team",
        hooks       = ["on_daily_reset", "on_task_complete"],
        config_schema = {
            "github_username": { "type": "string",  "description": "Your GitHub username" },
            "xp_per_commit":   { "type": "integer", "default": 30, "description": "XP per commit" },
            "github_token":    { "type": "string",  "description": "GitHub PAT (optional, higher rate limit)" },
        },
    )

    async def on_daily_reset(self, payload: dict) -> None:
        """Check yesterday's GitHub commits and award XP."""
        username = self.config.get("github_username", "")
        if not username:
            return

        yesterday = str(date.today().replace(day=date.today().day - 1))
        commits   = await self._count_commits(username, yesterday)
        if commits == 0:
            return

        xp = commits * self.config.get("xp_per_commit", 30)
        await self.award_xp(xp, f"GitHub: {commits} commit(s) on {yesterday}")
        await self.notify("GitHub XP", f"+{xp} XP for {commits} commit(s) yesterday")

    async def on_task_complete(self, payload: dict) -> None:
        """If task mentions a PR/commit, award bonus XP."""
        task_name = payload.get("task_name", "").lower()
        if any(kw in task_name for kw in ["pr", "commit", "push", "merge", "review"]):
            await self.award_xp(20, f"GitHub task bonus: {payload.get('task_name','')}")

    async def _count_commits(self, username: str, date_str: str) -> int:
        """Count commits for a user on a specific date using GitHub Events API."""
        token   = self.config.get("github_token", "")
        headers = {"Accept": "application/vnd.github+json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"https://api.github.com/users/{username}/events/public",
                    headers=headers, params={"per_page": 100}
                )
                if resp.status_code == 403:
                    return 0  # Rate limited
                resp.raise_for_status()
                events = resp.json()
        except Exception:
            return 0

        count = 0
        for event in events:
            if event.get("type") != "PushEvent":
                continue
            created = event.get("created_at", "")[:10]
            if created == date_str:
                count += len(event.get("payload", {}).get("commits", []))
        return count
