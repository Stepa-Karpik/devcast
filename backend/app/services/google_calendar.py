from __future__ import annotations

from datetime import datetime, timedelta

import httpx

from app.config import settings

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
API = "https://www.googleapis.com/calendar/v3"
SCOPE = "https://www.googleapis.com/auth/calendar"


def auth_url(state: str) -> str:
    redirect = f"{settings.public_base_url}/api/calendar/oauth/callback"
    params = (
        f"client_id={settings.google_client_id}"
        f"&redirect_uri={redirect}"
        "&response_type=code"
        f"&scope={SCOPE}"
        "&access_type=offline"
        "&prompt=consent"
        f"&state={state}"
    )
    return f"{AUTH_URL}?{params}"


async def exchange_code(code: str) -> dict:
    redirect = f"{settings.public_base_url}/api/calendar/oauth/callback"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": redirect,
                "grant_type": "authorization_code",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def refresh_token(refresh: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            TOKEN_URL,
            data={
                "refresh_token": refresh,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "grant_type": "refresh_token",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def push_commit_event(
    access_token: str, calendar_id: str, title: str, when: datetime, description: str
) -> dict:
    end = when + timedelta(minutes=15)
    event = {
        "summary": title[:200],
        "description": description[:1000],
        "start": {"dateTime": when.isoformat()},
        "end": {"dateTime": end.isoformat()},
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{API}/calendars/{calendar_id}/events",
            headers={"Authorization": f"Bearer {access_token}"},
            json=event,
        )
        resp.raise_for_status()
        return resp.json()
