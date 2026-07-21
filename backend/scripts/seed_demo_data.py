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
    {
        "slug": "serendib-beauty-kandy",
        "name": "Serendib Beauty Lounge",
        "category": "womens",
        "address": "88 Peradeniya Road",
        "city": "Kandy",
        "latitude": 7.2906,
        "longitude": 80.6337,
        "admin_email": "owner@serendibbeauty.lk",
        "admin_password": "serendib123",
        "services": [
            {
                "name": "Signature Blowout",
                "category": "hair",
                "price": 3000.0,
                "duration_minutes": 50,
                "description": "Wash, blow-dry, and finish for a salon-fresh look.",
            },
            {
                "name": "Keratin Treatment",
                "category": "hair",
                "price": 12000.0,
                "duration_minutes": 150,
                "description": "Smoothing treatment for frizz-free, glossy hair.",
            },
            {
                "name": "Party Makeup",
                "category": "makeup",
                "price": 5500.0,
                "duration_minutes": 60,
                "description": "Full face makeup for events and special occasions.",
            },
        ],
        "staff": [
            {
                "name": "Dilani Wickramasinghe",
                "bio": "Creative director, trained in London.",
                "photo_url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80",
            },
            {
                "name": "Ruwangi Jayasuriya",
                "bio": "Makeup artist specializing in bridal and editorial looks.",
                "photo_url": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80",
            },
        ],
        "gallery": [
            {
                "image_url": "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80",
                "caption": "Styling stations",
            },
            {
                "image_url": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80",
                "caption": "Event-ready makeup",
            },
        ],
        "content": {
            "about_us": "Serendib Beauty Lounge brings Kandy a boutique salon experience, blending international techniques with warm Sri Lankan hospitality.",
            "contact_info": "Open Mon-Sat, 9am-6.30pm. Call 081-222-3344 to book.",
        },
    },
    {
        "slug": "royal-barber-galle",
        "name": "Royal Barber Co.",
        "category": "mens",
        "address": "12 Lighthouse Street, Galle Fort",
        "city": "Galle",
        "latitude": 6.0329,
        "longitude": 80.2168,
        "admin_email": "owner@royalbarber.lk",
        "admin_password": "royalbarber123",
        "services": [
            {
                "name": "Fort Signature Cut",
                "category": "hair",
                "price": 1800.0,
                "duration_minutes": 35,
                "description": "Modern cut with a wash and style finish.",
            },
            {
                "name": "Beard Sculpting",
                "category": "grooming",
                "price": 1000.0,
                "duration_minutes": 25,
                "description": "Precision beard shaping with hot towel finish.",
            },
            {
                "name": "Head & Shoulder Massage",
                "category": "grooming",
                "price": 1500.0,
                "duration_minutes": 30,
                "description": "Relaxing massage to relieve tension.",
            },
        ],
        "staff": [
            {
                "name": "Chamara Rathnayake",
                "bio": "Owner-barber, 15+ years in the trade.",
                "photo_url": "https://images.unsplash.com/photo-1618077360395-f3068be8e001?w=400&q=80",
            },
        ],
        "gallery": [
            {
                "image_url": "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80",
                "caption": "Barber station",
            },
        ],
        "content": {
            "about_us": "Royal Barber Co. sits inside historic Galle Fort, offering classic grooming with sea-breeze charm.",
            "contact_info": "Open daily, 9am-7pm. Walk-ins welcome, call 091-222-5566 to reserve.",
        },
    },
    {
        "slug": "negombo-hair-studio",
        "name": "Negombo Hair & Beauty Studio",
        "category": "unisex",
        "address": "210 Lewis Place",
        "city": "Negombo",
        "latitude": 7.2083,
        "longitude": 79.8358,
        "admin_email": "owner@negombohair.lk",
        "admin_password": "negombo123",
        "services": [
            {
                "name": "Unisex Haircut",
                "category": "hair",
                "price": 1500.0,
                "duration_minutes": 30,
                "description": "Cut and style for any hair type.",
            },
            {
                "name": "Hair Spa Treatment",
                "category": "hair",
                "price": 4000.0,
                "duration_minutes": 60,
                "description": "Deep conditioning treatment for damaged or dry hair.",
            },
        ],
        "staff": [
            {
                "name": "Sanduni Gunawardena",
                "bio": "Stylist and colorist.",
                "photo_url": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80",
            },
            {
                "name": "Ashan Peiris",
                "bio": "Barber and grooming specialist.",
                "photo_url": "https://images.unsplash.com/photo-1618077360395-f3068be8e001?w=400&q=80",
            },
        ],
        "gallery": [
            {
                "image_url": "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80",
                "caption": "Salon floor",
            },
        ],
        "content": {
            "about_us": "A family-friendly salon near Negombo beach, serving the whole community since 2018.",
            "contact_info": "Open Tue-Sun, 9am-7pm. Call 031-222-7788 to book.",
        },
    },
    {
        "slug": "jaffna-glow-salon",
        "name": "Jaffna Glow Beauty Salon",
        "category": "womens",
        "address": "56 Hospital Road",
        "city": "Jaffna",
        "latitude": 9.6615,
        "longitude": 80.0255,
        "admin_email": "owner@jaffnaglow.lk",
        "admin_password": "jaffnaglow123",
        "services": [
            {
                "name": "Classic Haircut & Style",
                "category": "hair",
                "price": 1800.0,
                "duration_minutes": 40,
                "description": "Cut and style tailored to face shape.",
            },
            {
                "name": "Bridal Package",
                "category": "bridal",
                "price": 18000.0,
                "duration_minutes": 210,
                "description": "Complete bridal hair and makeup package.",
            },
        ],
        "staff": [
            {
                "name": "Kavya Thevarajah",
                "bio": "Bridal specialist with 8 years of experience.",
                "photo_url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80",
            },
        ],
        "gallery": [
            {
                "image_url": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80",
                "caption": "Bridal styling",
            },
        ],
        "content": {
            "about_us": "Jaffna Glow Beauty Salon is the north's trusted name for bridal beauty and everyday styling.",
            "contact_info": "Open Mon-Sat, 9.30am-6pm. Call 021-222-9900 to book.",
        },
    },
    {
        "slug": "kurunegala-gentlemens-grooming",
        "name": "Kurunegala Gentlemen's Grooming",
        "category": "mens",
        "address": "34 Kandy Road",
        "city": "Kurunegala",
        "latitude": 7.4863,
        "longitude": 80.3623,
        "admin_email": "owner@kurunegalagrooming.lk",
        "admin_password": "kurunegala123",
        "services": [
            {
                "name": "Executive Haircut",
                "category": "hair",
                "price": 1300.0,
                "duration_minutes": 30,
                "description": "Sharp, professional cut and style.",
            },
            {
                "name": "Traditional Shave",
                "category": "grooming",
                "price": 900.0,
                "duration_minutes": 25,
                "description": "Classic straight-razor shave with hot towel.",
            },
        ],
        "staff": [
            {
                "name": "Nuwan Bandara",
                "bio": "Barber, trained in classic and modern techniques.",
                "photo_url": "https://images.unsplash.com/photo-1618077360395-f3068be8e001?w=400&q=80",
            },
        ],
        "gallery": [
            {
                "image_url": "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80",
                "caption": "Grooming chairs",
            },
        ],
        "content": {
            "about_us": "Kurunegala Gentlemen's Grooming offers classic barbering with modern comfort in the heart of town.",
            "contact_info": "Open daily, 8.30am-8pm. Walk-ins welcome.",
        },
    },
    {
        "slug": "tea-hills-spa-nuwara-eliya",
        "name": "Tea Hills Spa & Salon",
        "category": "unisex",
        "address": "5 Grand Hotel Road",
        "city": "Nuwara Eliya",
        "latitude": 6.9497,
        "longitude": 80.7891,
        "admin_email": "owner@teahillsspa.lk",
        "admin_password": "teahills123",
        "services": [
            {
                "name": "Mountain Fresh Haircut",
                "category": "hair",
                "price": 1700.0,
                "duration_minutes": 35,
                "description": "Cut and style for any hair type.",
            },
            {
                "name": "Aromatherapy Facial",
                "category": "skincare",
                "price": 4500.0,
                "duration_minutes": 50,
                "description": "Relaxing facial using locally sourced tea and herbal extracts.",
            },
        ],
        "staff": [
            {
                "name": "Ishara Fernando",
                "bio": "Spa therapist and hairstylist.",
                "photo_url": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80",
            },
        ],
        "gallery": [
            {
                "image_url": "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80",
                "caption": "Spa and salon interior",
            },
        ],
        "content": {
            "about_us": "Tea Hills Spa & Salon offers a relaxing retreat in the cool climate of Nuwara Eliya, blending hair care with spa treatments.",
            "contact_info": "Open daily, 9am-6pm. Call 052-222-3311 to book.",
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
