from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import SalonLead
from app.schemas.lead import LeadCreateRequest, LeadRead

router = APIRouter(tags=["leads"])


@router.post("/leads", response_model=LeadRead, status_code=status.HTTP_201_CREATED)
def create_lead(payload: LeadCreateRequest, db: Session = Depends(get_db)):
    lead = SalonLead(**payload.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead
