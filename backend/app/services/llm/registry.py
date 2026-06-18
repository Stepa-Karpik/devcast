"""Catalog of LLM providers and their selectable model versions.

Data-driven on purpose: model IDs live here (and can be extended at runtime via
EXTRA_MODELS), never hard-coded into business logic. The frontend renders the
"Operator" dropdowns from this catalog.
"""
from __future__ import annotations

# base_url is for OpenAI-compatible chat-completions providers.
# anthropic uses its native Messages API (base_url informational only).
CATALOG: dict[str, dict] = {
    "deepseek": {
        "label": "DeepSeek",
        "api": "openai_compat",
        "base_url": "https://api.deepseek.com/v1",
        "models": [
            {"id": "deepseek-chat", "label": "DeepSeek Chat (V3)"},
            {"id": "deepseek-reasoner", "label": "DeepSeek Reasoner (R1)"},
        ],
    },
    "openai": {
        "label": "OpenAI GPT",
        "api": "openai_compat",
        "base_url": "https://api.openai.com/v1",
        "models": [
            {"id": "gpt-5.5", "label": "GPT-5.5"},
            {"id": "gpt-5.4", "label": "GPT-5.4"},
            {"id": "gpt-4.1", "label": "GPT-4.1"},
            {"id": "gpt-4o-mini", "label": "GPT-4o mini"},
        ],
    },
    "anthropic": {
        "label": "Anthropic Claude",
        "api": "anthropic",
        "base_url": "https://api.anthropic.com",
        "models": [
            {"id": "claude-opus-4-8", "label": "Claude Opus 4.8"},
            {"id": "claude-sonnet-4-6", "label": "Claude Sonnet 4.6"},
            {"id": "claude-haiku-4-5-20251001", "label": "Claude Haiku 4.5"},
        ],
    },
    "yandex": {
        "label": "YandexGPT",
        "api": "openai_compat",
        "base_url": "https://llm.api.cloud.yandex.net/v1",
        "models": [
            {"id": "yandexgpt/latest", "label": "YandexGPT (latest)"},
            {"id": "yandexgpt-lite/latest", "label": "YandexGPT Lite"},
        ],
    },
    "gigachat": {
        "label": "GigaChat",
        "api": "openai_compat",
        "base_url": "https://gigachat.devices.sberbank.ru/api/v1",
        "models": [
            {"id": "GigaChat", "label": "GigaChat"},
            {"id": "GigaChat-Pro", "label": "GigaChat Pro"},
            {"id": "GigaChat-Max", "label": "GigaChat Max"},
        ],
    },
}


def catalog_list() -> list[dict]:
    out = []
    for provider, info in CATALOG.items():
        out.append(
            {
                "provider": provider,
                "label": info["label"],
                "models": info["models"],
                "needs_key": True,
            }
        )
    return out


def default_model(provider: str) -> str | None:
    info = CATALOG.get(provider)
    if not info or not info["models"]:
        return None
    return info["models"][0]["id"]
