import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_salon_admin
from app.database import get_db
from app.models import Staff, StaffAvailability
from app.schemas.staff import StaffCreateRequest, StaffRead, StaffUpdateRequest
from app.schemas.staff_availability import AvailabilityCreateRequest, AvailabilityRead, AvailabilityUpdateRequest

router = APIRouter(prefix="/dashboard/staff", tags=["staff"])


@router.post("", response_model=StaffRead, status_code=status.HTTP_201_CREATED)
def create_staff(
    payload: StaffCreateRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    staff = Staff(salon_id=uuid.UUID(admin["salon_id"]), **payload.model_dump())
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.get("", response_model=list[StaffRead])
def list_staff(admin: dict = Depends(get_current_salon_admin), db: Session = Depends(get_db)):
    return db.query(Staff).filter(Staff.salon_id == uuid.UUID(admin["salon_id"])).all()


def _get_owned_staff(staff_id: uuid.UUID, admin: dict, db: Session) -> Staff:
    staff = db.get(Staff, staff_id)
    if staff is None or staff.salon_id != uuid.UUID(admin["salon_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")
    return staff


@router.patch("/{staff_id}", response_model=StaffRead)
def update_staff(
    staff_id: uuid.UUID,
    payload: StaffUpdateRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    staff = _get_owned_staff(staff_id, admin, db)
    for field, value in payload.model_dump().items():
        setattr(staff, field, value)
    db.commit()
    db.refresh(staff)
    return staff


@router.delete("/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_staff(
    staff_id: uuid.UUID,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    staff = _get_owned_staff(staff_id, admin, db)
    db.delete(staff)
    db.commit()


def _get_owned_availability(availability_id: uuid.UUID, staff_id: uuid.UUID, db: Session) -> StaffAvailability:
    availability = db.get(StaffAvailability, availability_id)
    if availability is None or availability.staff_id != staff_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Availability entry not found")
    return availability


@router.get("/{staff_id}/availability", response_model=list[AvailabilityRead])
def list_availability(
    staff_id: uuid.UUID,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    _get_owned_staff(staff_id, admin, db)
    return db.query(StaffAvailability).filter(StaffAvailability.staff_id == staff_id).all()


@router.post("/{staff_id}/availability", response_model=AvailabilityRead, status_code=status.HTTP_201_CREATED)
def create_availability(
    staff_id: uuid.UUID,
    payload: AvailabilityCreateRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    _get_owned_staff(staff_id, admin, db)
    availability = StaffAvailability(staff_id=staff_id, **payload.model_dump())
    db.add(availability)
    db.commit()
    db.refresh(availability)
    return availability


@router.put("/{staff_id}/availability/{availability_id}", response_model=AvailabilityRead)
def update_availability(
    staff_id: uuid.UUID,
    availability_id: uuid.UUID,
    payload: AvailabilityUpdateRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    _get_owned_staff(staff_id, admin, db)
    availability = _get_owned_availability(availability_id, staff_id, db)
    for field, value in payload.model_dump().items():
        setattr(availability, field, value)
    db.commit()
    db.refresh(availability)
    return availability


@router.delete("/{staff_id}/availability/{availability_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_availability(
    staff_id: uuid.UUID,
    availability_id: uuid.UUID,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    _get_owned_staff(staff_id, admin, db)
    availability = _get_owned_availability(availability_id, staff_id, db)
    db.delete(availability)
    db.commit()
