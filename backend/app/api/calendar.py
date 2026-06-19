from __future__ import annotations

import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import settings
from app.crypto import encrypt_json
from app.db import get_db
from app.models import Commit, Integration, Repository, User
from app.services import google_calendar

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.get("/commits")
async def calendar_commits(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Commit activity grouped by day for the in-app calendar view."""
    repos = list(
        await db.scalars(select(Repository).where(Repository.user_id == user.id))
    )
    if not repos:
        return []
    repo_name = {r.id: r.github_full_name for r in repos}
    commits = list(
        await db.scalars(
            select(Commit)
            .where(
                Commit.repository_id.in_(list(repo_name.keys())),
                Commit.committed_at.isnot(None),
            )
            .order_by(Commit.committed_at)
        )
    )
    buckets: dict[str, list] = defaultdict(list)
    for c in commits:
        day = c.committed_at.date().isoformat()
        buckets[day].append(
            {
                "id": str(c.id),
                "sha": c.sha[:7],
                "repo": repo_name.get(c.repository_id, ""),
                "message": c.message.splitlines()[0] if c.message else "",
                "time": c.committed_at.isoformat(),
            }
        )
    return [{"date": day, "commits": items} for day, items in sorted(buckets.items())]


@router.get("/oauth/url")
async def google_oauth_url(user: User = Depends(get_current_user)):
    if not settings.google_client_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Google not configured")
    return {"url": google_calendar.auth_url(state=str(user.id))}


@router.get("/oauth/callback")
async def google_oauth_callback(
    code: str, state: str, db: AsyncSession = Depends(get_db)
):
    try:
        user_id = uuid.UUID(state)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bad state")
    token_data = await google_calendar.exchange_code(code)
    row = await db.scalar(
        select(Integration).where(
            Integration.user_id == user_id, Integration.kind == "google"
        )
    )
    if row is None:
        row = Integration(user_id=user_id, kind="google")
        db.add(row)
    row.encrypted_credentials = encrypt_json(token_data)
    row.meta = {"connected": True}
    await db.commit()
    return RedirectResponse(f"{settings.frontend_base_url}/calendar?google=connected")
