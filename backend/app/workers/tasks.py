from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionLocal
from app.models import Change, Commit, NotionLink, ProjectProfile, Repository
from app.services import github_app
from app.services import google_calendar as gcal
from app.services.credentials import (
    get_google_credentials,
    get_notion_token,
    resolve_provider,
)
from app.services.events import publish
from app.services.llm.factory import get_client
from app.services.notion import NotionClient

log = logging.getLogger("devcast.tasks")

# Skip these noisy paths in diffs — they dwarf real changes and waste tokens.
IGNORE_HINTS = ("package-lock.json", "yarn.lock", "poetry.lock", "pnpm-lock", ".min.js", ".min.css")
MAX_DIFF_CHARS = 60_000


def _trim_diff(diff: str) -> str:
    kept, skip = [], False
    size = 0
    for line in diff.splitlines():
        if line.startswith("diff --git"):
            skip = any(h in line for h in IGNORE_HINTS)
        if skip:
            continue
        kept.append(line)
        size += len(line)
        if size > MAX_DIFF_CHARS:
            kept.append("... (diff truncated)")
            break
    return "\n".join(kept)


async def process_commit(ctx, commit_id: str) -> None:
    async with SessionLocal() as db:
        commit = await db.get(Commit, commit_id)
        if commit is None or commit.status == "processed":
            return
        repo = await db.get(Repository, commit.repository_id)
        if repo is None:
            return
        commit.status = "processing"
        await db.commit()

        try:
            diff = await github_app.get_commit_diff(
                repo.installation_id, repo.github_full_name, commit.sha
            )
            diff = _trim_diff(diff)

            profile = await db.scalar(
                select(ProjectProfile).where(ProjectProfile.repository_id == repo.id)
            )
            resolved = await resolve_provider(db, repo.user_id, repo.provider_id)
            if not resolved:
                raise RuntimeError("No enabled LLM provider with an API key configured")
            provider, api_key, model = resolved
            client = get_client(provider, api_key, model)

            summary = await client.summarize_diff(
                diff,
                profile.summary if profile else None,
                commit.message,
                depth=repo.summary_depth,
            )

            change = await db.scalar(select(Change).where(Change.commit_id == commit.id))
            if change is None:
                change = Change(commit_id=commit.id)
                db.add(change)
            change.headline = summary.headline
            change.bullets = summary.bullets
            change.provider = provider
            change.model = model
            commit.status = "processed"
            await db.commit()

            if repo.sync_frequency == "realtime":
                await _sync_commit_to_notion(db, commit, change, repo)
            await _push_to_google_calendar(db, commit, change, repo)

            await publish(
                str(repo.user_id),
                {"type": "commit.processed", "commit_id": str(commit.id),
                 "repository_id": str(repo.id), "headline": summary.headline},
            )
        except Exception as exc:  # noqa: BLE001
            log.exception("process_commit failed for %s", commit_id)
            commit.status = "failed"
            commit.error = str(exc)[:500]
            await db.commit()
            await publish(
                str(repo.user_id),
                {"type": "commit.failed", "commit_id": str(commit.id), "error": commit.error},
            )


async def _push_to_google_calendar(
    db: AsyncSession, commit: Commit, change: Change, repo: Repository
) -> None:
    """Push the commit to the user's "Инновиум" Google calendar, if connected."""
    bullets = change.bullets or []
    creds = await get_google_credentials(db, repo.user_id)
    if not creds:
        return
    access = creds.get("access_token")
    if creds.get("refresh_token"):
        try:
            refreshed = await gcal.refresh_token(creds["refresh_token"])
            access = refreshed.get("access_token", access)
        except Exception:  # noqa: BLE001
            log.warning("google token refresh failed", exc_info=True)
    if not access:
        return

    try:
        integ = await get_google_integration(db, repo.user_id)
        cal_id = (integ.meta or {}).get("calendar_id") if integ else None
        if not cal_id:
            cal_id = await gcal.ensure_calendar(access, "Инновиум")
            if integ is not None:
                integ.meta = {**(integ.meta or {}), "calendar_id": cal_id}
                await db.commit()

        repo_url = f"https://github.com/{repo.github_full_name}"
        body = repo_url
        if bullets:
            body += "\n\n" + "\n".join(f"• {b}" for b in bullets)
        when = commit.committed_at or datetime.now(timezone.utc)
        await gcal.push_commit_event(
            access, cal_id, change.headline or commit.message, when, body
        )
    except Exception:  # noqa: BLE001
        log.warning("google calendar push failed", exc_info=True)


async def _resolve_changelog_db(
    db: AsyncSession, client: NotionClient, repo: Repository
) -> str:
    """Resolve (and cache) the 'Карта разработки' database id for a repo's Notion target.
    If the target is a page, find or create the database under it."""
    link = await db.scalar(
        select(NotionLink).where(NotionLink.repository_id == repo.id)
    )
    if link and link.notion_db_id:
        return link.notion_db_id

    if repo.notion_target_type == "database":
        db_id = repo.notion_target_id
    else:
        db_id = await client.ensure_changelog_database(repo.notion_target_id)

    if link is None:
        link = NotionLink(
            repository_id=repo.id,
            notion_page_id=repo.notion_target_id,
            notion_db_id=db_id,
        )
        db.add(link)
    else:
        link.notion_db_id = db_id
    await db.commit()
    return db_id


async def _sync_commit_to_notion(
    db: AsyncSession, commit: Commit, change: Change, repo: Repository
) -> None:
    if not repo.notion_target_id or commit.synced_to_notion:
        return
    bullets = change.bullets or []
    if not bullets:
        # Nothing worth mirroring (e.g. "simple" depth on a purely technical commit).
        commit.synced_to_notion = True
        await db.commit()
        return
    token = await get_notion_token(db, repo.user_id)
    if not token:
        return
    client = NotionClient(token)
    db_id = await _resolve_changelog_db(db, client, repo)
    await client.add_changelog_row(
        db_id, change.headline or commit.message, commit.committed_at, bullets
    )
    commit.synced_to_notion = True
    await db.commit()


async def profile_repo(ctx, repository_id: str) -> None:
    async with SessionLocal() as db:
        repo = await db.get(Repository, repository_id)
        if repo is None:
            return
        try:
            context = await github_app.fetch_project_context(
                repo.installation_id, repo.github_full_name
            )
            resolved = await resolve_provider(db, repo.user_id, repo.provider_id)
            if not resolved:
                return
            provider, api_key, model = resolved
            client = get_client(provider, api_key, model)
            info = await client.describe_project(context)

            profile = await db.scalar(
                select(ProjectProfile).where(ProjectProfile.repository_id == repo.id)
            )
            if profile is None:
                profile = ProjectProfile(repository_id=repo.id)
                db.add(profile)
            profile.summary = info.summary
            profile.stack = info.stack
            await db.commit()
        except Exception:  # noqa: BLE001
            log.exception("profile_repo failed for %s", repository_id)


async def baseline_repo(ctx, repository_id: str) -> int:
    """Record existing commits silently (status='skipped') so only future commits
    get humanized. Used when a repo is connected with tracking_mode='fresh'."""
    recorded = 0
    async with SessionLocal() as db:
        repo = await db.get(Repository, repository_id)
        if repo is None or not repo.installation_id:
            return 0
        for branch in repo.branches or ["main"]:
            try:
                commits = await github_app.list_recent_commits(
                    repo.installation_id, repo.github_full_name, branch, per_page=100
                )
            except Exception:  # noqa: BLE001
                log.warning("baseline failed for %s@%s", repo.github_full_name, branch)
                continue
            for c in commits:
                sha = c.get("sha")
                if not sha:
                    continue
                exists = await db.scalar(
                    select(Commit).where(
                        Commit.repository_id == repo.id, Commit.sha == sha
                    )
                )
                if exists:
                    continue
                cd = c.get("commit", {})
                db.add(
                    Commit(
                        repository_id=repo.id,
                        sha=sha,
                        branch=branch,
                        author=(cd.get("author") or {}).get("name"),
                        message=cd.get("message", ""),
                        url=c.get("html_url"),
                        committed_at=github_app.parse_committed_at(
                            (cd.get("author") or {}).get("date")
                        ),
                        status="skipped",
                        synced_to_notion=True,  # never mirror baseline commits
                    )
                )
                recorded += 1
        await db.commit()
    return recorded


async def poll_repos(ctx, repository_id: str | None = None) -> int:
    """Fallback ingestion: pull recent commits and enqueue any not seen yet."""
    enqueued = 0
    async with SessionLocal() as db:
        q = select(Repository).where(Repository.active.is_(True))
        if repository_id:
            q = q.where(Repository.id == repository_id)
        repos = list(await db.scalars(q))

    for repo in repos:
        if not repo.installation_id:
            continue
        for branch in repo.branches or ["main"]:
            try:
                commits = await github_app.list_recent_commits(
                    repo.installation_id, repo.github_full_name, branch
                )
            except Exception:  # noqa: BLE001
                log.warning("poll failed for %s@%s", repo.github_full_name, branch)
                continue
            for c in commits:
                if await _ingest_commit(repo, branch, c, ctx):
                    enqueued += 1
    return enqueued


async def _ingest_commit(repo: Repository, branch: str, c: dict, ctx) -> bool:
    sha = c.get("sha")
    if not sha:
        return False
    async with SessionLocal() as db:
        exists = await db.scalar(
            select(Commit).where(Commit.repository_id == repo.id, Commit.sha == sha)
        )
        if exists:
            return False
        commit_data = c.get("commit", {})
        commit = Commit(
            repository_id=repo.id,
            sha=sha,
            branch=branch,
            author=(commit_data.get("author") or {}).get("name"),
            message=commit_data.get("message", ""),
            url=c.get("html_url"),
            committed_at=github_app.parse_committed_at(
                (commit_data.get("author") or {}).get("date")
            ),
            status="pending",
        )
        db.add(commit)
        await db.commit()
        await db.refresh(commit)
    if ctx and ctx.get("redis"):
        await ctx["redis"].enqueue_job("process_commit", str(commit.id))
    return True


async def sync_daily_digest(ctx) -> None:
    await sync_notion_digest(ctx, "daily")


async def sync_weekly_digest(ctx) -> None:
    await sync_notion_digest(ctx, "weekly")


async def sync_notion_digest(ctx, frequency: str) -> None:
    """Aggregate unsynced changes per repo into a single dated digest (daily/weekly)."""
    async with SessionLocal() as db:
        repos = list(
            await db.scalars(
                select(Repository).where(
                    Repository.active.is_(True),
                    Repository.sync_frequency == frequency,
                )
            )
        )
        for repo in repos:
            if not repo.notion_target_id:
                continue
            commits = list(
                await db.scalars(
                    select(Commit)
                    .where(
                        Commit.repository_id == repo.id,
                        Commit.status == "processed",
                        Commit.synced_to_notion.is_(False),
                    )
                    .order_by(Commit.committed_at)
                )
            )
            if not commits:
                continue
            token = await get_notion_token(db, repo.user_id)
            if not token:
                continue
            client = NotionClient(token)
            db_id = await _resolve_changelog_db(db, client, repo)
            for commit in commits:
                change = await db.scalar(
                    select(Change).where(Change.commit_id == commit.id)
                )
                bullets = (change.bullets if change else None) or []
                if bullets:
                    await client.add_changelog_row(
                        db_id,
                        (change.headline if change else None) or commit.message,
                        commit.committed_at,
                        bullets,
                    )
                commit.synced_to_notion = True
            await db.commit()
