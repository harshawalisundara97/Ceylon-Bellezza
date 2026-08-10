import uuid

from pydantic import BaseModel, Field


class AvailabilityCreateRequest(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: str
    end_time: str


class AvailabilityUpdateRequest(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: str
    end_time: str


class AvailabilityRead(BaseModel):
    id: uuid.UUID
    staff_id: uuid.UUID
    day_of_week: int
    start_time: str
    end_time: str

    model_config = {"from_attributes": True}
