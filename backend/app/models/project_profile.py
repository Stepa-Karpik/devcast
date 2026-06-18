from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import TimestampMixin, uuid_pk


class ProjectProfile(Base, TimestampMixin):
    """What kind of project this repo is — generated once on connect, used as LLM context."""

    __tablename__ = "project_profiles"

    id: Mapped[uuid.UUID] = uuid_pk()
    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("repositories.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    summary: Mapped[str | None] = mapped_column(default=None)
    stack: Mapped[dict] = mapped_column(JSONB, default=dict)
