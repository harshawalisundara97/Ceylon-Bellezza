import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Salon(Base):
    __tablename__ = "salons"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(20))  # "mens" | "womens" | "unisex"
    address: Mapped[str] = mapped_column(String(300))
    city: Mapped[str] = mapped_column(String(100))
    latitude: Mapped[float | None] = mapped_column(nullable=True)
    longitude: Mapped[float | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # "active" | "suspended"
    enabled_modules: Mapped[dict] = mapped_column(JSON, default=lambda: {"gallery": True, "booking": True, "contact_form": True})
    template_settings: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
