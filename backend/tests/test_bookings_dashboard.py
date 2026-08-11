from datetime import datetime, timedelta, timezone

from app.auth.security import create_access_token
from app.models import Booking, Salon, Service, Staff


def _salon_and_token(db_session):
    salon = Salon(slug="salon-1", name="Salon", category="unisex", address="Addr", city="Colombo")
    db_session.add(salon)
    db_session.commit()
    token = create_access_token({"sub": "admin-1", "role": "salon_admin", "salon_id": str(salon.id)})
    return salon, token


def _service_and_staff(db_session, salon):
    service = Service(salon_id=salon.id, name="Haircut", description="", category="hair", price=1500.0, duration_minutes=30)
    staff = Staff(salon_id=salon.id, name="Nadeesha", bio="")
    db_session.add_all([service, staff])
    db_session.commit()
    return service, staff


def _booking(salon, service, staff, when, gender="female"):
    return Booking(
        salon_id=salon.id,
        service_id=service.id,
        staff_id=staff.id if staff else None,
        customer_name="Jane Doe",
        customer_phone="0771234567",
        customer_email="jane@example.com",
        gender=gender,
        scheduled_at=when,
        status="pending",
    )


def test_list_bookings_today_and_future_only(client, db_session):
    salon, token = _salon_and_token(db_session)
    service, staff = _service_and_staff(db_session, salon)
    past = _booking(salon, service, None, datetime.now(timezone.utc) - timedelta(days=1))
    future = _booking(salon, service, None, datetime.now(timezone.utc) + timedelta(days=1))
    db_session.add_all([past, future])
    db_session.commit()

    response = client.get("/dashboard/bookings", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == str(future.id)


def test_list_bookings_tenant_isolation(client, db_session):
    salon_a = Salon(slug="salon-a", name="Salon A", category="unisex", address="Addr A", city="Colombo")
    salon_b = Salon(slug="salon-b", name="Salon B", category="unisex", address="Addr B", city="Kandy")
    db_session.add_all([salon_a, salon_b])
    db_session.commit()
    token_a = create_access_token({"sub": "admin-a", "role": "salon_admin", "salon_id": str(salon_a.id)})

    service_b, _ = _service_and_staff(db_session, salon_b)
    db_session.add(_booking(salon_b, service_b, None, datetime.now(timezone.utc) + timedelta(days=1)))
    db_session.commit()

    response = client.get("/dashboard/bookings", headers={"Authorization": f"Bearer {token_a}"})

    assert response.json() == []


def test_list_bookings_includes_service_and_staff_names(client, db_session):
    salon, token = _salon_and_token(db_session)
    service, staff = _service_and_staff(db_session, salon)
    db_session.add(_booking(salon, service, staff, datetime.now(timezone.utc) + timedelta(days=1)))
    db_session.commit()

    response = client.get("/dashboard/bookings", headers={"Authorization": f"Bearer {token}"})

    body = response.json()[0]
    assert body["service_name"] == "Haircut"
    assert body["staff_name"] == "Nadeesha"
    assert body["gender"] == "female"


def test_update_booking_status(client, db_session):
    salon, token = _salon_and_token(db_session)
    service, staff = _service_and_staff(db_session, salon)
    booking = _booking(salon, service, staff, datetime.now(timezone.utc) + timedelta(days=1))
    db_session.add(booking)
    db_session.commit()

    response = client.patch(
        f"/dashboard/bookings/{booking.id}",
        json={"status": "confirmed"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"


def test_update_booking_status_wrong_salon_404(client, db_session):
    salon_a = Salon(slug="salon-a", name="Salon A", category="unisex", address="Addr A", city="Colombo")
    salon_b = Salon(slug="salon-b", name="Salon B", category="unisex", address="Addr B", city="Kandy")
    db_session.add_all([salon_a, salon_b])
    db_session.commit()
    token_a = create_access_token({"sub": "admin-a", "role": "salon_admin", "salon_id": str(salon_a.id)})

    service_b, staff_b = _service_and_staff(db_session, salon_b)
    booking_b = _booking(salon_b, service_b, staff_b, datetime.now(timezone.utc) + timedelta(days=1))
    db_session.add(booking_b)
    db_session.commit()

    response = client.patch(
        f"/dashboard/bookings/{booking_b.id}",
        json={"status": "confirmed"},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    assert response.status_code == 404


def test_update_booking_status_rejects_invalid_value(client, db_session):
    salon, token = _salon_and_token(db_session)
    service, staff = _service_and_staff(db_session, salon)
    booking = _booking(salon, service, staff, datetime.now(timezone.utc) + timedelta(days=1))
    db_session.add(booking)
    db_session.commit()

    response = client.patch(
        f"/dashboard/bookings/{booking.id}",
        json={"status": "made-up-status"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422


def test_update_booking_status_accepts_completed(client, db_session):
    salon, token = _salon_and_token(db_session)
    service, staff = _service_and_staff(db_session, salon)
    booking = _booking(salon, service, staff, datetime.now(timezone.utc) + timedelta(days=1))
    db_session.add(booking)
    db_session.commit()

    response = client.patch(
        f"/dashboard/bookings/{booking.id}",
        json={"status": "completed"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "completed"


def test_list_bookings_to_date_excludes_later_days(client, db_session):
    salon, token = _salon_and_token(db_session)
    service, staff = _service_and_staff(db_session, salon)
    target_day = datetime.now(timezone.utc) + timedelta(days=1)
    day_after = target_day + timedelta(days=1)
    in_range = _booking(salon, service, staff, target_day)
    out_of_range = _booking(salon, service, staff, day_after)
    db_session.add_all([in_range, out_of_range])
    db_session.commit()

    response = client.get(
        "/dashboard/bookings",
        params={"from_date": target_day.date().isoformat(), "to_date": target_day.date().isoformat()},
        headers={"Authorization": f"Bearer {token}"},
    )

    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == str(in_range.id)


def test_list_bookings_status_filter(client, db_session):
    salon, token = _salon_and_token(db_session)
    service, staff = _service_and_staff(db_session, salon)
    when = datetime.now(timezone.utc) + timedelta(days=1)
    pending = _booking(salon, service, staff, when)
    confirmed = _booking(salon, service, staff, when + timedelta(hours=1))
    confirmed.status = "confirmed"
    db_session.add_all([pending, confirmed])
    db_session.commit()

    response = client.get(
        "/dashboard/bookings",
        params={"status": "confirmed"},
        headers={"Authorization": f"Bearer {token}"},
    )

    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == str(confirmed.id)
