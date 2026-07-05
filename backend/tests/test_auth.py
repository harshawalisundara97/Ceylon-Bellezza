from app.auth.security import hash_password
from app.models import PlatformAdmin, Salon, SalonAdmin


def _make_salon(db_session):
    salon = Salon(slug="glamour-lk", name="Glamour Salon", category="unisex", address="123 Galle Rd", city="Colombo")
    db_session.add(salon)
    db_session.commit()
    return salon


def test_salon_admin_login_success(client, db_session):
    salon = _make_salon(db_session)
    admin = SalonAdmin(salon_id=salon.id, email="owner@glamour.lk", password_hash=hash_password("secret123"))
    db_session.add(admin)
    db_session.commit()

    response = client.post("/auth/salon-admin/login", json={"email": "owner@glamour.lk", "password": "secret123"})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_salon_admin_login_wrong_password(client, db_session):
    salon = _make_salon(db_session)
    admin = SalonAdmin(salon_id=salon.id, email="owner@glamour.lk", password_hash=hash_password("secret123"))
    db_session.add(admin)
    db_session.commit()

    response = client.post("/auth/salon-admin/login", json={"email": "owner@glamour.lk", "password": "wrong"})
    assert response.status_code == 401


def test_platform_admin_login_success(client, db_session):
    admin = PlatformAdmin(email="team@ceylonbellezza.com", password_hash=hash_password("adminpass"))
    db_session.add(admin)
    db_session.commit()

    response = client.post("/auth/platform-admin/login", json={"email": "team@ceylonbellezza.com", "password": "adminpass"})
    assert response.status_code == 200
    assert "access_token" in response.json()
