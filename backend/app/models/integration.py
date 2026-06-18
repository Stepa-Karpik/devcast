from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import TimestampMixin, uuid_pk

# kind: "github" | "notion" | "google"


class Integration(Base, TimestampMixin):
    __tablename__ = "integrations"
    __table_args__ = (
        Index("ix_integration_user_kind", "user_id", "kind"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column()
    # Fernet-encrypted JSON. Never serialized back to API responses.
    encrypted_credentials: Mapped[str] = mapped_column()
    # Non-secret metadata safe to display (account login, installation id, etc.)
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
