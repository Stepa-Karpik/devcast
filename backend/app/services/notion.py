from __future__ import annotations

import asyncio
import base64
from datetime import datetime
from urllib.parse import urlencode

import httpx

from app.config import settings

NOTION_API = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"


def _redirect_uri() -> str:
    return f"{settings.public_base_url}/api/integrations/notion/callback"


def oauth_url(state: str) -> str:
    params = {
        "client_id": settings.notion_client_id,
        "response_type": "code",
        "owner": "user",
        "redirect_uri": _redirect_uri(),
        "state": state,
    }
    return f"{NOTION_API}/oauth/authorize?{urlencode(params)}"


async def oauth_exchange_code(code: str) -> dict:
    """Exchange the OAuth code for a workspace access token (HTTP Basic with client creds)."""
    basic = base64.b64encode(
        f"{settings.notion_client_id}:{settings.notion_client_secret}".encode()
    ).decode()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{NOTION_API}/oauth/token",
            headers={
                "Authorization": f"Basic {basic}",
                "Content-Type": "application/json",
                "Notion-Version": NOTION_VERSION,
            },
            json={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": _redirect_uri(),
            },
        )
        resp.raise_for_status()
        return resp.json()

# Notion enforces ~3 requests/sec — serialize writes through this semaphore.
_rate = asyncio.Semaphore(3)


class NotionClient:
    def __init__(self, token: str):
        self.token = token

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.token}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        }

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        async with _rate:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.request(
                    method, f"{NOTION_API}{path}", headers=self._headers(), **kwargs
                )
                resp.raise_for_status()
                return resp.json() if resp.content else {}

    async def search_targets(self, query: str = "") -> list[dict]:
        """Pages and databases the integration can access — for the target picker."""
        body: dict = {"page_size": 50}
        if query:
            body["query"] = query
        data = await self._request("POST", "/search", json=body)
        out = []
        for r in data.get("results", []):
            obj = r.get("object")
            title = _extract_title(r)
            out.append({"id": r["id"], "title": title, "type": obj})
        return out

    async def append_blocks(self, block_id: str, children: list[dict]) -> dict:
        return await self._request(
            "PATCH", f"/blocks/{block_id}/children", json={"children": children}
        )

    async def query_database_tasks(self, database_id: str) -> list[dict]:
        """Return [{id, title, key}] for rows in a database — used by the matcher."""
        data = await self._request(
            "POST", f"/databases/{database_id}/query", json={"page_size": 100}
        )
        out = []
        for r in data.get("results", []):
            out.append({"id": r["id"], "title": _extract_title(r), "key": None})
        return out

    async def set_status(
        self, page_id: str, value: str, property_name: str = "Status"
    ) -> dict:
        """Set a status/select property on a page (best-effort)."""
        return await self._request(
            "PATCH",
            f"/pages/{page_id}",
            json={"properties": {property_name: {"status": {"name": value}}}},
        )

    async def create_db_row(self, database_id: str, title: str, body_lines: list[str]) -> dict:
        properties = {
            "Name": {"title": [{"text": {"content": title[:200]}}]},
        }
        children = [_bullet_block(line) for line in body_lines]
        return await self._request(
            "POST",
            "/pages",
            json={
                "parent": {"database_id": database_id},
                "properties": properties,
                "children": children,
            },
        )


def _extract_title(result: dict) -> str:
    # Database title
    if result.get("object") == "database":
        parts = result.get("title", [])
        return "".join(p.get("plain_text", "") for p in parts) or "Untitled database"
    # Page title — find the title property
    props = result.get("properties", {})
    for prop in props.values():
        if prop.get("type") == "title":
            return "".join(p.get("plain_text", "") for p in prop["title"]) or "Untitled"
    return "Untitled"


def _bullet_block(text: str) -> dict:
    return {
        "object": "block",
        "type": "bulleted_list_item",
        "bulleted_list_item": {
            "rich_text": [{"type": "text", "text": {"content": text[:1900]}}]
        },
    }


def _heading_block(text: str) -> dict:
    return {
        "object": "block",
        "type": "heading_3",
        "heading_3": {"rich_text": [{"type": "text", "text": {"content": text[:1900]}}]},
    }


def build_changelog_blocks(headline: str, bullets: list[str], when: datetime | None) -> list[dict]:
    """A dated section to append under a page's roadmap."""
    stamp = when.strftime("%Y-%m-%d %H:%M") if when else ""
    head = f"{headline}  ·  {stamp}" if stamp else headline
    blocks = [_heading_block(head)]
    blocks.extend(_bullet_block(b) for b in bullets)
    return blocks
