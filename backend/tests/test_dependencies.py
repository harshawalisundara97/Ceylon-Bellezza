import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth.dependencies import get_current_platform_admin, get_current_salon_admin
from app.auth.security import create_access_token

test_app = FastAPI()


@test_app.get("/platform-only")
def platform_only(admin=Depends(get_current_platform_admin)):
    return {"id": admin["id"]}


@test_app.get("/salon-only")
def salon_only(admin=Depends(get_current_salon_admin)):
    return {"id": admin["id"], "salon_id": admin["salon_id"]}


client = TestClient(test_app)


def test_platform_admin_dependency_accepts_platform_token():
    token = create_access_token({"sub": "admin-1", "role": "platform_admin"})
    response = client.get("/platform-only", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == {"id": "admin-1"}


def test_platform_admin_dependency_rejects_salon_token():
    token = create_access_token({"sub": "admin-1", "role": "salon_admin", "salon_id": "salon-1"})
    response = client.get("/platform-only", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_salon_admin_dependency_accepts_salon_token():
    token = create_access_token({"sub": "admin-2", "role": "salon_admin", "salon_id": "salon-9"})
    response = client.get("/salon-only", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == {"id": "admin-2", "salon_id": "salon-9"}


def test_missing_token_rejected():
    response = client.get("/salon-only")
    assert response.status_code == 401
