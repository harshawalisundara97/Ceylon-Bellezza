import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_salon_admin
from app.database import get_db
from app.models import Service
from app.schemas.service import ServiceCreateRequest, ServiceRead, ServiceUpdateRequest

router = APIRouter(prefix="/dashboard/services", tags=["services"])


@router.post("", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
def create_service(
    payload: ServiceCreateRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    service = Service(salon_id=uuid.UUID(admin["salon_id"]), **payload.model_dump())
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.get("", response_model=list[ServiceRead])
def list_services(admin: dict = Depends(get_current_salon_admin), db: Session = Depends(get_db)):
    return db.query(Service).filter(Service.salon_id == uuid.UUID(admin["salon_id"])).all()


def _get_owned_service(service_id: uuid.UUID, admin: dict, db: Session) -> Service:
    service = db.get(Service, service_id)
    if service is None or service.salon_id != uuid.UUID(admin["salon_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    return service


@router.patch("/{service_id}", response_model=ServiceRead)
def update_service(
    service_id: uuid.UUID,
    payload: ServiceUpdateRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    service = _get_owned_service(service_id, admin, db)
    for field, value in payload.model_dump().items():
        setattr(service, field, value)
    db.commit()
    db.refresh(service)
    return service


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(
    service_id: uuid.UUID,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    service = _get_owned_service(service_id, admin, db)
    db.delete(service)
    db.commit()
