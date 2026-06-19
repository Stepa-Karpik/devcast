from __future__ import annotations

import uuid

from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.common import TimestampMixin, uuid_pk


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = uuid_pk()
    email: Mapped[str] = mapped_column(unique=True, index=True)
    password_hash: Mapped[str] = mapped_column()
    display_name: Mapped[str | None] = mapped_column(default=None)
    timezone: Mapped[str] = mapped_column(default="Europe/Moscow")
