import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GalleryItem(Base):
    __tablename__ = "gallery_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    salon_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("salons.id"), index=True)
    image_url: Mapped[str] = mapped_column(String(500))
    caption: Mapped[str] = mapped_column(String(300), default="")
