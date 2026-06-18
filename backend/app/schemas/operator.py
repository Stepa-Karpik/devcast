from __future__ import annotations

import uuid

from pydantic import BaseModel


class ProviderUpsertIn(BaseModel):
    provider: str
    model: str | None = None
    # Optional: when present, (re)sets the secret. Never echoed back.
    api_key: str | None = None
    enabled: bool = True
    is_default: bool = False


class ProviderOut(BaseModel):
    id: uuid.UUID
    provider: str
    model: str | None = None
    enabled: bool
    is_default: bool
    has_key: bool
    key_hint: str = ""  # masked tail only, never the key

    model_config = {"from_attributes": True}


class ModelInfo(BaseModel):
    id: str
    label: str


class ProviderCatalogEntry(BaseModel):
    provider: str
    label: str
    models: list[ModelInfo]
    needs_key: bool = True
