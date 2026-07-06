from app.auth.security import create_access_token
from app.models import Salon


def _salon_and_token(db_session):
    salon = Salon(slug="salon-1", name="Salon", category="unisex", address="Addr", city="Colombo")
    db_session.add(salon)
    db_session.commit()
    token = create_access_token({"sub": "admin-1", "role": "salon_admin", "salon_id": str(salon.id)})
    return salon, token


def test_create_and_list_staff(client, db_session):
    salon, token = _salon_and_token(db_session)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post("/dashboard/staff", json={"name": "Nadeesha", "bio": "Hair stylist"}, headers=headers)
    assert response.status_code == 201
    assert response.json()["salon_id"] == str(salon.id)

    list_response = client.get("/dashboard/staff", headers=headers)
    assert len(list_response.json()) == 1


def test_update_and_delete_staff(client, db_session):
    salon, token = _salon_and_token(db_session)
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post("/dashboard/staff", json={"name": "Nadeesha", "bio": "Hair stylist"}, headers=headers).json()

    update_response = client.patch(
        f"/dashboard/staff/{created['id']}", json={"name": "Nadeesha Perera", "bio": "Senior stylist"}, headers=headers
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Nadeesha Perera"

    delete_response = client.delete(f"/dashboard/staff/{created['id']}", headers=headers)
    assert delete_response.status_code == 204
