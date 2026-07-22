from app.auth.security import create_access_token
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


def _platform_token():
    return create_access_token({"sub": "platform-1", "role": "platform_admin"})


def _create_lead(db_session):
    lead = SalonLead(
        contact_name="Nimal Perera",
        contact_phone="0771112222",
        contact_email="nimal@example.com",
        message="I'd like to list my salon.",
    )
    db_session.add(lead)
    db_session.commit()
    return lead


def test_list_leads_requires_platform_admin(client, db_session):
    response = client.get("/admin/leads")
    assert response.status_code == 401


def test_list_leads(client, db_session):
    _create_lead(db_session)
    token = _platform_token()
    response = client.get("/admin/leads", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_reject_lead(client, db_session):
    lead = _create_lead(db_session)
    token = _platform_token()
    response = client.patch(
        f"/admin/leads/{lead.id}/status",
        json={"status": "rejected"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"


def test_reject_already_processed_lead_returns_409(client, db_session):
    lead = _create_lead(db_session)
    token = _platform_token()
    headers = {"Authorization": f"Bearer {token}"}
    client.patch(f"/admin/leads/{lead.id}/status", json={"status": "rejected"}, headers=headers)
    second = client.patch(f"/admin/leads/{lead.id}/status", json={"status": "rejected"}, headers=headers)
    assert second.status_code == 409
