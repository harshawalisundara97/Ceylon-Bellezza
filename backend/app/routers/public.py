from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ContentBlock, GalleryItem, Salon, Service, Staff
from app.schemas.public import (
    PublicGalleryItemRead,
    PublicSalonDetail,
    PublicSalonSummary,
    PublicServiceRead,
    PublicStaffRead,
)

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
