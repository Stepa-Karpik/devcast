from __future__ import annotations

import uuid

from pydantic import BaseModel


class RepoCreateIn(BaseModel):
    github_full_name: str
    installation_id: str | None = None
    branches: list[str] = ["main"]
    sync_frequency: str = "realtime"
    notion_target_id: str | None = None
    notion_target_type: str | None = None
    provider_id: uuid.UUID | None = None


class RepoUpdateIn(BaseModel):
    branches: list[str] | None = None
    sync_frequency: str | None = None
    notion_target_id: str | None = None
    notion_target_type: str | None = None
    provider_id: uuid.UUID | None = None
    active: bool | None = None


class ProfileOut(BaseModel):
    summary: str | None = None
    stack: dict = {}

    model_config = {"from_attributes": True}


class RepoOut(BaseModel):
    id: uuid.UUID
    github_full_name: str
    installation_id: str | None = None
    branches: list[str]
    sync_frequency: str
    notion_target_id: str | None = None
    notion_target_type: str | None = None
    provider_id: uuid.UUID | None = None
    active: bool

    model_config = {"from_attributes": True}
