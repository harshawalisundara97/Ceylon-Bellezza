from datetime import datetime, timedelta, timezone

from app.models import Salon, Service, Staff


def _salon_with_service(db_session, slug="salon-1"):
    salon = Salon(slug=slug, name="Salon", category="unisex", address="Addr", city="Colombo")
    db_session.add(salon)
    db_session.commit()
    service = Service(salon_id=salon.id, name="Haircut", description="", category="hair", price=1500.0, duration_minutes=30)
    db_session.add(service)
    db_session.commit()
    return salon, service


def _future_time():
    return (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()


def _valid_payload(service_id, staff_id=None):
    return {
        "service_id": str(service_id),
        "staff_id": str(staff_id) if staff_id else None,
        "scheduled_at": _future_time(),
        "customer_name": "Jane Doe",
        "customer_phone": "0771234567",
        "customer_email": "jane@example.com",
        "gender": "female",
    }


def test_create_booking_success(client, db_session):
    salon, service = _salon_with_service(db_session)

    response = client.post(f"/salons/{salon.slug}/bookings", json=_valid_payload(service.id))

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["salon_id"] == str(salon.id)
    assert body["gender"] == "female"


def test_create_booking_unknown_salon(client, db_session):
    salon, service = _salon_with_service(db_session)

    response = client.post("/salons/does-not-exist/bookings", json=_valid_payload(service.id))

    assert response.status_code == 404


def test_create_booking_service_from_other_salon(client, db_session):
    salon_a, _ = _salon_with_service(db_session, slug="salon-a")
    _, service_b = _salon_with_service(db_session, slug="salon-b")

    response = client.post(f"/salons/{salon_a.slug}/bookings", json=_valid_payload(service_b.id))

    assert response.status_code == 422


def test_create_booking_staff_double_booking_conflict(client, db_session):
    salon, service = _salon_with_service(db_session)
    staff = Staff(salon_id=salon.id, name="Nadeesha", bio="")
    db_session.add(staff)
    db_session.commit()

    payload = _valid_payload(service.id, staff.id)
    first = client.post(f"/salons/{salon.slug}/bookings", json=payload)
    assert first.status_code == 201

    second = client.post(f"/salons/{salon.slug}/bookings", json=payload)
    assert second.status_code == 409


def test_create_booking_invalid_gender(client, db_session):
    salon, service = _salon_with_service(db_session)
    payload = _valid_payload(service.id)
    payload["gender"] = "invalid"

    response = client.post(f"/salons/{salon.slug}/bookings", json=payload)

    assert response.status_code == 422
