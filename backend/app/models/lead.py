import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SalonLead(Base):
    __tablename__ = "salon_leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contact_name: Mapped[str] = mapped_column(String(150))
    contact_phone: Mapped[str] = mapped_column(String(30))
    contact_email: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(String(2000), default="")
    status: Mapped[str] = mapped_column(String(20), default="pending")  # "pending" | "approved" | "rejected"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
