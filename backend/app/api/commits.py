from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db import get_db
from app.models import Change, Commit, Repository, User
from app.schemas.commit import ChangeOut, CommitOut
from app.workers.queue import get_arq_pool

router = APIRouter(prefix="/api/commits", tags=["commits"])


async def _owned_commit(db: AsyncSession, commit_id: uuid.UUID, user: User) -> Commit:
    commit = await db.get(Commit, commit_id)
    if not commit:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commit not found")
    repo = await db.get(Repository, commit.repository_id)
    if not repo or repo.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commit not found")
    return commit


async def _user_repo_ids(db: AsyncSession, user: User) -> list[uuid.UUID]:
    rows = await db.scalars(
        select(Repository.id).where(Repository.user_id == user.id)
    )
    return list(rows)


def _to_out(commit: Commit, change: Change | None) -> CommitOut:
    out = CommitOut.model_validate(commit)
    if change:
        out.change = ChangeOut.model_validate(change)
    return out


@router.get("", response_model=list[CommitOut])
async def list_commits(
    repository_id: uuid.UUID | None = None,
    limit: int = 100,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo_ids = await _user_repo_ids(db, user)
    if not repo_ids:
        return []
    q = select(Commit).where(Commit.repository_id.in_(repo_ids))
    if repository_id:
        if repository_id not in repo_ids:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Repository not found")
        q = q.where(Commit.repository_id == repository_id)
    q = q.order_by(Commit.committed_at.desc().nullslast()).limit(min(limit, 500))
    commits = list(await db.scalars(q))

    changes = {
        c.commit_id: c
        for c in await db.scalars(
            select(Change).where(Change.commit_id.in_([c.id for c in commits]))
        )
    }
    return [_to_out(c, changes.get(c.id)) for c in commits]


@router.post("/{commit_id}/process")
async def process_commit_now(
    commit_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Humanize a commit on demand (e.g. an archived one) WITHOUT sending to Notion."""
    commit = await _owned_commit(db, commit_id, user)
    commit.status = "pending"
    await db.commit()
    pool = await get_arq_pool()
    await pool.enqueue_job("process_commit", str(commit.id), distribute=False)
    await pool.aclose()
    return {"status": "queued"}


@router.post("/{commit_id}/send-to-notion")
async def send_commit_notion(
    commit_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    commit = await _owned_commit(db, commit_id, user)
    if commit.status != "processed":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Commit is not processed yet")
    pool = await get_arq_pool()
    await pool.enqueue_job("send_commit_to_notion", str(commit.id))
    await pool.aclose()
    return {"status": "queued"}


@router.get("/{commit_id}", response_model=CommitOut)
async def get_commit(
    commit_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    commit = await db.get(Commit, commit_id)
    if not commit:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commit not found")
    repo = await db.get(Repository, commit.repository_id)
    if not repo or repo.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commit not found")
    change = await db.scalar(select(Change).where(Change.commit_id == commit.id))
    return _to_out(commit, change)
