from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import TimestampMixin, uuid_pk


class Change(Base, TimestampMixin):
    """Human-language summary of a commit produced by the LLM."""

    __tablename__ = "changes"

    id: Mapped[uuid.UUID] = uuid_pk()
    commit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("commits.id", ondelete="CASCADE"), unique=True, index=True
    )
    # list[str]: bullet points like "Изменена задержка ввода с 3 до 5 секунд"
    bullets: Mapped[list] = mapped_column(JSONB, default=list)
    headline: Mapped[str | None] = mapped_column(default=None)
    provider: Mapped[str | None] = mapped_column(default=None)
    model: Mapped[str | None] = mapped_column(default=None)
