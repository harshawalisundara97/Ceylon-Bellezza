from app.models import SalonLead


def test_create_lead(client, db_session):
    response = client.post(
        "/leads",
        json={
            "contact_name": "Nimal Perera",
            "contact_phone": "0771112222",
            "contact_email": "nimal@example.com",
            "message": "I'd like to list my salon.",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert db_session.query(SalonLead).count() == 1
