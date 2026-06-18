from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.crypto import decrypt_str, encrypt_str, mask
from app.db import get_db
from app.models import OperatorProvider, User
from app.schemas.operator import ProviderCatalogEntry, ProviderOut, ProviderUpsertIn
from app.services.llm.registry import catalog_list, default_model

router = APIRouter(prefix="/api/operator", tags=["operator"])


def _to_out(p: OperatorProvider) -> ProviderOut:
    has_key = bool(p.encrypted_api_key)
    hint = ""
    if has_key:
        try:
            hint = mask(decrypt_str(p.encrypted_api_key))
        except Exception:  # pragma: no cover - defensive
            hint = "••••"
    return ProviderOut(
        id=p.id,
        provider=p.provider,
        model=p.model,
        enabled=p.enabled,
        is_default=p.is_default,
        has_key=has_key,
        key_hint=hint,
    )


@router.get("/catalog", response_model=list[ProviderCatalogEntry])
async def catalog(_: User = Depends(get_current_user)):
    return catalog_list()


@router.get("/providers", response_model=list[ProviderOut])
async def list_providers(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    rows = await db.scalars(
        select(OperatorProvider).where(OperatorProvider.user_id == user.id)
    )
    return [_to_out(p) for p in rows]


@router.put("/providers", response_model=ProviderOut)
async def upsert_provider(
    body: ProviderUpsertIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    p = await db.scalar(
        select(OperatorProvider).where(
            OperatorProvider.user_id == user.id,
            OperatorProvider.provider == body.provider,
        )
    )
    if p is None:
        p = OperatorProvider(user_id=user.id, provider=body.provider)
        db.add(p)

    p.model = body.model or p.model or default_model(body.provider)
    p.enabled = body.enabled
    # Write-only key: only overwrite when a new value is supplied.
    if body.api_key:
        p.encrypted_api_key = encrypt_str(body.api_key)

    if body.is_default:
        await db.execute(
            update(OperatorProvider)
            .where(OperatorProvider.user_id == user.id)
            .values(is_default=False)
        )
        p.is_default = True
    else:
        p.is_default = p.is_default

    await db.commit()
    await db.refresh(p)
    return _to_out(p)


@router.delete("/providers/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(
    provider_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    p = await db.get(OperatorProvider, provider_id)
    if not p or p.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    await db.delete(p)
    await db.commit()
