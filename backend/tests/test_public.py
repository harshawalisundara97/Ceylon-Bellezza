from app.models import ContentBlock, GalleryItem, Salon, Service, Staff


def test_list_active_salons_excludes_suspended(client, db_session):
    active = Salon(
        slug="active-salon", name="Active Salon", category="unisex", address="Addr", city="Colombo", status="active"
    )
    suspended = Salon(
        slug="suspended-salon",
        name="Suspended Salon",
        category="unisex",
        address="Addr",
        city="Colombo",
        status="suspended",
    )
    db_session.add_all([active, suspended])
    db_session.commit()

    response = client.get("/salons")
    assert response.status_code == 200
    slugs = [s["slug"] for s in response.json()]
    assert slugs == ["active-salon"]


def test_get_salon_by_slug_returns_full_payload(client, db_session):
    salon = Salon(
        slug="glamour-lk",
        name="Glamour Salon",
        category="unisex",
        address="123 Galle Rd",
        city="Colombo",
        status="active",
    )
    db_session.add(salon)
    db_session.commit()

    db_session.add(Service(salon_id=salon.id, name="Haircut", category="hair", price=1500.0, duration_minutes=30))
    db_session.add(Staff(salon_id=salon.id, name="Nadeesha", bio="Stylist"))
    db_session.add(GalleryItem(salon_id=salon.id, image_url="https://cdn.example.com/a.jpg", caption="Look 1"))
    db_session.add(ContentBlock(salon_id=salon.id, key="about_us", value="We are great"))
    db_session.commit()

    response = client.get(f"/salons/{salon.slug}")
    assert response.status_code == 200
    body = response.json()
    assert body["slug"] == "glamour-lk"
    assert len(body["services"]) == 1
    assert len(body["staff"]) == 1
    assert len(body["gallery"]) == 1
    assert body["content"] == {"about_us": "We are great"}


def test_get_salon_by_slug_404_for_unknown_slug(client, db_session):
    response = client.get("/salons/does-not-exist")
    assert response.status_code == 404


def test_get_salon_by_slug_404_for_suspended_salon(client, db_session):
    salon = Salon(
        slug="suspended-salon", name="Suspended", category="unisex", address="Addr", city="Colombo", status="suspended"
    )
    db_session.add(salon)
    db_session.commit()

    response = client.get(f"/salons/{salon.slug}")
    assert response.status_code == 404
