from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher

TAG_RE = re.compile(r"\[([A-Z][A-Z0-9]+-\d+)\]|#(\d+)")

# Below this similarity we do NOT change a task's status — only append the summary.
CONFIDENCE_THRESHOLD = 0.62


@dataclass
class Match:
    task_id: str | None
    confidence: float
    explicit: bool

    @property
    def should_update_status(self) -> bool:
        return self.task_id is not None and (
            self.explicit or self.confidence >= CONFIDENCE_THRESHOLD
        )


def extract_tag(message: str) -> str | None:
    m = TAG_RE.search(message or "")
    if not m:
        return None
    return m.group(1) or m.group(2)


def _similar(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def match_task(message: str, headline: str, tasks: list[dict]) -> Match:
    """tasks: [{"id": ..., "title": ..., "key": optional}].

    Strategy: explicit tag first; else best fuzzy title match; status change only
    above the confidence threshold so we never corrupt someone else's roadmap.
    """
    tag = extract_tag(message)
    if tag:
        for t in tasks:
            if tag in {str(t.get("key")), str(t.get("id"))}:
                return Match(task_id=t["id"], confidence=1.0, explicit=True)

    needle = f"{headline} {message}".strip()
    best: tuple[float, str | None] = (0.0, None)
    for t in tasks:
        score = _similar(needle, t.get("title", ""))
        if score > best[0]:
            best = (score, t["id"])

    return Match(task_id=best[1], confidence=best[0], explicit=False)
