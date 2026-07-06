import uuid

from pydantic import BaseModel


class SalonCreateRequest(BaseModel):
    slug: str
    name: str
    category: str
    address: str
    city: str
    latitude: float | None = None
    longitude: float | None = None
    admin_email: str
    admin_password: str


class SalonRead(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    category: str
    address: str
    city: str
    latitude: float | None
    longitude: float | None
    status: str
    enabled_modules: dict
    template_settings: dict

    model_config = {"from_attributes": True}


class ModuleToggleRequest(BaseModel):
    gallery: bool
    booking: bool
    contact_form: bool


class StatusUpdateRequest(BaseModel):
    status: str  # "active" | "suspended"
