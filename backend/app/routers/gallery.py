import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_salon_admin
from app.database import get_db
from app.models import GalleryItem
from app.schemas.gallery import GalleryItemCreateRequest, GalleryItemRead

router = APIRouter(prefix="/dashboard/gallery", tags=["gallery"])


@router.post("", response_model=GalleryItemRead, status_code=status.HTTP_201_CREATED)
def create_gallery_item(
    payload: GalleryItemCreateRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    item = GalleryItem(salon_id=uuid.UUID(admin["salon_id"]), **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("", response_model=list[GalleryItemRead])
def list_gallery_items(admin: dict = Depends(get_current_salon_admin), db: Session = Depends(get_db)):
    return db.query(GalleryItem).filter(GalleryItem.salon_id == uuid.UUID(admin["salon_id"])).all()


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_gallery_item(
    item_id: uuid.UUID,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    item = db.get(GalleryItem, item_id)
    if item is None or item.salon_id != uuid.UUID(admin["salon_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gallery item not found")
    db.delete(item)
    db.commit()
