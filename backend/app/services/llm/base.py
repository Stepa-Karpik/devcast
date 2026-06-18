from __future__ import annotations

import json
import re
from dataclasses import dataclass, field


@dataclass
class Summary:
    headline: str
    bullets: list[str] = field(default_factory=list)


@dataclass
class ProjectInfo:
    summary: str
    stack: dict


SUMMARY_SYSTEM = (
    "Ты — технический переводчик. По git-диффу одного коммита ты описываешь, ЧТО"
    " было сделано, простым человеческим языком, понятным нетехническому человеку"
    " (менеджеру, заказчику). Не описывай код построчно — описывай смысл изменений."
    " Каждый пункт — законченное действие, например:"
    ' "Изменена задержка перед вводом данных с 3 до 5 секунд" или'
    ' "Добавлена страница с контактами".'
    " Отвечай СТРОГО валидным JSON вида"
    ' {"headline": "...", "bullets": ["...", "..."]}'
    " без markdown-обёртки. headline — короткое резюме коммита (до 80 символов)."
)

PROJECT_SYSTEM = (
    "Ты анализируешь репозиторий по его README, дереву файлов и манифесту зависимостей."
    " Кратко опиши, что это за проект и какой стек используется."
    " Отвечай СТРОГО валидным JSON вида"
    ' {"summary": "...", "stack": {"languages": [...], "frameworks": [...], "type": "..."}}'
)


def build_summary_prompt(diff: str, project_summary: str | None, message: str) -> str:
    ctx = f"Контекст проекта: {project_summary}\n\n" if project_summary else ""
    return (
        f"{ctx}Сообщение коммита: {message}\n\n"
        f"Дифф изменений:\n```diff\n{diff}\n```\n\n"
        "Опиши изменения по пунктам."
    )


def parse_summary(text: str, fallback_headline: str = "") -> Summary:
    """Tolerant JSON extraction — models sometimes wrap output in prose/markdown."""
    data = _extract_json(text)
    if data:
        bullets = data.get("bullets") or []
        if isinstance(bullets, str):
            bullets = [bullets]
        bullets = [str(b).strip() for b in bullets if str(b).strip()]
        headline = str(data.get("headline") or fallback_headline).strip()
        if bullets or headline:
            return Summary(headline=headline or fallback_headline, bullets=bullets)
    # Last resort: split lines into bullets.
    lines = [ln.strip("-• \t") for ln in text.splitlines() if ln.strip()]
    return Summary(headline=fallback_headline or (lines[0] if lines else ""), bullets=lines[:10])


def parse_project(text: str) -> ProjectInfo:
    data = _extract_json(text) or {}
    return ProjectInfo(
        summary=str(data.get("summary") or text[:500]).strip(),
        stack=data.get("stack") if isinstance(data.get("stack"), dict) else {},
    )


def _extract_json(text: str) -> dict | None:
    if not text:
        return None
    text = text.strip()
    # strip ```json fences
    text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
    text = re.sub(r"\n?```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None
