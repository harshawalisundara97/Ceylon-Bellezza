import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class Gender(str, Enum):
    male = "male"
    female = "female"
    other = "other"


class BookingCreateRequest(BaseModel):
    service_id: uuid.UUID
    staff_id: uuid.UUID | None = None
    scheduled_at: datetime
    customer_name: str
    customer_phone: str
    customer_email: str
    gender: Gender


class BookingRead(BaseModel):
    id: uuid.UUID
    salon_id: uuid.UUID
    service_id: uuid.UUID
    staff_id: uuid.UUID | None
    customer_name: str
    customer_phone: str
    customer_email: str
    gender: str
    scheduled_at: datetime
    status: str

    model_config = {"from_attributes": True}


class DashboardBookingRead(BookingRead):
    service_name: str
    staff_name: str | None


class BookingStatusUpdateRequest(BaseModel):
    status: str
