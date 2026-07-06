import uuid

from pydantic import BaseModel


class ContentBlockUpsertRequest(BaseModel):
    value: str


class ContentBlockRead(BaseModel):
    id: uuid.UUID
    salon_id: uuid.UUID
    key: str
    value: str

    model_config = {"from_attributes": True}
