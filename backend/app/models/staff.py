import uuid

from sqlalchemy import ForeignKey, String, Table, Column
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

staff_services = Table(
    "staff_services",
    Base.metadata,
    Column("staff_id", UUID(as_uuid=True), ForeignKey("staff.id"), primary_key=True),
    Column("service_id", UUID(as_uuid=True), ForeignKey("services.id"), primary_key=True),
)


class Staff(Base):
    __tablename__ = "staff"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    salon_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("salons.id"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    bio: Mapped[str] = mapped_column(String(1000), default="")


class StaffAvailability(Base):
    __tablename__ = "staff_availability"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    staff_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("staff.id"), index=True)
    day_of_week: Mapped[int]  # 0=Monday .. 6=Sunday
    start_time: Mapped[str] = mapped_column(String(5))  # "09:00"
    end_time: Mapped[str] = mapped_column(String(5))  # "17:00"
