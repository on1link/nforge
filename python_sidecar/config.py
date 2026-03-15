# ============================================================
# Neural Forge — python_sidecar/config.py
# Single settings object — reads from env vars with sane defaults.
# ============================================================

from __future__ import annotations
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="NF_", case_sensitive=False)

    # ── Server ────────────────────────────────────────────────────────────────
    PORT:       int  = 7731
    HOST:       str  = "127.0.0.1"
    DEBUG:      bool = False

    # ── Data paths ────────────────────────────────────────────────────────────
    DATA_DIR:   str  = str(Path.home() / ".local/share/neural-forge")
    DB_PATH:    str  = str(Path.home() / ".local/share/neural-forge/neural_forge.db")
    VAULT_PATH: str  = ""          # set in app Settings UI
    PLUGIN_DIR: str  = str(Path.home() / ".local/share/neural-forge/plugins")
    BACKUP_DIR: str  = str(Path.home() / ".local/share/neural-forge")

    # ── AI / Ollama ───────────────────────────────────────────────────────────
    OLLAMA_URL:   str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"
    EMBED_MODEL:  str = "all-MiniLM-L6-v2"

    # ── FAISS ─────────────────────────────────────────────────────────────────
    FAISS_INDEX: str  = str(Path.home() / ".local/share/neural-forge/faiss.index")
    FAISS_PATH: str  = str(Path.home() / ".local/share/neural-forge/faiss.index")
    CHUNK_SIZE:  int  = 400     # tokens per chunk
    CHUNK_OVERLAP: int = 80

    # ── Syncthing (optional) ──────────────────────────────────────────────────
    SYNCTHING_URL:     str = "http://localhost:8384"
    SYNCTHING_API_KEY: str = ""

    @property
    def db_url(self) -> str:
        return f"sqlite+aiosqlite:///{self.DB_PATH}"

    @property
    def data_path(self) -> Path:
        p = Path(self.DATA_DIR)
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def plugin_path(self) -> Path:
        p = Path(self.PLUGIN_DIR)
        p.mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()

# Ensure data directory exists
Path(settings.DATA_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.PLUGIN_DIR).mkdir(parents=True, exist_ok=True)
