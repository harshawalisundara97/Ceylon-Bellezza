from unittest.mock import patch

from app.auth.security import create_access_token


def _platform_token():
    return create_access_token({"sub": "platform-1", "role": "platform_admin"})


def test_create_salon_geocodes_when_lat_lng_missing(client, db_session):
    token = _platform_token()
    with patch("app.routers.salons.geocode_address", return_value=(6.9271, 79.8612)):
        response = client.post(
            "/admin/salons",
            json={
                "slug": "glamour-lk",
                "name": "Glamour Salon",
                "category": "unisex",
                "address": "123 Galle Rd",
                "city": "Colombo",
                "admin_email": "owner@glamour.lk",
                "admin_password": "secret123",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 201
    body = response.json()
    assert body["slug"] == "glamour-lk"
    assert body["latitude"] == 6.9271
    assert body["longitude"] == 79.8612
    assert body["status"] == "active"


def test_create_salon_requires_platform_admin(client, db_session):
    response = client.post(
        "/admin/salons",
        json={
            "slug": "glamour-lk",
            "name": "Glamour Salon",
            "category": "unisex",
            "address": "123 Galle Rd",
            "city": "Colombo",
            "admin_email": "owner@glamour.lk",
            "admin_password": "secret123",
        },
    )
    assert response.status_code == 401


def test_list_salons(client, db_session):
    token = _platform_token()
    with patch("app.routers.salons.geocode_address", return_value=(6.9, 79.8)):
        client.post(
            "/admin/salons",
            json={
                "slug": "glamour-lk",
                "name": "Glamour Salon",
                "category": "unisex",
                "address": "123 Galle Rd",
                "city": "Colombo",
                "admin_email": "owner@glamour.lk",
                "admin_password": "secret123",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    response = client.get("/admin/salons", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_toggle_modules(client, db_session):
    token = _platform_token()
    with patch("app.routers.salons.geocode_address", return_value=(6.9, 79.8)):
        created = client.post(
            "/admin/salons",
            json={
                "slug": "glamour-lk",
                "name": "Glamour Salon",
                "category": "unisex",
                "address": "123 Galle Rd",
                "city": "Colombo",
                "admin_email": "owner@glamour.lk",
                "admin_password": "secret123",
            },
            headers={"Authorization": f"Bearer {token}"},
        ).json()

    response = client.patch(
        f"/admin/salons/{created['id']}/modules",
        json={"gallery": False, "booking": True, "contact_form": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["enabled_modules"]["gallery"] is False


def test_suspend_salon(client, db_session):
    token = _platform_token()
    with patch("app.routers.salons.geocode_address", return_value=(6.9, 79.8)):
        created = client.post(
            "/admin/salons",
            json={
                "slug": "glamour-lk",
                "name": "Glamour Salon",
                "category": "unisex",
                "address": "123 Galle Rd",
                "city": "Colombo",
                "admin_email": "owner@glamour.lk",
                "admin_password": "secret123",
            },
            headers={"Authorization": f"Bearer {token}"},
        ).json()

    response = client.patch(
        f"/admin/salons/{created['id']}/status",
        json={"status": "suspended"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "suspended"
