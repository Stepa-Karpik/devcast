from __future__ import annotations

import json
from typing import Any

import redis.asyncio as aioredis

from app.config import settings

CHANNEL_PREFIX = "devcast:events:"


def _channel(user_id: str) -> str:
    return f"{CHANNEL_PREFIX}{user_id}"


async def publish(user_id: str, event: dict[str, Any]) -> None:
    r = aioredis.from_url(settings.redis_url)
    try:
        await r.publish(_channel(user_id), json.dumps(event, default=str))
    finally:
        await r.aclose()


async def subscribe(user_id: str):
    """Async generator yielding event dicts for a user's channel."""
    r = aioredis.from_url(settings.redis_url)
    pubsub = r.pubsub()
    await pubsub.subscribe(_channel(user_id))
    try:
        async for message in pubsub.listen():
            if message.get("type") != "message":
                continue
            data = message["data"]
            if isinstance(data, bytes):
                data = data.decode()
            yield json.loads(data)
    finally:
        await pubsub.unsubscribe(_channel(user_id))
        await pubsub.aclose()
        await r.aclose()
