from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Booking, ContentBlock, GalleryItem, Salon, Service, Staff
from app.schemas.public import (
    PublicGalleryItemRead,
    PublicSalonDetail,
    PublicSalonSummary,
    PublicServiceRead,
    PublicStaffRead,
)
from app.schemas.booking import BookingCreateRequest, BookingRead

router = APIRouter(prefix="/salons", tags=["public"])


@router.get("", response_model=list[PublicSalonSummary])
def list_active_salons(db: Session = Depends(get_db)):
    return db.query(Salon).filter(Salon.status == "active").all()


@router.get("/{slug}", response_model=PublicSalonDetail)
def get_salon_by_slug(slug: str, db: Session = Depends(get_db)):
    salon = db.query(Salon).filter(Salon.slug == slug, Salon.status == "active").first()
    if salon is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salon not found")

    services = db.query(Service).filter(Service.salon_id == salon.id).all()
    staff = db.query(Staff).filter(Staff.salon_id == salon.id).all()
    gallery = db.query(GalleryItem).filter(GalleryItem.salon_id == salon.id).all()
    content_blocks = db.query(ContentBlock).filter(ContentBlock.salon_id == salon.id).all()

    return PublicSalonDetail(
        id=salon.id,
        slug=salon.slug,
        name=salon.name,
        category=salon.category,
        city=salon.city,
        address=salon.address,
        template_settings=salon.template_settings,
        services=[PublicServiceRead.model_validate(s) for s in services],
        staff=[PublicStaffRead.model_validate(s) for s in staff],
        gallery=[PublicGalleryItemRead.model_validate(g) for g in gallery],
        content={block.key: block.value for block in content_blocks},
    )


@router.post("/{slug}/bookings", response_model=BookingRead, status_code=status.HTTP_201_CREATED)
def create_booking(slug: str, payload: BookingCreateRequest, db: Session = Depends(get_db)):
    salon = db.query(Salon).filter(Salon.slug == slug, Salon.status == "active").first()
    if salon is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salon not found")

    service = db.get(Service, payload.service_id)
    if service is None or service.salon_id != salon.id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Service does not belong to this salon")

    if payload.staff_id is not None:
        staff = db.get(Staff, payload.staff_id)
        if staff is None or staff.salon_id != salon.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Staff member does not belong to this salon"
            )

    booking = Booking(
        salon_id=salon.id,
        service_id=payload.service_id,
        staff_id=payload.staff_id,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        customer_email=payload.customer_email,
        gender=payload.gender.value,
        scheduled_at=payload.scheduled_at,
        status="pending",
    )
    db.add(booking)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="This staff member is already booked at that time"
        )
    db.refresh(booking)
    return booking
