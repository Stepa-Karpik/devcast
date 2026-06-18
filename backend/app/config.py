from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Core
    database_url: str = "postgresql+asyncpg://devcast:devcast@localhost:5433/devcast"
    redis_url: str = "redis://localhost:6380/0"
    jwt_secret: str = "dev-insecure-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7
    app_encryption_key: str = ""  # Fernet key; required for encrypting stored credentials

    public_base_url: str = "http://localhost:8000"
    frontend_base_url: str = "http://localhost:5173"

    # GitHub App
    github_app_id: str = ""
    github_app_slug: str = ""  # used to build the installation URL
    github_app_client_id: str = ""
    github_app_client_secret: str = ""
    github_app_webhook_secret: str = ""
    github_app_private_key: str = ""
    github_app_private_key_path: str = ""

    # Notion
    notion_client_id: str = ""
    notion_client_secret: str = ""
    notion_default_token: str = ""  # optional internal-token fallback for local dev

    # Google
    google_client_id: str = ""
    google_client_secret: str = ""

    @property
    def github_private_key_pem(self) -> str:
        if self.github_app_private_key:
            # Allow single-line PEM with literal \n.
            return self.github_app_private_key.replace("\\n", "\n")
        if self.github_app_private_key_path:
            return Path(self.github_app_private_key_path).read_text()
        return ""


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
