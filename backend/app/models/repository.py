from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import TimestampMixin, uuid_pk

# sync_frequency: "realtime" | "daily" | "weekly"


class Repository(Base, TimestampMixin):
    __tablename__ = "repositories"

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    github_full_name: Mapped[str] = mapped_column(index=True)  # "owner/repo"
    installation_id: Mapped[str | None] = mapped_column(default=None)
    branches: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    sync_frequency: Mapped[str] = mapped_column(default="realtime")
    notion_target_id: Mapped[str | None] = mapped_column(default=None)  # page or db id
    notion_target_type: Mapped[str | None] = mapped_column(default=None)  # "page" | "database"
    provider_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("operator_providers.id", ondelete="SET NULL"),
        default=None,
    )
    active: Mapped[bool] = mapped_column(default=True)
