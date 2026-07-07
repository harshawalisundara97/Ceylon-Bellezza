from app.auth.security import create_access_token
from app.models import GalleryItem, Salon, Service, Staff


def _two_salons_with_tokens(db_session):
    salon_a = Salon(slug="salon-a", name="Salon A", category="unisex", address="Addr A", city="Colombo")
    salon_b = Salon(slug="salon-b", name="Salon B", category="unisex", address="Addr B", city="Kandy")
    db_session.add_all([salon_a, salon_b])
    db_session.commit()

    token_a = create_access_token({"sub": "admin-a", "role": "salon_admin", "salon_id": str(salon_a.id)})
    token_b = create_access_token({"sub": "admin-b", "role": "salon_admin", "salon_id": str(salon_b.id)})
    return salon_a, salon_b, token_a, token_b


def test_salon_a_cannot_see_salon_b_services(client, db_session):
    salon_a, salon_b, token_a, token_b = _two_salons_with_tokens(db_session)
    db_session.add(Service(salon_id=salon_b.id, name="Beard Trim", category="grooming", price=800.0, duration_minutes=20))
    db_session.commit()

    response = client.get("/dashboard/services", headers={"Authorization": f"Bearer {token_a}"})
    assert response.json() == []


def test_salon_a_cannot_update_salon_b_service(client, db_session):
    salon_a, salon_b, token_a, token_b = _two_salons_with_tokens(db_session)
    service_b = Service(salon_id=salon_b.id, name="Beard Trim", category="grooming", price=800.0, duration_minutes=20)
    db_session.add(service_b)
    db_session.commit()

    response = client.patch(
        f"/dashboard/services/{service_b.id}",
        json={"name": "Hacked", "category": "grooming", "price": 1.0, "duration_minutes": 5},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert response.status_code == 404


def test_salon_a_cannot_delete_salon_b_staff(client, db_session):
    salon_a, salon_b, token_a, token_b = _two_salons_with_tokens(db_session)
    staff_b = Staff(salon_id=salon_b.id, name="Kasun", bio="Barber")
    db_session.add(staff_b)
    db_session.commit()

    response = client.delete(f"/dashboard/staff/{staff_b.id}", headers={"Authorization": f"Bearer {token_a}"})
    assert response.status_code == 404


def test_salon_a_cannot_see_salon_b_gallery(client, db_session):
    salon_a, salon_b, token_a, token_b = _two_salons_with_tokens(db_session)
    db_session.add(GalleryItem(salon_id=salon_b.id, image_url="https://cdn.example.com/b.jpg"))
    db_session.commit()

    response = client.get("/dashboard/gallery", headers={"Authorization": f"Bearer {token_a}"})
    assert response.json() == []
