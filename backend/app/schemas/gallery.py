import uuid

from pydantic import BaseModel


class GalleryItemCreateRequest(BaseModel):
    image_url: str
    caption: str = ""


class GalleryItemRead(BaseModel):
    id: uuid.UUID
    salon_id: uuid.UUID
    image_url: str
    caption: str

    model_config = {"from_attributes": True}
