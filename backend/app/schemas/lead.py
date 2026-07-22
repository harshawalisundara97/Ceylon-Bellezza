import uuid
from datetime import datetime

from pydantic import BaseModel


class LeadCreateRequest(BaseModel):
    contact_name: str
    contact_phone: str
    contact_email: str
    message: str = ""


class LeadRead(BaseModel):
    id: uuid.UUID
    contact_name: str
    contact_phone: str
    contact_email: str
    message: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LeadRejectRequest(BaseModel):
    status: str  # only "rejected" is meaningful; enforced in the router


class LeadApproveRequest(BaseModel):
    slug: str
    name: str
    category: str
    address: str
    city: str
    latitude: float | None = None
    longitude: float | None = None
