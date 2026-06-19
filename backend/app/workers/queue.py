from __future__ import annotations

from arq import create_pool
from arq.connections import RedisSettings
from arq.cron import cron

from app.config import settings
from app.workers import tasks


def redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(settings.redis_url)


async def get_arq_pool():
    return await create_pool(redis_settings())


class WorkerSettings:
    functions = [
        tasks.process_commit,
        tasks.send_commit_to_notion,
        tasks.profile_repo,
        tasks.poll_repos,
        tasks.baseline_repo,
        tasks.sync_daily_digest,
        tasks.sync_weekly_digest,
    ]
    cron_jobs = [
        # Poll fallback every 10 minutes in case a webhook was missed.
        cron(tasks.poll_repos, minute=set(range(0, 60, 10))),
        # Daily digest at 18:00, weekly digest Monday 09:00.
        cron(tasks.sync_daily_digest, hour=18, minute=0),
        cron(tasks.sync_weekly_digest, weekday="mon", hour=9, minute=0),
    ]

    redis_settings = redis_settings()
