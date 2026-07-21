"""Runtime configuration, loaded from environment / .env.

All secrets come from the environment — nothing is hard-coded. Mirrors the
rest of the toolkit, where keys live in Supabase secrets or a git-ignored
config, never in source.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    allowed_origin: str = "https://gatewayhq.github.io"

    claude_api_key: str = ""
    claude_model: str = "claude-sonnet-4-6"

    # imagen | replicate | fal | none
    generative_provider: str = "imagen"

    imagen_api_key: str = ""
    imagen_base_url: str = "https://api.imagen-ai.com/v1"
    imagen_profile_key: str = ""

    replicate_api_token: str = ""
    fal_api_key: str = ""

    max_batch: int = 40
    max_upload_bytes: int = 20 * 1024 * 1024
    output_dir: str = "./output"
    mls_long_edge: int = 2048
    jpeg_quality: int = 90

    @property
    def output_path(self) -> Path:
        p = Path(self.output_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p


@lru_cache
def get_settings() -> Settings:
    return Settings()
