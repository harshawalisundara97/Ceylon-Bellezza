"""One-off script to seed demo data for local development.

Run with: cd backend && .venv/bin/python scripts/seed_demo_data.py
"""

from fastapi.testclient import TestClient

from app.auth.security import hash_password
from app.database import SessionLocal
from app.main import app
from app.models import PlatformAdmin

PLATFORM_ADMIN_EMAIL = "admin@ceylonbellezza.com"
PLATFORM_ADMIN_PASSWORD = "admin123"

SALONS = [
    {
        "slug": "glamour-lk",
        "name": "Glamour Salon Colombo",
        "category": "unisex",
        "address": "123 Galle Road",
        "city": "Colombo",
        "latitude": 6.9271,
        "longitude": 79.8612,
        "admin_email": "owner@glamour.lk",
        "admin_password": "glamour123",
        "services": [
            {
                "name": "Women's Haircut",
                "category": "hair",
                "price": 2500.0,
                "duration_minutes": 45,
                "description": "Wash, cut, and style.",
            },
            {
                "name": "Hair Coloring",
                "category": "hair",
                "price": 6500.0,
                "duration_minutes": 120,
                "description": "Full color with premium products.",
            },
            {
                "name": "Bridal Makeup",
                "category": "bridal",
                "price": 15000.0,
                "duration_minutes": 180,
                "description": "Full bridal makeup and hair styling.",
            },
        ],
        "staff": [
            {
                "name": "Nadeesha Perera",
                "bio": "Senior stylist, 10+ years experience.",
                "photo_url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80",
            },
            {
                "name": "Kavindi Silva",
                "bio": "Color specialist.",
                "photo_url": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80",
            },
        ],
        "gallery": [
            {
                "image_url": "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80",
                "caption": "Salon interior",
            },
            {
                "image_url": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80",
                "caption": "Bridal look",
            },
        ],
        "content": {
            "about_us": "Glamour Salon Colombo has been Colombo's go-to destination for hair and bridal beauty since 2015.",
            "contact_info": "Open Tue-Sun, 9am-7pm. Call 011-234-5678 to book.",
        },
    },
    {
        "slug": "the-gents-room",
        "name": "The Gents Room",
        "category": "mens",
        "address": "45 Marine Drive",
        "city": "Colombo",
        "latitude": 6.9147,
        "longitude": 79.8489,
        "admin_email": "owner@gentsroom.lk",
        "admin_password": "gents123",
        "services": [
            {
                "name": "Classic Haircut",
                "category": "hair",
                "price": 1200.0,
                "duration_minutes": 30,
                "description": "Precision cut and style.",
            },
            {
                "name": "Beard Trim & Shape",
                "category": "grooming",
                "price": 800.0,
                "duration_minutes": 20,
                "description": "Trim, shape, and hot towel finish.",
            },
            {
                "name": "Hot Towel Shave",
                "category": "grooming",
                "price": 1500.0,
                "duration_minutes": 40,
                "description": "Traditional straight-razor shave.",
            },
        ],
        "staff": [
            {
                "name": "Kasun Fernando",
                "bio": "Master barber.",
                "photo_url": "https://images.unsplash.com/photo-1618077360395-f3068be8e001?w=400&q=80",
            },
        ],
        "gallery": [
            {
                "image_url": "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80",
                "caption": "Barber chairs",
            },
        ],
        "content": {
            "about_us": "The Gents Room is a classic barbershop bringing old-school grooming to modern Colombo.",
            "contact_info": "Open daily, 10am-8pm. Walk-ins welcome.",
        },
    },
]


def ensure_platform_admin() -> None:
    db = SessionLocal()
    try:
        existing = db.query(PlatformAdmin).filter(PlatformAdmin.email == PLATFORM_ADMIN_EMAIL).first()
        if existing is None:
            db.add(PlatformAdmin(email=PLATFORM_ADMIN_EMAIL, password_hash=hash_password(PLATFORM_ADMIN_PASSWORD)))
            db.commit()
            print(f"Created platform admin: {PLATFORM_ADMIN_EMAIL}")
        else:
            print(f"Platform admin already exists: {PLATFORM_ADMIN_EMAIL}")
    finally:
        db.close()


def main() -> None:
    ensure_platform_admin()
    client = TestClient(app)

    login = client.post(
        "/auth/platform-admin/login",
        json={"email": PLATFORM_ADMIN_EMAIL, "password": PLATFORM_ADMIN_PASSWORD},
    )
    login.raise_for_status()
    platform_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    for salon_data in SALONS:
        salon_data = dict(salon_data)
        services = salon_data.pop("services")
        staff = salon_data.pop("staff")
        gallery = salon_data.pop("gallery")
        content = salon_data.pop("content")

        create_response = client.post("/admin/salons", json=salon_data, headers=platform_headers)
        if create_response.status_code == 409:
            print(f"Salon already exists, skipping: {salon_data['slug']}")
            continue
        create_response.raise_for_status()
        print(f"Created salon: {salon_data['slug']}")

        salon_login = client.post(
            "/auth/salon-admin/login",
            json={"email": salon_data["admin_email"], "password": salon_data["admin_password"]},
        )
        salon_login.raise_for_status()
        salon_headers = {"Authorization": f"Bearer {salon_login.json()['access_token']}"}

        for service in services:
            client.post("/dashboard/services", json=service, headers=salon_headers).raise_for_status()
        for staff_member in staff:
            client.post("/dashboard/staff", json=staff_member, headers=salon_headers).raise_for_status()
        for item in gallery:
            client.post("/dashboard/gallery", json=item, headers=salon_headers).raise_for_status()
        for key, value in content.items():
            client.put(f"/dashboard/content/{key}", json={"value": value}, headers=salon_headers).raise_for_status()

        print(f"Populated services/staff/gallery/content for: {salon_data['slug']}")


if __name__ == "__main__":
    main()
