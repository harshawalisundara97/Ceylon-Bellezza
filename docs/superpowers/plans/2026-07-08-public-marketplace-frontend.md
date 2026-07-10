# Public Marketplace Frontend (Plan 4a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public (unauthenticated) backend endpoints for the salon directory and salon pages, seed demo data, and build the Next.js homepage and per-salon public pages — giving Ceylon Bellezza its first real, browsable website. Booking submission is explicitly out of scope (Plan 4b).

**Architecture:** One new unauthenticated FastAPI router aggregates each salon's data (services/staff/gallery/content) into a single response per page, avoiding N+1 frontend fetches. A new Next.js 14 (App Router) project at `frontend/` server-renders the homepage and salon pages by calling that API directly from React Server Components — no client-side data fetching, full SEO.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic (backend additions — no new dependencies). Next.js 14, TypeScript, Tailwind CSS, Framer Motion (new frontend project).

## Global Constraints

- Public endpoints never return data for a non-`active` salon and never 500 on a bad/missing slug — always a clean 404, and a suspended salon must be indistinguishable from a nonexistent one in the response (matches the tenant-isolation "don't leak existence" pattern already used in Plan 1).
- No new database tables or migrations — the public API is a read-only aggregation over existing Plan 1 models.
- Frontend pages are React Server Components fetching server-side; no booking UI is built in this plan (a disabled "Book Appointment" button with a "Coming soon" tooltip is the only trace of it).
- Demo data must be created through the existing authenticated backend APIs wherever an API exists for that purpose (salon creation, services, staff, gallery, content) — direct database writes are only acceptable for the one thing with no API by design: creating the very first platform admin account.

---

## File Structure

```
backend/
  app/
    schemas/public.py             # PublicSalonSummary, PublicServiceRead, PublicStaffRead, PublicGalleryItemRead, PublicSalonDetail
    routers/public.py               # GET /salons, GET /salons/{slug}
    main.py                           # + register public.router
  scripts/
    seed_demo_data.py                  # one-off local dev data seeding script
  tests/
    test_public.py                       # public endpoint tests

frontend/
  package.json
  tsconfig.json
  next.config.mjs
  tailwind.config.ts
  postcss.config.mjs
  .env.local.example
  .gitignore
  app/
    layout.tsx                       # root layout
    globals.css                        # Tailwind directives
    page.tsx                             # homepage
    salons/[slug]/
      page.tsx                             # salon public page
      not-found.tsx                          # custom 404
  components/
    SalonCard.tsx                        # homepage grid item
    SearchBar.tsx                          # client-side filter input
    SalonDirectory.tsx                       # client component: search state + grid
    SalonHero.tsx                              # salon page hero + disabled booking button
    ServiceList.tsx                              # services grouped by category
    StaffList.tsx                                  # staff cards
    GalleryGrid.tsx                                  # photo grid
    AboutContact.tsx                                   # about/contact content blocks
  lib/
    types.ts                                           # TypeScript types mirroring backend public schemas
    api.ts                                               # getSalons(), getSalonBySlug()
```

---

### Task 1: Backend public API

**Files:**
- Create: `backend/app/schemas/public.py`
- Create: `backend/app/routers/public.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_public.py`

**Interfaces:**
- Consumes: `app.database.get_db` (Plan 1 Task 1), `app.models.Salon/Service/Staff/GalleryItem/ContentBlock` (Plan 1 Task 2).
- Produces: `PublicSalonSummary`, `PublicSalonDetail` (and nested `PublicServiceRead`, `PublicStaffRead`, `PublicGalleryItemRead`) in `app.schemas.public` — Task 3/4/5 (frontend) mirror these field names exactly in `frontend/lib/types.ts`. Router mounted with prefix `/salons` — no auth dependency.

- [ ] **Step 1: Write `backend/app/schemas/public.py`**

```python
import uuid

from pydantic import BaseModel


class PublicSalonSummary(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    category: str
    city: str
    template_settings: dict

    model_config = {"from_attributes": True}


class PublicServiceRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    category: str
    price: float
    duration_minutes: int

    model_config = {"from_attributes": True}


class PublicStaffRead(BaseModel):
    id: uuid.UUID
    name: str
    photo_url: str | None
    bio: str

    model_config = {"from_attributes": True}


class PublicGalleryItemRead(BaseModel):
    id: uuid.UUID
    image_url: str
    caption: str

    model_config = {"from_attributes": True}


class PublicSalonDetail(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    category: str
    city: str
    address: str
    template_settings: dict
    services: list[PublicServiceRead]
    staff: list[PublicStaffRead]
    gallery: list[PublicGalleryItemRead]
    content: dict[str, str]
```

- [ ] **Step 2: Write the failing test `backend/tests/test_public.py`**

```python
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
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && .venv/bin/pytest tests/test_public.py -v
```

Expected: FAIL with 404 (no `/salons` route registered yet — the existing `/admin/salons` and `/dashboard/services` routers don't cover this path).

- [ ] **Step 4: Write `backend/app/routers/public.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ContentBlock, GalleryItem, Salon, Service, Staff
from app.schemas.public import (
    PublicGalleryItemRead,
    PublicSalonDetail,
    PublicSalonSummary,
    PublicServiceRead,
    PublicStaffRead,
)

router = APIRouter(prefix="/salons", tags=["public"])


@router.get("", response_model=list[PublicSalonSummary])
def list_active_salons(db: Session = Depends(get_db)):
    return db.query(Salon).filter(Salon.status == "active").all()


@router.get("/{slug}", response_model=PublicSalonDetail)
def get_salon_by_slug(slug: str, db: Session = Depends(get_db)):
    salon = db.query(Salon).filter(Salon.slug == slug, Salon.status == "active").first()
    if salon is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salon not found")

    services = db.query(Service).filter(Service.salon_id == salon.id).all()
    staff = db.query(Staff).filter(Staff.salon_id == salon.id).all()
    gallery = db.query(GalleryItem).filter(GalleryItem.salon_id == salon.id).all()
    content_blocks = db.query(ContentBlock).filter(ContentBlock.salon_id == salon.id).all()

    return PublicSalonDetail(
        id=salon.id,
        slug=salon.slug,
        name=salon.name,
        category=salon.category,
        city=salon.city,
        address=salon.address,
        template_settings=salon.template_settings,
        services=[PublicServiceRead.model_validate(s) for s in services],
        staff=[PublicStaffRead.model_validate(s) for s in staff],
        gallery=[PublicGalleryItemRead.model_validate(g) for g in gallery],
        content={block.key: block.value for block in content_blocks},
    )
```

- [ ] **Step 5: Register the router in `backend/app/main.py`**

```python
from fastapi import FastAPI

from app.routers import auth, content, gallery, public, salons, services, staff

app = FastAPI(title="Ceylon Bellezza API")
app.include_router(auth.router)
app.include_router(salons.router)
app.include_router(services.router)
app.include_router(staff.router)
app.include_router(gallery.router)
app.include_router(content.router)
app.include_router(public.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd backend && .venv/bin/pytest tests/test_public.py -v
```

Expected: PASS (4/4).

- [ ] **Step 7: Run the full backend suite to confirm no regressions**

```bash
cd backend && .venv/bin/pytest -v
```

Expected: all tests pass (34 existing + 4 new = 38).

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas/public.py backend/app/routers/public.py backend/app/main.py backend/tests/test_public.py
git commit -m "feat: add public salon directory and salon detail API"
```

---

### Task 2: Seed demo data

**Files:**
- Create: `backend/scripts/seed_demo_data.py`

**Interfaces:**
- Consumes: the live FastAPI app (`app.main.app`) via `fastapi.testclient.TestClient`, run against the real dev database (`app.database.SessionLocal`, not a test fixture) — `/auth/platform-admin/login`, `/admin/salons` (Plan 1 Task 7), `/auth/salon-admin/login` (Plan 1 Task 6), `/dashboard/services`, `/dashboard/staff`, `/dashboard/gallery`, `/dashboard/content/{key}` (Plan 1 Tasks 8-11).
- Produces: two seeded salons (`glamour-lk`, `the-gents-room`) with services/staff/gallery/content, reachable afterward via Task 1's `GET /salons` and `GET /salons/{slug}`.

- [ ] **Step 1: Write `backend/scripts/seed_demo_data.py`**

```python
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
```

- [ ] **Step 2: Run the script against the local dev database**

```bash
pg_isready || brew services start postgresql@15
cd backend && .venv/bin/python scripts/seed_demo_data.py
```

Expected output: `Created platform admin: ...`, then `Created salon: glamour-lk`, `Populated services/staff/gallery/content for: glamour-lk`, `Created salon: the-gents-room`, `Populated services/staff/gallery/content for: the-gents-room`.

- [ ] **Step 3: Verify via the public API**

```bash
cd backend && .venv/bin/uvicorn app.main:app --port 8000 &
sleep 2
curl -s http://localhost:8000/salons | python3 -m json.tool
curl -s http://localhost:8000/salons/glamour-lk | python3 -m json.tool
kill %1
```

Expected: the first command lists both salons; the second shows `glamour-lk`'s full payload with 3 services, 2 staff, 2 gallery items, and both content keys.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/seed_demo_data.py
git commit -m "chore: add demo data seeding script for local development"
```

---

### Task 3: Next.js project scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/next.config.mjs`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.mjs`
- Create: `frontend/.env.local.example`
- Create: `frontend/.gitignore`
- Create: `frontend/app/layout.tsx`
- Create: `frontend/app/globals.css`
- Create: `frontend/app/page.tsx`
- Create: `frontend/lib/types.ts`
- Create: `frontend/lib/api.ts`

**Interfaces:**
- Consumes: Task 1's public API response shapes (mirrored field-for-field in `lib/types.ts`).
- Produces: `getSalons(): Promise<SalonSummary[]>` and `getSalonBySlug(slug: string): Promise<SalonDetail | null>` in `frontend/lib/api.ts` — Tasks 4 and 5 import these directly. Path alias `@/*` maps to `frontend/*`.

- [ ] **Step 1: Write `frontend/package.json`**

```json
{
  "name": "ceylon-bellezza-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.15",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "framer-motion": "11.11.9"
  },
  "devDependencies": {
    "typescript": "5.6.3",
    "@types/node": "20.16.11",
    "@types/react": "18.3.11",
    "@types/react-dom": "18.3.1",
    "tailwindcss": "3.4.13",
    "postcss": "8.4.47",
    "autoprefixer": "10.4.20"
  }
}
```

- [ ] **Step 2: Write `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `frontend/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Write `frontend/tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#B8860B",
          dark: "#8B6508",
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 5: Write `frontend/postcss.config.mjs`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Write `frontend/.env.local.example` and `frontend/.gitignore`**

`frontend/.env.local.example`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

`frontend/.gitignore`:
```
node_modules/
.next/
.env.local
```

- [ ] **Step 7: Write `frontend/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 8: Write `frontend/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ceylon Bellezza",
  description: "Find and book the best salons near you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Write a minimal `frontend/app/page.tsx` (Task 4 replaces this with the real homepage)**

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-semibold">Ceylon Bellezza</h1>
    </main>
  );
}
```

- [ ] **Step 10: Write `frontend/lib/types.ts`**

```ts
export interface SalonSummary {
  id: string;
  slug: string;
  name: string;
  category: string;
  city: string;
  template_settings: Record<string, unknown>;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration_minutes: number;
}

export interface Staff {
  id: string;
  name: string;
  photo_url: string | null;
  bio: string;
}

export interface GalleryItem {
  id: string;
  image_url: string;
  caption: string;
}

export interface SalonDetail {
  id: string;
  slug: string;
  name: string;
  category: string;
  city: string;
  address: string;
  template_settings: Record<string, unknown>;
  services: Service[];
  staff: Staff[];
  gallery: GalleryItem[];
  content: Record<string, string>;
}
```

- [ ] **Step 11: Write `frontend/lib/api.ts`**

```ts
import { SalonDetail, SalonSummary } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function getSalons(): Promise<SalonSummary[]> {
  const response = await fetch(`${API_URL}/salons`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch salons: ${response.status}`);
  }
  return response.json();
}

export async function getSalonBySlug(slug: string): Promise<SalonDetail | null> {
  const response = await fetch(`${API_URL}/salons/${slug}`, { cache: "no-store" });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch salon ${slug}: ${response.status}`);
  }
  return response.json();
}
```

- [ ] **Step 12: Install dependencies and verify the dev server boots**

```bash
cd frontend && npm install
cp .env.local.example .env.local
npm run dev &
sleep 5
curl -s http://localhost:3000 | grep -o "Ceylon Bellezza"
kill %1
```

Expected: `npm install` succeeds, `next-env.d.ts` is auto-generated in `frontend/`, and the curl output prints `Ceylon Bellezza` (confirming the page rendered without a build error).

- [ ] **Step 13: Commit**

```bash
git add frontend/
git commit -m "chore: scaffold Next.js frontend with Tailwind and API client"
```

---

### Task 4: Homepage

**Files:**
- Create: `frontend/components/SalonCard.tsx`
- Create: `frontend/components/SearchBar.tsx`
- Create: `frontend/components/SalonDirectory.tsx`
- Modify: `frontend/app/page.tsx`

**Interfaces:**
- Consumes: `getSalons()` (Task 3's `lib/api.ts`), `SalonSummary` (Task 3's `lib/types.ts`).
- Produces: `SalonDirectory` component taking `{ initialSalons: SalonSummary[] }` — the only prop later tasks would need if they touched this page.

- [ ] **Step 1: Write `frontend/components/SalonCard.tsx`**

```tsx
import Link from "next/link";
import { motion } from "framer-motion";
import { SalonSummary } from "@/lib/types";

function coverImage(salon: SalonSummary): string {
  const settings = salon.template_settings as { hero_image?: string };
  return settings.hero_image ?? "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80";
}

export default function SalonCard({ salon }: { salon: SalonSummary }) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 12px 24px rgba(0,0,0,0.12)" }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white"
    >
      <Link href={`/salons/${salon.slug}`}>
        <img src={coverImage(salon)} alt={salon.name} className="h-48 w-full object-cover" />
        <div className="p-4">
          <span className="inline-block rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand-dark">
            {salon.category}
          </span>
          <h3 className="mt-2 text-lg font-semibold">{salon.name}</h3>
          <p className="text-sm text-gray-500">{salon.city}</p>
        </div>
      </Link>
    </motion.div>
  );
}
```

- [ ] **Step 2: Write `frontend/components/SearchBar.tsx`**

```tsx
"use client";

export default function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search by salon name or city..."
      className="w-full max-w-md rounded-full border border-gray-300 px-5 py-3 text-sm shadow-sm focus:border-brand focus:outline-none"
    />
  );
}
```

- [ ] **Step 3: Write `frontend/components/SalonDirectory.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { SalonSummary } from "@/lib/types";
import SalonCard from "./SalonCard";
import SearchBar from "./SearchBar";

export default function SalonDirectory({ initialSalons }: { initialSalons: SalonSummary[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return initialSalons;
    return initialSalons.filter(
      (salon) => salon.name.toLowerCase().includes(normalized) || salon.city.toLowerCase().includes(normalized)
    );
  }, [initialSalons, query]);

  return (
    <div>
      <div className="flex justify-center py-8">
        <SearchBar value={query} onChange={setQuery} />
      </div>
      {filtered.length === 0 ? (
        <p className="py-16 text-center text-gray-500">
          {initialSalons.length === 0 ? "No salons yet — check back soon." : "No salons match your search."}
        </p>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          className="grid grid-cols-1 gap-6 px-6 pb-16 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filtered.map((salon) => (
            <motion.div key={salon.id} variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
              <SalonCard salon={salon} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Replace `frontend/app/page.tsx`**

```tsx
import { getSalons } from "@/lib/api";
import SalonDirectory from "@/components/SalonDirectory";

export default async function HomePage() {
  const salons = await getSalons();

  return (
    <main>
      <section className="bg-brand/5 px-6 py-16 text-center">
        <h1 className="text-4xl font-bold text-brand-dark">Ceylon Bellezza</h1>
        <p className="mt-3 text-lg text-gray-600">Find and book the best salons near you.</p>
      </section>
      <SalonDirectory initialSalons={salons} />
    </main>
  );
}
```

- [ ] **Step 5: Verify against the seeded data**

```bash
pg_isready || brew services start postgresql@15
cd backend && .venv/bin/uvicorn app.main:app --port 8000 &
cd ../frontend && npm run dev &
sleep 5
curl -s http://localhost:3000 | grep -o "Glamour Salon Colombo"
curl -s http://localhost:3000 | grep -o "The Gents Room"
kill %1 %2
```

Expected: both salon names appear in the rendered HTML (confirms server-side fetch + render worked against the real backend and Task 2's seeded data).

- [ ] **Step 6: Commit**

```bash
git add frontend/components/SalonCard.tsx frontend/components/SearchBar.tsx frontend/components/SalonDirectory.tsx frontend/app/page.tsx
git commit -m "feat: build homepage with salon directory grid and search"
```

---

### Task 5: Salon public page

**Files:**
- Create: `frontend/components/SalonHero.tsx`
- Create: `frontend/components/ServiceList.tsx`
- Create: `frontend/components/StaffList.tsx`
- Create: `frontend/components/GalleryGrid.tsx`
- Create: `frontend/components/AboutContact.tsx`
- Create: `frontend/app/salons/[slug]/page.tsx`
- Create: `frontend/app/salons/[slug]/not-found.tsx`

**Interfaces:**
- Consumes: `getSalonBySlug()` (Task 3's `lib/api.ts`), `SalonDetail`/`Service`/`Staff`/`GalleryItem` (Task 3's `lib/types.ts`).

- [ ] **Step 1: Write `frontend/components/SalonHero.tsx`**

```tsx
import { SalonDetail } from "@/lib/types";

function coverImage(salon: SalonDetail): string {
  const settings = salon.template_settings as { hero_image?: string };
  return settings.hero_image ?? "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80";
}

export default function SalonHero({ salon }: { salon: SalonDetail }) {
  return (
    <section className="relative">
      <img src={coverImage(salon)} alt={salon.name} className="h-72 w-full object-cover sm:h-96" />
      <div className="bg-white px-6 py-6 text-center">
        <span className="inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand-dark">
          {salon.category}
        </span>
        <h1 className="mt-2 text-3xl font-bold">{salon.name}</h1>
        <p className="mt-1 text-gray-500">{salon.city}</p>
        <button
          disabled
          title="Coming soon"
          className="mt-4 cursor-not-allowed rounded-full bg-gray-300 px-6 py-3 text-sm font-medium text-gray-600"
        >
          Book Appointment
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `frontend/components/ServiceList.tsx`**

```tsx
import { Service } from "@/lib/types";

function groupByCategory(services: Service[]): Record<string, Service[]> {
  return services.reduce<Record<string, Service[]>>((groups, service) => {
    (groups[service.category] ??= []).push(service);
    return groups;
  }, {});
}

export default function ServiceList({ services }: { services: Service[] }) {
  const grouped = groupByCategory(services);

  return (
    <section className="px-6 py-10">
      <h2 className="text-2xl font-semibold">Services</h2>
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="mt-6">
          <h3 className="text-sm font-medium uppercase tracking-wide text-gray-400">{category}</h3>
          <ul className="mt-3 divide-y divide-gray-100">
            {items.map((service) => (
              <li key={service.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-sm text-gray-500">{service.duration_minutes} min</p>
                </div>
                <p className="font-semibold text-brand-dark">Rs. {service.price.toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 3: Write `frontend/components/StaffList.tsx`**

```tsx
import { Staff } from "@/lib/types";

export default function StaffList({ staff }: { staff: Staff[] }) {
  return (
    <section className="bg-gray-50 px-6 py-10">
      <h2 className="text-2xl font-semibold">Our Team</h2>
      <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {staff.map((member) => (
          <div key={member.id} className="text-center">
            <img
              src={member.photo_url ?? "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80"}
              alt={member.name}
              className="mx-auto h-24 w-24 rounded-full object-cover"
            />
            <p className="mt-2 font-medium">{member.name}</p>
            <p className="text-sm text-gray-500">{member.bio}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Write `frontend/components/GalleryGrid.tsx`**

```tsx
import { GalleryItem } from "@/lib/types";

export default function GalleryGrid({ items }: { items: GalleryItem[] }) {
  return (
    <section className="px-6 py-10">
      <h2 className="text-2xl font-semibold">Gallery</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <img
            key={item.id}
            src={item.image_url}
            alt={item.caption || "Gallery photo"}
            className="aspect-square w-full rounded-lg object-cover"
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Write `frontend/components/AboutContact.tsx`**

```tsx
export default function AboutContact({ content }: { content: Record<string, string> }) {
  if (!content.about_us && !content.contact_info) {
    return null;
  }

  return (
    <section className="bg-gray-50 px-6 py-10">
      {content.about_us && (
        <div>
          <h2 className="text-2xl font-semibold">About Us</h2>
          <p className="mt-3 max-w-2xl text-gray-600">{content.about_us}</p>
        </div>
      )}
      {content.contact_info && (
        <div className="mt-6">
          <h2 className="text-2xl font-semibold">Contact</h2>
          <p className="mt-3 max-w-2xl text-gray-600">{content.contact_info}</p>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Write `frontend/app/salons/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getSalonBySlug } from "@/lib/api";
import SalonHero from "@/components/SalonHero";
import ServiceList from "@/components/ServiceList";
import StaffList from "@/components/StaffList";
import GalleryGrid from "@/components/GalleryGrid";
import AboutContact from "@/components/AboutContact";

export default async function SalonPage({ params }: { params: { slug: string } }) {
  const salon = await getSalonBySlug(params.slug);

  if (!salon) {
    notFound();
  }

  return (
    <main>
      <SalonHero salon={salon} />
      <ServiceList services={salon.services} />
      {salon.staff.length > 0 && <StaffList staff={salon.staff} />}
      {salon.gallery.length > 0 && <GalleryGrid items={salon.gallery} />}
      <AboutContact content={salon.content} />
    </main>
  );
}
```

- [ ] **Step 7: Write `frontend/app/salons/[slug]/not-found.tsx`**

```tsx
export default function SalonNotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold">Salon not found</h1>
      <p className="mt-3 text-gray-500">This salon doesn&apos;t exist or isn&apos;t available right now.</p>
    </main>
  );
}
```

- [ ] **Step 8: Verify against the seeded data**

```bash
pg_isready || brew services start postgresql@15
cd backend && .venv/bin/uvicorn app.main:app --port 8000 &
cd ../frontend && npm run dev &
sleep 5
curl -s http://localhost:3000/salons/glamour-lk | grep -o "Women's Haircut"
curl -s http://localhost:3000/salons/glamour-lk | grep -o "Nadeesha Perera"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/salons/does-not-exist
kill %1 %2
```

Expected: first two greps find the expected content (service and staff names rendered); the third command prints `200` (Next.js serves the custom not-found page with a 200 status by default in the App Router dev server — this is expected Next.js behavior, not a bug).

- [ ] **Step 9: Commit**

```bash
git add frontend/components/SalonHero.tsx frontend/components/ServiceList.tsx frontend/components/StaffList.tsx frontend/components/GalleryGrid.tsx frontend/components/AboutContact.tsx frontend/app/salons
git commit -m "feat: build salon public page with services, staff, gallery, and about/contact"
```

---

## Self-Review Notes

- **Spec coverage**: public backend API (Task 1), demo data via existing authenticated APIs plus the one necessary bootstrap exception for the first platform admin (Task 2), Next.js scaffold + API client (Task 3), homepage with search/grid/empty-state (Task 4), salon page with hero/services/staff/gallery/about-contact/disabled-booking-button/404 handling (Task 5). Booking flow itself is out of scope per the spec and not touched by any task.
- **Placeholder scan**: no TBD/TODO markers; every step has complete, runnable code.
- **Type consistency**: `lib/types.ts` field names (`SalonSummary`, `SalonDetail`, `Service`, `Staff`, `GalleryItem`) match the backend's `PublicSalonSummary`/`PublicSalonDetail`/`PublicServiceRead`/`PublicStaffRead`/`PublicGalleryItemRead` field-for-field (snake_case preserved on both sides, since the frontend consumes raw JSON without a transform layer). `getSalons()`/`getSalonBySlug()` signatures in Task 3 are used identically in Tasks 4 and 5.
