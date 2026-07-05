from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.security import create_access_token, verify_password
from app.database import get_db
from app.models import PlatformAdmin, SalonAdmin

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/salon-admin/login", response_model=TokenResponse)
def salon_admin_login(payload: LoginRequest, db: Session = Depends(get_db)):
    admin = db.query(SalonAdmin).filter(SalonAdmin.email == payload.email).first()
    if admin is None or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token({"sub": str(admin.id), "role": "salon_admin", "salon_id": str(admin.salon_id)})
    return TokenResponse(access_token=token)


@router.post("/platform-admin/login", response_model=TokenResponse)
def platform_admin_login(payload: LoginRequest, db: Session = Depends(get_db)):
    admin = db.query(PlatformAdmin).filter(PlatformAdmin.email == payload.email).first()
    if admin is None or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token({"sub": str(admin.id), "role": "platform_admin"})
    return TokenResponse(access_token=token)
