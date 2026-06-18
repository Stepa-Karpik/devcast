from __future__ import annotations

import time
from datetime import datetime

import httpx
import jwt

from app.config import settings

API = "https://api.github.com"


def app_jwt() -> str:
    """Short-lived JWT signed with the GitHub App private key (RS256)."""
    pem = settings.github_private_key_pem
    if not pem or not settings.github_app_id:
        raise RuntimeError("GitHub App is not configured (id/private key missing)")
    now = int(time.time())
    payload = {"iat": now - 60, "exp": now + 9 * 60, "iss": settings.github_app_id}
    return jwt.encode(payload, pem, algorithm="RS256")


async def installation_token(installation_id: str) -> str:
    headers = {
        "Authorization": f"Bearer {app_jwt()}",
        "Accept": "application/vnd.github+json",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{API}/app/installations/{installation_id}/access_tokens", headers=headers
        )
        resp.raise_for_status()
        return resp.json()["token"]


async def exchange_oauth_code(code: str) -> dict:
    """Exchange the GitHub App user OAuth code for a user access token."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_app_client_id,
                "client_secret": settings.github_app_client_secret,
                "code": code,
            },
        )
        resp.raise_for_status()
        return resp.json()


async def list_installations(user_token: str) -> list[dict]:
    headers = {
        "Authorization": f"Bearer {user_token}",
        "Accept": "application/vnd.github+json",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{API}/user/installations", headers=headers)
        resp.raise_for_status()
        return resp.json().get("installations", [])


async def list_installation_repos(installation_id: str) -> list[dict]:
    token = await installation_token(installation_id)
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }
    repos: list[dict] = []
    async with httpx.AsyncClient(timeout=30) as client:
        page = 1
        while True:
            resp = await client.get(
                f"{API}/installation/repositories",
                headers=headers,
                params={"per_page": 100, "page": page},
            )
            resp.raise_for_status()
            data = resp.json()
            repos.extend(data.get("repositories", []))
            if len(data.get("repositories", [])) < 100:
                break
            page += 1
    return repos


async def get_commit_diff(installation_id: str, full_name: str, sha: str) -> str:
    """Unified diff of a single commit (changes only, not the whole tree)."""
    token = await installation_token(installation_id)
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.diff",
    }
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(f"{API}/repos/{full_name}/commits/{sha}", headers=headers)
        resp.raise_for_status()
        return resp.text


async def list_recent_commits(
    installation_id: str, full_name: str, branch: str, per_page: int = 30
) -> list[dict]:
    token = await installation_token(installation_id)
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{API}/repos/{full_name}/commits",
            headers=headers,
            params={"sha": branch, "per_page": per_page},
        )
        resp.raise_for_status()
        return resp.json()


async def fetch_project_context(installation_id: str, full_name: str) -> str:
    """README + top-level file tree + manifest, used to profile 'what is this project'."""
    token = await installation_token(installation_id)
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }
    readme = ""
    tree_names: list[str] = []
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            r = await client.get(
                f"{API}/repos/{full_name}/readme",
                headers={**headers, "Accept": "application/vnd.github.raw"},
            )
            if r.status_code == 200:
                readme = r.text[:6000]
        except httpx.HTTPError:
            pass
        try:
            r = await client.get(f"{API}/repos/{full_name}/contents", headers=headers)
            if r.status_code == 200:
                tree_names = [item["name"] for item in r.json()]
        except httpx.HTTPError:
            pass
    return (
        f"Файлы в корне репозитория: {', '.join(tree_names)}\n\n"
        f"README:\n{readme}"
    )


def parse_committed_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
