from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.crypto import decrypt_json, decrypt_str
from app.models import Integration, OperatorProvider


async def get_integration_credentials(
    db: AsyncSession, user_id: uuid.UUID, kind: str
) -> dict | None:
    row = await db.scalar(
        select(Integration).where(
            Integration.user_id == user_id, Integration.kind == kind
        )
    )
    if not row:
        return None
    return decrypt_json(row.encrypted_credentials)


async def get_notion_token(db: AsyncSession, user_id: uuid.UUID) -> str | None:
    creds = await get_integration_credentials(db, user_id, "notion")
    if creds and creds.get("token"):
        return creds["token"]
    return settings.notion_default_token or None


async def resolve_provider(
    db: AsyncSession, user_id: uuid.UUID, provider_id: uuid.UUID | None
) -> tuple[str, str, str] | None:
    """Return (provider, api_key, model) for a repo's provider or the user default."""
    p: OperatorProvider | None = None
    if provider_id:
        p = await db.get(OperatorProvider, provider_id)
    if p is None:
        p = await db.scalar(
            select(OperatorProvider).where(
                OperatorProvider.user_id == user_id,
                OperatorProvider.is_default.is_(True),
                OperatorProvider.enabled.is_(True),
            )
        )
    if p is None:
        p = await db.scalar(
            select(OperatorProvider).where(
                OperatorProvider.user_id == user_id,
                OperatorProvider.enabled.is_(True),
            )
        )
    if p is None or not p.encrypted_api_key:
        return None
    return p.provider, decrypt_str(p.encrypted_api_key), p.model
