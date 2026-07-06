from app.auth.security import create_access_token
from app.models import Salon


def _salon_and_token(db_session, salon_id_suffix="1"):
    salon = Salon(slug=f"salon-{salon_id_suffix}", name="Salon", category="unisex", address="Addr", city="Colombo")
    db_session.add(salon)
    db_session.commit()
    token = create_access_token({"sub": "admin-1", "role": "salon_admin", "salon_id": str(salon.id)})
    return salon, token


def test_create_and_list_services(client, db_session):
    salon, token = _salon_and_token(db_session)
    headers = {"Authorization": f"Bearer {token}"}

    create_response = client.post(
        "/dashboard/services",
        json={"name": "Haircut", "category": "hair", "price": 1500.0, "duration_minutes": 30},
        headers=headers,
    )
    assert create_response.status_code == 201
    assert create_response.json()["salon_id"] == str(salon.id)

    list_response = client.get("/dashboard/services", headers=headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_update_service(client, db_session):
    salon, token = _salon_and_token(db_session)
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/dashboard/services",
        json={"name": "Haircut", "category": "hair", "price": 1500.0, "duration_minutes": 30},
        headers=headers,
    ).json()

    response = client.patch(
        f"/dashboard/services/{created['id']}",
        json={"name": "Premium Haircut", "category": "hair", "price": 2000.0, "duration_minutes": 45},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Premium Haircut"


def test_delete_service(client, db_session):
    salon, token = _salon_and_token(db_session)
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/dashboard/services",
        json={"name": "Haircut", "category": "hair", "price": 1500.0, "duration_minutes": 30},
        headers=headers,
    ).json()

    response = client.delete(f"/dashboard/services/{created['id']}", headers=headers)
    assert response.status_code == 204

    list_response = client.get("/dashboard/services", headers=headers)
    assert list_response.json() == []
