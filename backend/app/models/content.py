import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ContentBlock(Base):
    __tablename__ = "content_blocks"
    __table_args__ = (UniqueConstraint("salon_id", "key", name="uq_content_block_salon_key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    salon_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("salons.id"), index=True)
    key: Mapped[str] = mapped_column(String(50))  # "about_us" | "contact_info"
    value: Mapped[str] = mapped_column(String(5000), default="")
