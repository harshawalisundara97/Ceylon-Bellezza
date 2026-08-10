from app.auth.security import create_access_token
from app.models import Salon, Staff


def _salon_and_token(db_session):
    salon = Salon(slug="salon-1", name="Salon", category="unisex", address="Addr", city="Colombo")
    db_session.add(salon)
    db_session.commit()
    token = create_access_token({"sub": "admin-1", "role": "salon_admin", "salon_id": str(salon.id)})
    return salon, token


def _staff(db_session, salon):
    staff = Staff(salon_id=salon.id, name="Nadeesha", bio="")
    db_session.add(staff)
    db_session.commit()
    return staff


def test_create_and_list_availability(client, db_session):
    salon, token = _salon_and_token(db_session)
    staff = _staff(db_session, salon)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        f"/dashboard/staff/{staff.id}/availability",
        json={"day_of_week": 0, "start_time": "09:00", "end_time": "17:00"},
        headers=headers,
    )
    assert response.status_code == 201
    assert response.json()["staff_id"] == str(staff.id)

    list_response = client.get(f"/dashboard/staff/{staff.id}/availability", headers=headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_update_and_delete_availability(client, db_session):
    salon, token = _salon_and_token(db_session)
    staff = _staff(db_session, salon)
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        f"/dashboard/staff/{staff.id}/availability",
        json={"day_of_week": 0, "start_time": "09:00", "end_time": "17:00"},
        headers=headers,
    ).json()

    update_response = client.put(
        f"/dashboard/staff/{staff.id}/availability/{created['id']}",
        json={"day_of_week": 0, "start_time": "10:00", "end_time": "18:00"},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["start_time"] == "10:00"

    delete_response = client.delete(
        f"/dashboard/staff/{staff.id}/availability/{created['id']}", headers=headers
    )
    assert delete_response.status_code == 204

    list_response = client.get(f"/dashboard/staff/{staff.id}/availability", headers=headers)
    assert list_response.json() == []


def test_availability_wrong_salon_staff_id_404(client, db_session):
    salon_a = Salon(slug="salon-a", name="Salon A", category="unisex", address="Addr A", city="Colombo")
    salon_b = Salon(slug="salon-b", name="Salon B", category="unisex", address="Addr B", city="Kandy")
    db_session.add_all([salon_a, salon_b])
    db_session.commit()
    token_a = create_access_token({"sub": "admin-a", "role": "salon_admin", "salon_id": str(salon_a.id)})
    staff_b = _staff(db_session, salon_b)

    response = client.get(
        f"/dashboard/staff/{staff_b.id}/availability",
        headers={"Authorization": f"Bearer {token_a}"},
    )

    assert response.status_code == 404


def test_availability_wrong_staff_availability_id_404(client, db_session):
    salon, token = _salon_and_token(db_session)
    staff_1 = _staff(db_session, salon)
    staff_2 = Staff(salon_id=salon.id, name="Kasun", bio="")
    db_session.add(staff_2)
    db_session.commit()
    headers = {"Authorization": f"Bearer {token}"}

    created = client.post(
        f"/dashboard/staff/{staff_1.id}/availability",
        json={"day_of_week": 0, "start_time": "09:00", "end_time": "17:00"},
        headers=headers,
    ).json()

    response = client.put(
        f"/dashboard/staff/{staff_2.id}/availability/{created['id']}",
        json={"day_of_week": 0, "start_time": "10:00", "end_time": "18:00"},
        headers=headers,
    )

    assert response.status_code == 404
