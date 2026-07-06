import uuid

from pydantic import BaseModel


class StaffCreateRequest(BaseModel):
    name: str
    photo_url: str | None = None
    bio: str = ""


class StaffUpdateRequest(BaseModel):
    name: str
    photo_url: str | None = None
    bio: str = ""


class StaffRead(BaseModel):
    id: uuid.UUID
    salon_id: uuid.UUID
    name: str
    photo_url: str | None
    bio: str

    model_config = {"from_attributes": True}
