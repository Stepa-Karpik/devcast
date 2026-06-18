from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import TimestampMixin, uuid_pk

# status: "pending" | "processing" | "processed" | "failed"


class Commit(Base, TimestampMixin):
    __tablename__ = "commits"
    __table_args__ = (
        UniqueConstraint("repository_id", "sha", name="uq_repo_sha"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    sha: Mapped[str] = mapped_column(index=True)
    branch: Mapped[str | None] = mapped_column(default=None)
    author: Mapped[str | None] = mapped_column(default=None)
    message: Mapped[str] = mapped_column(default="")
    url: Mapped[str | None] = mapped_column(default=None)
    committed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    status: Mapped[str] = mapped_column(default="pending", index=True)
    error: Mapped[str | None] = mapped_column(default=None)
    synced_to_notion: Mapped[bool] = mapped_column(default=False, index=True)
