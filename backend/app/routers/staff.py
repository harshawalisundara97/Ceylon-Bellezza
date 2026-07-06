import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_salon_admin
from app.database import get_db
from app.models import Staff
from app.schemas.staff import StaffCreateRequest, StaffRead, StaffUpdateRequest

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
