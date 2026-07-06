from app.auth.security import create_access_token
from app.models import Salon


def _salon_and_token(db_session):
    salon = Salon(slug="salon-1", name="Salon", category="unisex", address="Addr", city="Colombo")
    db_session.add(salon)
    db_session.commit()
    token = create_access_token({"sub": "admin-1", "role": "salon_admin", "salon_id": str(salon.id)})
    return salon, token


def test_create_list_and_delete_gallery_item(client, db_session):
    salon, token = _salon_and_token(db_session)
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        "/dashboard/gallery", json={"image_url": "https://cdn.example.com/photo1.jpg", "caption": "Bridal look"}, headers=headers
    )
    assert created.status_code == 201
    assert created.json()["salon_id"] == str(salon.id)

    listed = client.get("/dashboard/gallery", headers=headers)
    assert len(listed.json()) == 1

    deleted = client.delete(f"/dashboard/gallery/{created.json()['id']}", headers=headers)
    assert deleted.status_code == 204
    assert client.get("/dashboard/gallery", headers=headers).json() == []
