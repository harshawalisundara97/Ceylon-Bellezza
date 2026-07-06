from app.auth.security import create_access_token
from app.models import Salon


def _salon_and_token(db_session):
    salon = Salon(slug="salon-1", name="Salon", category="unisex", address="Addr", city="Colombo")
    db_session.add(salon)
    db_session.commit()
    token = create_access_token({"sub": "admin-1", "role": "salon_admin", "salon_id": str(salon.id)})
    return salon, token


def test_upsert_creates_then_updates_content_block(client, db_session):
    salon, token = _salon_and_token(db_session)
    headers = {"Authorization": f"Bearer {token}"}

    first = client.put("/dashboard/content/about_us", json={"value": "We are a full-service salon."}, headers=headers)
    assert first.status_code == 200
    assert first.json()["key"] == "about_us"

    second = client.put("/dashboard/content/about_us", json={"value": "Updated about text."}, headers=headers)
    assert second.status_code == 200
    assert second.json()["value"] == "Updated about text."

    listed = client.get("/dashboard/content", headers=headers)
    assert len(listed.json()) == 1
