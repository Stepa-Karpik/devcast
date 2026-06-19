from __future__ import annotations

import httpx

from app.services.llm.base import (
    PROJECT_SYSTEM,
    ProjectInfo,
    Summary,
    build_summary_prompt,
    parse_project,
    parse_summary,
    summary_system,
)
from app.services.llm.registry import CATALOG


class OpenAICompatClient:
    """Chat-completions client for OpenAI-compatible providers (DeepSeek, GPT, Yandex, GigaChat)."""

    def __init__(self, provider: str, api_key: str, model: str):
        self.provider = provider
        self.api_key = api_key
        self.model = model
        self.base_url = CATALOG[provider]["base_url"].rstrip("/")

    async def _chat(self, system: str, user: str) -> str:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.2,
        }
        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions", json=payload, headers=headers
            )
            resp.raise_for_status()
            data = resp.json()
        return data["choices"][0]["message"]["content"]

    async def summarize_diff(
        self, diff: str, project_summary: str | None, message: str, depth: str = "technical"
    ) -> Summary:
        text = await self._chat(
            summary_system(depth), build_summary_prompt(diff, project_summary, message)
        )
        return parse_summary(text, fallback_headline=message)

    async def describe_project(self, context: str) -> ProjectInfo:
        text = await self._chat(PROJECT_SYSTEM, context)
        return parse_project(text)
