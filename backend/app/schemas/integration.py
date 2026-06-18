from __future__ import annotations

import uuid

from pydantic import BaseModel


class IntegrationOut(BaseModel):
    id: uuid.UUID
    kind: str
    meta: dict

    model_config = {"from_attributes": True}


class NotionConnectIn(BaseModel):
    # Internal integration token (secret_xxx). Stored encrypted, never returned.
    token: str


class NotionTargetOut(BaseModel):
    id: str
    title: str
    type: str  # "page" | "database"
