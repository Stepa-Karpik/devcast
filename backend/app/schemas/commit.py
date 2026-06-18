from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class ChangeOut(BaseModel):
    headline: str | None = None
    bullets: list[str] = []
    provider: str | None = None
    model: str | None = None

    model_config = {"from_attributes": True}


class CommitOut(BaseModel):
    id: uuid.UUID
    repository_id: uuid.UUID
    sha: str
    branch: str | None = None
    author: str | None = None
    message: str
    url: str | None = None
    committed_at: datetime | None = None
    status: str
    synced_to_notion: bool
    change: ChangeOut | None = None

    model_config = {"from_attributes": True}
