import uuid
from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_salon_admin
from app.database import get_db
from app.models import Booking, Service, Staff
from app.schemas.booking import BookingRead, BookingStatusUpdateRequest, DashboardBookingRead

router = APIRouter(prefix="/dashboard/bookings", tags=["bookings"])


@router.get("", response_model=list[DashboardBookingRead])
def list_bookings(
    from_date: date | None = None,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    effective_from = from_date or date.today()
    start = datetime.combine(effective_from, time.min, tzinfo=timezone.utc)

    rows = (
        db.query(Booking, Service.name, Staff.name)
        .join(Service, Booking.service_id == Service.id)
        .outerjoin(Staff, Booking.staff_id == Staff.id)
        .filter(Booking.salon_id == uuid.UUID(admin["salon_id"]), Booking.scheduled_at >= start)
        .order_by(Booking.scheduled_at.asc())
        .all()
    )

    return [
        DashboardBookingRead(
            **BookingRead.model_validate(booking).model_dump(),
            service_name=service_name,
            staff_name=staff_name,
        )
        for booking, service_name, staff_name in rows
    ]


def _get_owned_booking(booking_id: uuid.UUID, admin: dict, db: Session) -> Booking:
    booking = db.get(Booking, booking_id)
    if booking is None or booking.salon_id != uuid.UUID(admin["salon_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return booking


@router.patch("/{booking_id}", response_model=BookingRead)
def update_booking_status(
    booking_id: uuid.UUID,
    payload: BookingStatusUpdateRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    booking = _get_owned_booking(booking_id, admin, db)
    booking.status = payload.status
    db.commit()
    db.refresh(booking)
    return booking
