from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    auth,
    calendar,
    commits,
    events,
    integrations,
    operator,
    repos,
    webhooks,
)
from app.config import settings

app = FastAPI(title="DevCast", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_base_url, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(integrations.router)
app.include_router(operator.router)
app.include_router(repos.router)
app.include_router(commits.router)
app.include_router(webhooks.router)
app.include_router(events.router)
app.include_router(calendar.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
