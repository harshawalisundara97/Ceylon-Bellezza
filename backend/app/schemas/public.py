import uuid

from pydantic import BaseModel


class PublicSalonSummary(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    category: str
    city: str
    template_settings: dict

    model_config = {"from_attributes": True}


class PublicServiceRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    category: str
    price: float
    duration_minutes: int

    model_config = {"from_attributes": True}


class PublicStaffRead(BaseModel):
    id: uuid.UUID
    name: str
    photo_url: str | None
    bio: str

    model_config = {"from_attributes": True}


class PublicGalleryItemRead(BaseModel):
    id: uuid.UUID
    image_url: str
    caption: str

    model_config = {"from_attributes": True}


class PublicSalonDetail(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    category: str
    city: str
    address: str
    template_settings: dict
    services: list[PublicServiceRead]
    staff: list[PublicStaffRead]
    gallery: list[PublicGalleryItemRead]
    content: dict[str, str]
