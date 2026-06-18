from __future__ import annotations

import hashlib
import hmac

from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal
from app.models import Commit, Repository
from app.services import github_app
from app.workers.queue import get_arq_pool

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

# Remember recent delivery ids to drop duplicate webhook retries.
_seen_deliveries: set[str] = set()


def _verify_signature(body: bytes, signature: str | None) -> bool:
    secret = settings.github_app_webhook_secret
    if not secret:
        # No secret configured (dev) — accept but cannot verify.
        return True
    if not signature:
        return False
    digest = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


@router.post("/github")
async def github_webhook(
    request: Request,
    x_github_event: str = Header(default=""),
    x_github_delivery: str = Header(default=""),
    x_hub_signature_256: str | None = Header(default=None),
):
    body = await request.body()
    if not _verify_signature(body, x_hub_signature_256):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bad signature")

    if x_github_delivery and x_github_delivery in _seen_deliveries:
        return {"status": "duplicate"}
    if x_github_delivery:
        _seen_deliveries.add(x_github_delivery)
        if len(_seen_deliveries) > 5000:
            _seen_deliveries.clear()

    payload = await request.json()
    if x_github_event != "push":
        return {"status": "ignored", "event": x_github_event}

    full_name = (payload.get("repository") or {}).get("full_name")
    ref = payload.get("ref", "")  # refs/heads/<branch>
    branch = ref.split("/", 2)[-1] if ref else None
    installation_id = str((payload.get("installation") or {}).get("id") or "")

    enqueued = 0
    pool = await get_arq_pool()
    async with SessionLocal() as db:
        repos = list(
            await db.scalars(
                select(Repository).where(
                    Repository.github_full_name == full_name,
                    Repository.active.is_(True),
                )
            )
        )
        for repo in repos:
            if repo.branches and branch and branch not in repo.branches:
                continue
            for c in payload.get("commits", []):
                sha = c.get("id")
                if not sha:
                    continue
                exists = await db.scalar(
                    select(Commit).where(
                        Commit.repository_id == repo.id, Commit.sha == sha
                    )
                )
                if exists:
                    continue
                commit = Commit(
                    repository_id=repo.id,
                    sha=sha,
                    branch=branch,
                    author=(c.get("author") or {}).get("name"),
                    message=c.get("message", ""),
                    url=c.get("url"),
                    committed_at=github_app.parse_committed_at(c.get("timestamp")),
                    status="pending",
                )
                if installation_id and not repo.installation_id:
                    repo.installation_id = installation_id
                db.add(commit)
                await db.commit()
                await db.refresh(commit)
                await pool.enqueue_job("process_commit", str(commit.id))
                enqueued += 1
    await pool.aclose()
    return {"status": "ok", "enqueued": enqueued}
