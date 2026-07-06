import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_platform_admin
from app.auth.geocoding import geocode_address
from app.auth.security import hash_password
from app.database import get_db
from app.models import Salon, SalonAdmin
from app.schemas.salon import ModuleToggleRequest, SalonCreateRequest, SalonRead, StatusUpdateRequest

router = APIRouter(prefix="/admin/salons", tags=["salons"], dependencies=[Depends(get_current_platform_admin)])


@router.post("", response_model=SalonRead, status_code=status.HTTP_201_CREATED)
def create_salon(payload: SalonCreateRequest, db: Session = Depends(get_db)):
    latitude, longitude = payload.latitude, payload.longitude
    if latitude is None or longitude is None:
        geocoded = geocode_address(payload.address, payload.city)
        if geocoded is not None:
            latitude, longitude = geocoded

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
    db.commit()
    db.refresh(salon)

    admin = SalonAdmin(salon_id=salon.id, email=payload.admin_email, password_hash=hash_password(payload.admin_password))
    db.add(admin)
    db.commit()

    return salon


@router.get("", response_model=list[SalonRead])
def list_salons(db: Session = Depends(get_db)):
    return db.query(Salon).all()


@router.patch("/{salon_id}/modules", response_model=SalonRead)
def toggle_modules(salon_id: uuid.UUID, payload: ModuleToggleRequest, db: Session = Depends(get_db)):
    salon = db.get(Salon, salon_id)
    if salon is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salon not found")
    salon.enabled_modules = payload.model_dump()
    db.commit()
    db.refresh(salon)
    return salon


@router.patch("/{salon_id}/status", response_model=SalonRead)
def update_status(salon_id: uuid.UUID, payload: StatusUpdateRequest, db: Session = Depends(get_db)):
    salon = db.get(Salon, salon_id)
    if salon is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salon not found")
    salon.status = payload.status
    db.commit()
    db.refresh(salon)
    return salon
