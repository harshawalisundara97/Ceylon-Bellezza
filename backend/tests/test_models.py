import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Booking, ContentBlock, Salon, Service, Staff


def test_create_salon_and_service(db_session):
    salon = Salon(
        slug="glamour-lk",
        name="Glamour Salon",
        category="unisex",
        address="123 Galle Rd",
        city="Colombo",
    )
    db_session.add(salon)
    db_session.commit()

    service = Service(
        salon_id=salon.id,
        name="Haircut",
        category="hair",
        price=1500.00,
        duration_minutes=30,
    )
    db_session.add(service)
    db_session.commit()

    assert isinstance(salon.id, uuid.UUID)
    assert service.salon_id == salon.id
    assert salon.enabled_modules == {"gallery": True, "booking": True, "contact_form": True}


def test_booking_unique_constraint_prevents_double_booking(db_session):
    salon = Salon(
        slug="unique-booking-lk",
        name="Unique Booking Salon",
        category="unisex",
        address="456 Galle Rd",
        city="Colombo",
    )
    db_session.add(salon)
    db_session.commit()

    service = Service(
        salon_id=salon.id,
        name="Haircut",
        category="hair",
        price=1500.00,
        duration_minutes=30,
    )
    staff = Staff(
        salon_id=salon.id,
        name="Jane Stylist",
    )
    db_session.add_all([service, staff])
    db_session.commit()

    scheduled_at = datetime(2026, 8, 1, 10, 0, tzinfo=timezone.utc)

    booking_one = Booking(
        salon_id=salon.id,
        service_id=service.id,
        staff_id=staff.id,
        customer_name="Alice",
        customer_phone="0771234567",
        customer_email="alice@example.com",
        scheduled_at=scheduled_at,
    )
    db_session.add(booking_one)
    db_session.commit()

    booking_two = Booking(
        salon_id=salon.id,
        service_id=service.id,
        staff_id=staff.id,
        customer_name="Bob",
        customer_phone="0777654321",
        customer_email="bob@example.com",
        scheduled_at=scheduled_at,
    )
    db_session.add(booking_two)
    with pytest.raises(IntegrityError):
        db_session.commit()

    db_session.rollback()


def test_content_block_unique_constraint_prevents_duplicate_key(db_session):
    salon = Salon(
        slug="unique-content-lk",
        name="Unique Content Salon",
        category="unisex",
        address="789 Galle Rd",
        city="Colombo",
    )
    db_session.add(salon)
    db_session.commit()

    block_one = ContentBlock(
        salon_id=salon.id,
        key="about_us",
        value="We are a great salon.",
    )
    db_session.add(block_one)
    db_session.commit()

    block_two = ContentBlock(
        salon_id=salon.id,
        key="about_us",
        value="A different description.",
    )
    db_session.add(block_two)
    with pytest.raises(IntegrityError):
        db_session.commit()

    db_session.rollback()
