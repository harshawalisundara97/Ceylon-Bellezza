from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError

from app.auth.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/salon-admin/login", auto_error=False)


def _decode_or_401(token: str | None) -> dict:
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        return decode_access_token(token)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def get_current_platform_admin(token: str | None = Depends(oauth2_scheme)) -> dict:
    payload = _decode_or_401(token)
    if payload.get("role") != "platform_admin":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Platform admin access required")
    return {"id": payload["sub"]}


def get_current_salon_admin(token: str | None = Depends(oauth2_scheme)) -> dict:
    payload = _decode_or_401(token)
    if payload.get("role") != "salon_admin":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Salon admin access required")
    return {"id": payload["sub"], "salon_id": payload["salon_id"]}
