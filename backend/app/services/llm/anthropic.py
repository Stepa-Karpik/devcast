from __future__ import annotations

import httpx

from app.services.llm.base import (
    PROJECT_SYSTEM,
    SUMMARY_SYSTEM,
    ProjectInfo,
    Summary,
    build_summary_prompt,
    parse_project,
    parse_summary,
)

ANTHROPIC_VERSION = "2023-06-01"
API_URL = "https://api.anthropic.com/v1/messages"


class AnthropicClient:
    """Claude via the native Messages API."""

    def __init__(self, provider: str, api_key: str, model: str):
        self.provider = provider
        self.api_key = api_key
        self.model = model

    async def _message(self, system: str, user: str) -> str:
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
        }
        payload = {
            "model": self.model,
            "max_tokens": 1024,
            "temperature": 0.2,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }
        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post(API_URL, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        parts = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
        return "".join(parts)

    async def summarize_diff(
        self, diff: str, project_summary: str | None, message: str
    ) -> Summary:
        text = await self._message(
            SUMMARY_SYSTEM, build_summary_prompt(diff, project_summary, message)
        )
        return parse_summary(text, fallback_headline=message)

    async def describe_project(self, context: str) -> ProjectInfo:
        text = await self._message(PROJECT_SYSTEM, context)
        return parse_project(text)
