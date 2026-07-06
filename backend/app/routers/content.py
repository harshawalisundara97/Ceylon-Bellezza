import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_salon_admin
from app.database import get_db
from app.models import ContentBlock
from app.schemas.content import ContentBlockRead, ContentBlockUpsertRequest

router = APIRouter(prefix="/dashboard/content", tags=["content"])


@router.put("/{key}", response_model=ContentBlockRead)
def upsert_content_block(
    key: str,
    payload: ContentBlockUpsertRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    salon_id = uuid.UUID(admin["salon_id"])
    block = (
        db.query(ContentBlock)
        .filter(ContentBlock.salon_id == salon_id, ContentBlock.key == key)
        .first()
    )
    if block is None:
        block = ContentBlock(salon_id=salon_id, key=key, value=payload.value)
        db.add(block)
    else:
        block.value = payload.value
    db.commit()
    db.refresh(block)
    return block


@router.get("", response_model=list[ContentBlockRead])
def list_content_blocks(admin: dict = Depends(get_current_salon_admin), db: Session = Depends(get_db)):
    return db.query(ContentBlock).filter(ContentBlock.salon_id == uuid.UUID(admin["salon_id"])).all()
