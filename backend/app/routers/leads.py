import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_platform_admin
from app.auth.geocoding import geocode_address
from app.auth.security import hash_password
from app.database import get_db
from app.email import send_owner_invite
from app.models import Salon, SalonAdmin, SalonLead
from app.schemas.lead import LeadApproveRequest, LeadCreateRequest, LeadRead, LeadRejectRequest
from app.schemas.salon import SalonRead

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
    if payload.status != "rejected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint only accepts status 'rejected'; use the approve endpoint to approve a lead",
        )
    lead.status = payload.status
    db.commit()
    db.refresh(lead)
    return lead


@router.post("/admin/leads/{lead_id}/approve", dependencies=[Depends(get_current_platform_admin)])
def approve_lead(lead_id: uuid.UUID, payload: LeadApproveRequest, db: Session = Depends(get_db)):
    lead = db.get(SalonLead, lead_id)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    if lead.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Lead has already been processed")

    latitude, longitude = payload.latitude, payload.longitude
    if latitude is None or longitude is None:
        geocoded = geocode_address(payload.address, payload.city)
        if geocoded is not None:
            latitude, longitude = geocoded

    temp_password = secrets.token_urlsafe(12)

    salon = Salon(
        slug=payload.slug,
        name=payload.name,
        category=payload.category,
        address=payload.address,
        city=payload.city,
        latitude=latitude,
        longitude=longitude,
    )
    db.add(salon)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A salon with this slug already exists")

    admin = SalonAdmin(salon_id=salon.id, email=lead.contact_email, password_hash=hash_password(temp_password))
    db.add(admin)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="An admin with this email already exists"
        )
    db.refresh(salon)

    lead.status = "approved"
    db.commit()

    email_sent = send_owner_invite(lead.contact_email, temp_password, salon.name)

    return {
        **SalonRead.model_validate(salon).model_dump(mode="json"),
        "email_sent": email_sent,
        "temporary_password": temp_password,
    }
