from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db import get_db
from app.models import ProjectProfile, Repository, User
from app.schemas.repo import ProfileOut, RepoCreateIn, RepoOut, RepoUpdateIn
from app.workers.queue import get_arq_pool

router = APIRouter(prefix="/api/repos", tags=["repos"])


async def _owned(db: AsyncSession, repo_id: uuid.UUID, user: User) -> Repository:
    repo = await db.get(Repository, repo_id)
    if not repo or repo.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Repository not found")
    return repo


@router.get("", response_model=list[RepoOut])
async def list_repos(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    rows = await db.scalars(
        select(Repository).where(Repository.user_id == user.id).order_by(Repository.created_at)
    )
    return list(rows)


@router.post("", response_model=RepoOut, status_code=status.HTTP_201_CREATED)
async def create_repo(
    body: RepoCreateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = Repository(
        user_id=user.id,
        github_full_name=body.github_full_name,
        installation_id=body.installation_id,
        branches=body.branches or ["main"],
        sync_frequency=body.sync_frequency,
        notion_target_id=body.notion_target_id,
        notion_target_type=body.notion_target_type,
        provider_id=body.provider_id,
    )
    db.add(repo)
    await db.commit()
    await db.refresh(repo)

    # Profile "what is this project" + pull recent history in the background.
    pool = await get_arq_pool()
    await pool.enqueue_job("profile_repo", str(repo.id))
    await pool.enqueue_job("poll_repos", str(repo.id))
    await pool.aclose()
    return repo


@router.patch("/{repo_id}", response_model=RepoOut)
async def update_repo(
    repo_id: uuid.UUID,
    body: RepoUpdateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = await _owned(db, repo_id, user)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(repo, field, value)
    await db.commit()
    await db.refresh(repo)
    return repo


@router.delete("/{repo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_repo(
    repo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = await _owned(db, repo_id, user)
    await db.delete(repo)
    await db.commit()


@router.post("/{repo_id}/sync")
async def sync_now(
    repo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = await _owned(db, repo_id, user)
    pool = await get_arq_pool()
    await pool.enqueue_job("poll_repos", str(repo.id))
    await pool.aclose()
    return {"status": "queued"}


@router.get("/{repo_id}/profile", response_model=ProfileOut)
async def get_profile(
    repo_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = await _owned(db, repo_id, user)
    profile = await db.scalar(
        select(ProjectProfile).where(ProjectProfile.repository_id == repo.id)
    )
    if not profile:
        return ProfileOut()
    return profile
