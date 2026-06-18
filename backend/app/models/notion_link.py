from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import TimestampMixin, uuid_pk


class NotionLink(Base, TimestampMixin):
    """Resolved Notion targets for a repository's roadmap mirroring."""

    __tablename__ = "notion_links"

    id: Mapped[uuid.UUID] = uuid_pk()
    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), unique=True, index=True
    )
    notion_page_id: Mapped[str | None] = mapped_column(default=None)
    notion_db_id: Mapped[str | None] = mapped_column(default=None)
    roadmap_block_id: Mapped[str | None] = mapped_column(default=None)
