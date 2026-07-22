import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_platform_admin
from app.database import get_db
from app.models import SalonLead
from app.schemas.lead import LeadCreateRequest, LeadRead, LeadRejectRequest

router = APIRouter(tags=["leads"])


@router.post("/leads", response_model=LeadRead, status_code=status.HTTP_201_CREATED)
def create_lead(payload: LeadCreateRequest, db: Session = Depends(get_db)):
    lead = SalonLead(**payload.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.get("/admin/leads", response_model=list[LeadRead], dependencies=[Depends(get_current_platform_admin)])
def list_leads(db: Session = Depends(get_db)):
    return db.query(SalonLead).order_by(SalonLead.created_at.desc()).all()


@router.patch(
    "/admin/leads/{lead_id}/status", response_model=LeadRead, dependencies=[Depends(get_current_platform_admin)]
)
def update_lead_status(lead_id: uuid.UUID, payload: LeadRejectRequest, db: Session = Depends(get_db)):
    lead = db.get(SalonLead, lead_id)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    if lead.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Lead has already been processed")
    lead.status = payload.status
    db.commit()
    db.refresh(lead)
    return lead
