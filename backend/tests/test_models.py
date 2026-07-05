import uuid

from app.models import Salon, Service


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
