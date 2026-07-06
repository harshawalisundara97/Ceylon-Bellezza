import uuid

from pydantic import BaseModel


class ServiceCreateRequest(BaseModel):
    name: str
    description: str = ""
    category: str
    price: float
    duration_minutes: int


class ServiceUpdateRequest(BaseModel):
    name: str
    description: str = ""
    category: str
    price: float
    duration_minutes: int


class ServiceRead(BaseModel):
    id: uuid.UUID
    salon_id: uuid.UUID
    name: str
    description: str
    category: str
    price: float
    duration_minutes: int

    model_config = {"from_attributes": True}
