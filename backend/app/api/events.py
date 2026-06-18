from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from app.security import decode_access_token
from app.services.events import subscribe

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("/stream")
async def stream(request: Request, token: str = ""):
    """SSE stream of live commit events. Token is passed as a query param because
    the browser EventSource API cannot set Authorization headers."""
    user_id = decode_access_token(token)
    if user_id is None:
        return EventSourceResponse(_unauthorized())

    async def event_gen():
        gen = subscribe(str(user_id))
        try:
            async for event in gen:
                if await request.is_disconnected():
                    break
                yield {"event": event.get("type", "message"), "data": json.dumps(event)}
        except asyncio.CancelledError:
            pass
        finally:
            await gen.aclose()

    return EventSourceResponse(event_gen())


async def _unauthorized():
    yield {"event": "error", "data": json.dumps({"error": "unauthorized"})}
