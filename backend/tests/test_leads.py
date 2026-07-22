from unittest.mock import patch

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


def test_update_status_rejects_non_rejected_value(client, db_session):
    lead = _create_lead(db_session)
    token = _platform_token()
    response = client.patch(
        f"/admin/leads/{lead.id}/status",
        json={"status": "approved"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    db_session.refresh(lead)
    assert lead.status == "pending"


def test_approve_lead_creates_salon_and_admin(client, db_session):
    lead = _create_lead(db_session)
    token = _platform_token()
    with (
        patch("app.routers.leads.geocode_address", return_value=(6.9, 79.8)),
        patch("app.routers.leads.send_owner_invite", return_value=True) as mock_send,
    ):
        response = client.post(
            f"/admin/leads/{lead.id}/approve",
            json={
                "slug": "new-salon",
                "name": "New Salon",
                "category": "unisex",
                "address": "1 Main St",
                "city": "Colombo",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["slug"] == "new-salon"
    assert body["email_sent"] is True
    assert "temporary_password" in body
    mock_send.assert_called_once()

    login = client.post(
        "/auth/salon-admin/login",
        json={"email": "nimal@example.com", "password": body["temporary_password"]},
    )
    assert login.status_code == 200


def test_approve_already_processed_lead_returns_409(client, db_session):
    lead = _create_lead(db_session)
    token = _platform_token()
    headers = {"Authorization": f"Bearer {token}"}
    client.patch(f"/admin/leads/{lead.id}/status", json={"status": "rejected"}, headers=headers)

    with patch("app.routers.leads.geocode_address", return_value=(6.9, 79.8)):
        response = client.post(
            f"/admin/leads/{lead.id}/approve",
            json={"slug": "x", "name": "X", "category": "unisex", "address": "A", "city": "Colombo"},
            headers=headers,
        )
    assert response.status_code == 409


def test_approve_lead_email_failure_does_not_block_salon_creation(client, db_session):
    lead = _create_lead(db_session)
    token = _platform_token()
    with (
        patch("app.routers.leads.geocode_address", return_value=(6.9, 79.8)),
        patch("app.routers.leads.send_owner_invite", return_value=False),
    ):
        response = client.post(
            f"/admin/leads/{lead.id}/approve",
            json={"slug": "new-salon-2", "name": "New Salon 2", "category": "unisex", "address": "A", "city": "Colombo"},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 200
    assert response.json()["email_sent"] is False
