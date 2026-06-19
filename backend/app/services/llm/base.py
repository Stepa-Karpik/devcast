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
    " было сделано, человеческим языком. Не описывай код построчно — описывай смысл"
    " изменений. Каждый пункт — законченное действие."
    " Отвечай СТРОГО валидным JSON вида"
    ' {"headline": "...", "bullets": ["...", "..."]}'
    " без markdown-обёртки. headline — короткое резюме коммита (до 80 символов)."
)

# "Глубина коммита" — насколько детально и для кого описывать изменения.
DEPTH_GUIDANCE = {
    "full": (
        " ГЛУБИНА: ПОЛНАЯ. Перечисли ВСЕ изменения детально, включая технические"
        " подробности: порты, имена файлов, переменные, версии, конфигурацию."
        ' Примеры: "Изменён порт фронтенда с 3001 на 3000",'
        ' "Удалён файл photo_2026-02-21.jpg".'
    ),
    "technical": (
        " ГЛУБИНА: ТЕХНИЧЕСКАЯ. Опиши изменения так, чтобы было понятно разработчику:"
        " что и зачем поменялось по сути, без мелочей вроде конкретных имён файлов и"
        " номеров портов. Группируй мелкие правки в осмысленные пункты."
    ),
    "simple": (
        " ГЛУБИНА: ПРОСТАЯ. Опиши ТОЛЬКО то, что важно нетехническому человеку"
        " (заказчику, менеджеру), чтобы понять, что проект движется."
        " Никаких портов, имён файлов, переменных, технических деталей."
        ' Пиши про функции и результат: "Добавлена страница контактов",'
        ' "Ускорена загрузка приложения". Если в коммите только техническая возня —'
        " опиши одним обобщённым пунктом или верни пустой список bullets."
    ),
}


def summary_system(depth: str = "technical") -> str:
    return SUMMARY_SYSTEM + DEPTH_GUIDANCE.get(depth, DEPTH_GUIDANCE["technical"])

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
