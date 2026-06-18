from __future__ import annotations

from app.services.llm.anthropic import AnthropicClient
from app.services.llm.openai_compat import OpenAICompatClient
from app.services.llm.registry import CATALOG, default_model


def get_client(provider: str, api_key: str, model: str | None):
    info = CATALOG.get(provider)
    if not info:
        raise ValueError(f"Unknown provider: {provider}")
    model = model or default_model(provider)
    if info["api"] == "anthropic":
        return AnthropicClient(provider, api_key, model)
    return OpenAICompatClient(provider, api_key, model)
