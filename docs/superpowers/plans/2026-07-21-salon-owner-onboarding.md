# Salon Owner Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a prospective salon owner submit a public "join us" form, let the platform admin review/approve/reject leads from the Platform Admin Dashboard, and have approval auto-create the salon-admin account (with a generated temporary password) and email an invite via Resend.

**Architecture:** A new `SalonLead` model + three backend endpoints (public submit, admin list, admin reject) plus one endpoint that does more work (admin approve — creates the salon exactly like today's `create_salon`, then emails an invite). A new `backend/app/email.py` module wraps Resend and is used only by the approve endpoint. Two new frontend pages (`/join` public form, `/platform/leads` admin review) reuse every existing pattern (`platformFetch`, `PlatformApiError`, the Add-Salon-form field set) rather than introducing new ones.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Next.js 14 — all already in place. New backend dependency: `resend` (official Python SDK, added to `requirements.txt`). No new frontend dependencies.

## Global Constraints

- No changes to the existing `POST /admin/salons` endpoint, the Salon Admin Dashboard, or the Platform Admin Dashboard's existing `/platform` page — this plan only adds alongside them.
- The public lead form collects exactly `contact_name`, `contact_phone`, `contact_email`, `message` — no salon business details.
- Approval generates the password server-side (`secrets.token_urlsafe(12)`, stdlib) — the admin never types a password for an approved lead.
- Email sending must never raise or block salon creation — `send_owner_invite` catches all exceptions and returns `bool`. If `resend_api_key` is unset, it logs instead of sending (so local dev/tests need no real API key).
- `PATCH /admin/leads/{id}/status` only accepts `{status: "rejected"}` — approval is a separate endpoint (`POST /admin/leads/{id}/approve`) since it does more than a status flip.
- A lead can only be approved/rejected once — approving a non-`"pending"` lead is a 409.
- No automated frontend tests by design — verification is manual (curl + browser), matching every other frontend plan in this repo.
- Seeded platform admin for verification: `admin@ceylonbellezza.com` / `admin123`.

---

## File Structure

```
backend/
  app/
    models/
      lead.py                       # new: SalonLead model
      __init__.py                     # modified: export SalonLead
    schemas/
      lead.py                       # new: LeadCreateRequest, LeadRead, LeadRejectRequest, LeadApproveRequest
    routers/
      leads.py                       # new: POST /leads (public), GET/PATCH/POST /admin/leads... (platform-admin)
    email.py                          # new: send_owner_invite()
    config.py                          # modified: + resend_api_key, frontend_url
    main.py                             # modified: register leads.router
  alembic/versions/
    000X_add_salon_leads.py            # new migration
  requirements.txt                      # modified: + resend
  tests/
    test_leads.py                        # new

frontend/
  lib/
    api.ts                           # modified: + createLead
    types.ts                          # modified: + LeadCreatePayload, Lead
    platformApi.ts                     # unchanged, reused as-is
  app/
    join/
      page.tsx                         # new: public lead form
    page.tsx                             # modified: + "List Your Salon" link
    platform/
      layout.tsx                         # modified: + "Leads" nav link
      leads/
        page.tsx                           # new: lead list + reject + approve form
```

---

### Task 1: `SalonLead` model, migration, and public submission endpoint

**Files:**
- Create: `backend/app/models/lead.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/app/schemas/lead.py`
- Create: `backend/app/routers/leads.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_leads.py` (partial — this task's tests only)

**Interfaces:**
- Consumes: nothing new (foundational task).
- Produces: `SalonLead` model (`id, contact_name, contact_phone, contact_email, message, status, created_at`); `LeadCreateRequest`, `LeadRead` schemas; `POST /leads` endpoint. Tasks 2-3 add more endpoints to the same `leads.py` router and more schemas to the same `schemas/lead.py`.

- [ ] **Step 1: Create `backend/app/models/lead.py`**

```python
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SalonLead(Base):
    __tablename__ = "salon_leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contact_name: Mapped[str] = mapped_column(String(150))
    contact_phone: Mapped[str] = mapped_column(String(30))
    contact_email: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(String(2000), default="")
    status: Mapped[str] = mapped_column(String(20), default="pending")  # "pending" | "approved" | "rejected"
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
```

- [ ] **Step 2: Register the model in `backend/app/models/__init__.py`**

```python
from app.models.admin import PlatformAdmin, SalonAdmin
from app.models.booking import Booking
from app.models.content import ContentBlock
from app.models.gallery import GalleryItem
from app.models.lead import SalonLead
from app.models.salon import Salon
from app.models.service import Service
from app.models.staff import Staff, StaffAvailability, staff_services

__all__ = [
    "Salon",
    "SalonAdmin",
    "PlatformAdmin",
    "Service",
    "Staff",
    "StaffAvailability",
    "staff_services",
    "GalleryItem",
    "Booking",
    "ContentBlock",
    "SalonLead",
]
```

- [ ] **Step 3: Create `backend/app/schemas/lead.py`**

```python
import uuid
from datetime import datetime

from pydantic import BaseModel


class LeadCreateRequest(BaseModel):
    contact_name: str
    contact_phone: str
    contact_email: str
    message: str = ""


class LeadRead(BaseModel):
    id: uuid.UUID
    contact_name: str
    contact_phone: str
    contact_email: str
    message: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LeadRejectRequest(BaseModel):
    status: str  # only "rejected" is meaningful; enforced in the router


class LeadApproveRequest(BaseModel):
    slug: str
    name: str
    category: str
    address: str
    city: str
    latitude: float | None = None
    longitude: float | None = None
```

- [ ] **Step 4: Create `backend/app/routers/leads.py` (this task's endpoint only)**

```python
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import SalonLead
from app.schemas.lead import LeadCreateRequest, LeadRead

router = APIRouter(tags=["leads"])


@router.post("/leads", response_model=LeadRead, status_code=status.HTTP_201_CREATED)
def create_lead(payload: LeadCreateRequest, db: Session = Depends(get_db)):
    lead = SalonLead(**payload.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead
```

- [ ] **Step 5: Register the router in `backend/app/main.py`**

```python
from app.routers import auth, bookings_dashboard, content, gallery, leads, public, salons, services, staff
```

Add `app.include_router(leads.router)` alongside the other `include_router` calls.

- [ ] **Step 6: Generate and review the Alembic migration**

```bash
cd backend && alembic revision --autogenerate -m "add salon_leads table"
```

Review the generated file at `backend/alembic/versions/<hash>_add_salon_leads_table.py` — expect an `op.create_table("salon_leads", ...)` matching the model's columns. Apply it:

```bash
alembic upgrade head
```

Verify: `alembic current` shows the new revision; `psql -h localhost -p 5433 -U ceylon -d ceylon_bellezza -c "\d salon_leads"` shows the table.

- [ ] **Step 7: Write the test**

Create `backend/tests/test_leads.py`:

```python
from app.models import SalonLead


def test_create_lead(client, db_session):
    response = client.post(
        "/leads",
        json={
            "contact_name": "Nimal Perera",
            "contact_phone": "0771112222",
            "contact_email": "nimal@example.com",
            "message": "I'd like to list my salon.",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert db_session.query(SalonLead).count() == 1
```

- [ ] **Step 8: Run the test**

Run: `cd backend && .venv/bin/python -m pytest tests/test_leads.py -v`
Expected: `test_create_lead PASSED`

- [ ] **Step 9: Commit**

```bash
git add backend/app/models/lead.py backend/app/models/__init__.py backend/app/schemas/lead.py backend/app/routers/leads.py backend/app/main.py backend/alembic/versions/*_add_salon_leads_table.py backend/tests/test_leads.py
git commit -m "feat: add salon lead model and public submission endpoint"
```

---

### Task 2: Platform-admin lead list and reject endpoints

**Files:**
- Modify: `backend/app/routers/leads.py`
- Modify: `backend/tests/test_leads.py`

**Interfaces:**
- Consumes: `SalonLead`, `LeadRead`, `LeadRejectRequest` (Task 1); `get_current_platform_admin` from `app.auth.dependencies` (existing, used by `salons.py`).
- Produces: `GET /admin/leads`, `PATCH /admin/leads/{id}/status` endpoints. Task 3 adds `POST /admin/leads/{id}/approve` to the same router.

- [ ] **Step 1: Add the list and reject endpoints to `backend/app/routers/leads.py`**

Add these imports at the top (merge with existing ones):

```python
import uuid

from fastapi import HTTPException
from app.auth.dependencies import get_current_platform_admin
from app.schemas.lead import LeadRejectRequest
```

Add below the existing `create_lead` function:

```python
@router.get("/admin/leads", response_model=list[LeadRead], dependencies=[Depends(get_current_platform_admin)])
def list_leads(db: Session = Depends(get_db)):
    return db.query(SalonLead).order_by(SalonLead.created_at.desc()).all()


@router.patch(
    "/admin/leads/{lead_id}/status", response_model=LeadRead, dependencies=[Depends(get_current_platform_admin)]
)
def update_lead_status(lead_id: uuid.UUID, payload: LeadRejectRequest, db: Session = Depends(get_db)):
    lead = db.get(SalonLead, lead_id)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    if lead.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Lead has already been processed")
    lead.status = payload.status
    db.commit()
    db.refresh(lead)
    return lead
```

- [ ] **Step 2: Add tests**

Append to `backend/tests/test_leads.py`:

```python
from app.auth.security import create_access_token


def _platform_token():
    return create_access_token({"sub": "platform-1", "role": "platform_admin"})


def _create_lead(db_session):
    lead = SalonLead(
        contact_name="Nimal Perera",
        contact_phone="0771112222",
        contact_email="nimal@example.com",
        message="I'd like to list my salon.",
    )
    db_session.add(lead)
    db_session.commit()
    return lead


def test_list_leads_requires_platform_admin(client, db_session):
    response = client.get("/admin/leads")
    assert response.status_code == 401


def test_list_leads(client, db_session):
    _create_lead(db_session)
    token = _platform_token()
    response = client.get("/admin/leads", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_reject_lead(client, db_session):
    lead = _create_lead(db_session)
    token = _platform_token()
    response = client.patch(
        f"/admin/leads/{lead.id}/status",
        json={"status": "rejected"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"


def test_reject_already_processed_lead_returns_409(client, db_session):
    lead = _create_lead(db_session)
    token = _platform_token()
    headers = {"Authorization": f"Bearer {token}"}
    client.patch(f"/admin/leads/{lead.id}/status", json={"status": "rejected"}, headers=headers)
    second = client.patch(f"/admin/leads/{lead.id}/status", json={"status": "rejected"}, headers=headers)
    assert second.status_code == 409
```

- [ ] **Step 3: Run the tests**

Run: `cd backend && .venv/bin/python -m pytest tests/test_leads.py -v`
Expected: all 5 tests pass (1 from Task 1 + 4 new).

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/leads.py backend/tests/test_leads.py
git commit -m "feat: add platform-admin lead list and reject endpoints"
```

---

### Task 3: Email module and lead approval endpoint

**Files:**
- Create: `backend/app/email.py`
- Modify: `backend/app/config.py`
- Modify: `backend/app/routers/leads.py`
- Modify: `backend/requirements.txt`
- Modify: `backend/tests/test_leads.py`

**Interfaces:**
- Consumes: `Salon`, `SalonAdmin` models; `hash_password` from `app.auth.security`; `geocode_address` from `app.auth.geocoding` (all existing, same as `salons.py`'s `create_salon`); `LeadApproveRequest` (Task 1).
- Produces: `send_owner_invite(to_email: str, temp_password: str, salon_name: str) -> bool` in `app/email.py`; `POST /admin/leads/{id}/approve` returning `SalonRead` plus `email_sent: bool` and `temporary_password: str`.

- [ ] **Step 1: Add the dependency**

Add to `backend/requirements.txt`:

```
resend==2.5.1
```

Install it:

```bash
cd backend && .venv/bin/pip install resend==2.5.1
```

- [ ] **Step 2: Add config fields to `backend/app/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    test_database_url: str = ""
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    google_maps_api_key: str = ""
    resend_api_key: str = ""
    frontend_url: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
```

- [ ] **Step 3: Create `backend/app/email.py`**

```python
import resend

from app.config import settings


def send_owner_invite(to_email: str, temp_password: str, salon_name: str) -> bool:
    """Send the salon-owner invite email. Returns True if sent, False if skipped or failed. Never raises."""
    if not settings.resend_api_key:
        print(f"[email skipped: no RESEND_API_KEY] Would invite {to_email} to manage {salon_name}")
        return False

    resend.api_key = settings.resend_api_key
    login_url = f"{settings.frontend_url}/admin/login"
    try:
        resend.Emails.send(
            {
                "from": "Ceylon Bellezza <onboarding@resend.dev>",
                "to": to_email,
                "subject": f"You're set up to manage {salon_name} on Ceylon Bellezza",
                "html": (
                    f"<p>Log in at <a href='{login_url}'>{login_url}</a></p>"
                    f"<p>Email: {to_email}<br>Temporary password: <strong>{temp_password}</strong></p>"
                    f"<p>Please log in and note your credentials safely.</p>"
                ),
            }
        )
        return True
    except Exception:
        return False
```

- [ ] **Step 4: Add the approve endpoint to `backend/app/routers/leads.py`**

Add these imports (merge with existing):

```python
import secrets

from sqlalchemy.exc import IntegrityError

from app.auth.geocoding import geocode_address
from app.auth.security import hash_password
from app.email import send_owner_invite
from app.models import Salon, SalonAdmin
from app.schemas.lead import LeadApproveRequest
from app.schemas.salon import SalonRead
```

Add below `update_lead_status`:

```python
@router.post("/admin/leads/{lead_id}/approve", dependencies=[Depends(get_current_platform_admin)])
def approve_lead(lead_id: uuid.UUID, payload: LeadApproveRequest, db: Session = Depends(get_db)):
    lead = db.get(SalonLead, lead_id)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    if lead.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Lead has already been processed")

    latitude, longitude = payload.latitude, payload.longitude
    if latitude is None or longitude is None:
        geocoded = geocode_address(payload.address, payload.city)
        if geocoded is not None:
            latitude, longitude = geocoded

    temp_password = secrets.token_urlsafe(12)

    salon = Salon(
        slug=payload.slug,
        name=payload.name,
        category=payload.category,
        address=payload.address,
        city=payload.city,
        latitude=latitude,
        longitude=longitude,
    )
    db.add(salon)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A salon with this slug already exists")

    admin = SalonAdmin(salon_id=salon.id, email=lead.contact_email, password_hash=hash_password(temp_password))
    db.add(admin)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="An admin with this email already exists"
        )
    db.refresh(salon)

    lead.status = "approved"
    db.commit()

    email_sent = send_owner_invite(lead.contact_email, temp_password, salon.name)

    return {
        **SalonRead.model_validate(salon).model_dump(mode="json"),
        "email_sent": email_sent,
        "temporary_password": temp_password,
    }
```

- [ ] **Step 5: Add tests**

Append to `backend/tests/test_leads.py`:

```python
from unittest.mock import patch


def test_approve_lead_creates_salon_and_admin(client, db_session):
    lead = _create_lead(db_session)
    token = _platform_token()
    with (
        patch("app.routers.leads.geocode_address", return_value=(6.9, 79.8)),
        patch("app.routers.leads.send_owner_invite", return_value=True) as mock_send,
    ):
        response = client.post(
            f"/admin/leads/{lead.id}/approve",
            json={
                "slug": "new-salon",
                "name": "New Salon",
                "category": "unisex",
                "address": "1 Main St",
                "city": "Colombo",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["slug"] == "new-salon"
    assert body["email_sent"] is True
    assert "temporary_password" in body
    mock_send.assert_called_once()

    login = client.post(
        "/auth/salon-admin/login",
        json={"email": "nimal@example.com", "password": body["temporary_password"]},
    )
    assert login.status_code == 200


def test_approve_already_processed_lead_returns_409(client, db_session):
    lead = _create_lead(db_session)
    token = _platform_token()
    headers = {"Authorization": f"Bearer {token}"}
    client.patch(f"/admin/leads/{lead.id}/status", json={"status": "rejected"}, headers=headers)

    with patch("app.routers.leads.geocode_address", return_value=(6.9, 79.8)):
        response = client.post(
            f"/admin/leads/{lead.id}/approve",
            json={"slug": "x", "name": "X", "category": "unisex", "address": "A", "city": "Colombo"},
            headers=headers,
        )
    assert response.status_code == 409


def test_approve_lead_email_failure_does_not_block_salon_creation(client, db_session):
    lead = _create_lead(db_session)
    token = _platform_token()
    with (
        patch("app.routers.leads.geocode_address", return_value=(6.9, 79.8)),
        patch("app.routers.leads.send_owner_invite", return_value=False),
    ):
        response = client.post(
            f"/admin/leads/{lead.id}/approve",
            json={"slug": "new-salon-2", "name": "New Salon 2", "category": "unisex", "address": "A", "city": "Colombo"},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 200
    assert response.json()["email_sent"] is False
```

- [ ] **Step 6: Run the tests**

Run: `cd backend && .venv/bin/python -m pytest tests/test_leads.py -v`
Expected: all 8 tests pass.

- [ ] **Step 7: Run the full backend suite**

Run: `cd backend && .venv/bin/python -m pytest -q`
Expected: all tests pass, no regressions (this task only adds files/endpoints, doesn't modify existing behavior).

- [ ] **Step 8: Commit**

```bash
git add backend/app/email.py backend/app/config.py backend/app/routers/leads.py backend/requirements.txt backend/tests/test_leads.py
git commit -m "feat: add email invite and lead approval endpoint"
```

---

### Task 4: Frontend — public join form

**Files:**
- Modify: `frontend/lib/types.ts`
- Modify: `frontend/lib/api.ts`
- Create: `frontend/app/join/page.tsx`
- Modify: `frontend/app/page.tsx`

**Interfaces:**
- Consumes: nothing from earlier frontend tasks (this is the first frontend task).
- Produces: `LeadCreatePayload` type; `createLead(payload: LeadCreatePayload): Promise<void>` in `lib/api.ts`. Task 5 does not depend on this task's exports (it uses `platformApi.ts` instead), so Tasks 4-5 are independently orderable.

- [ ] **Step 1: Add types to `frontend/lib/types.ts`**

Append:

```ts
export interface LeadCreatePayload {
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  message: string;
}
```

- [ ] **Step 2: Add `createLead` to `frontend/lib/api.ts`**

Add the import and function:

```ts
import { Booking, BookingCreatePayload, LeadCreatePayload, SalonDetail, SalonSummary } from "./types";
```

Append at the end of the file:

```ts
export async function createLead(payload: LeadCreatePayload): Promise<void> {
  const response = await fetch(`${API_URL}/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Submission failed: ${response.status}`);
  }
}
```

- [ ] **Step 3: Create `frontend/app/join/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { createLead } from "@/lib/api";

const EMPTY_FORM = { contact_name: "", contact_phone: "", contact_email: "", message: "" };

const FIELD_CLASS = "rounded border border-hairline px-3 py-2 focus:border-terracotta focus:outline-none";

export default function JoinPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createLead(form);
      setSuccess(true);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="font-serif text-3xl text-ink">Thanks for reaching out</h1>
        <p className="mt-3 text-taupe">We'll review your details and get back to you soon.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-24">
      <h1 className="font-serif text-3xl text-ink">List Your Salon</h1>
      <p className="mt-2 text-taupe">Tell us about your salon and we'll be in touch.</p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="mt-6 rounded-lg border border-hairline bg-white p-5">
        <div className="grid gap-4">
          <input
            required
            placeholder="Your name"
            className={FIELD_CLASS}
            value={form.contact_name}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
          />
          <input
            required
            type="tel"
            placeholder="Phone"
            className={FIELD_CLASS}
            value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
          />
          <input
            required
            type="email"
            placeholder="Email"
            className={FIELD_CLASS}
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
          />
          <textarea
            placeholder="Tell us about your salon"
            rows={4}
            className={FIELD_CLASS}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="mt-4 rounded bg-terracotta px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? "Sending..." : "Submit"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Add the homepage link**

In `frontend/app/page.tsx`, add a `Link` import and place the link in the hero section:

```tsx
import Link from "next/link";
import { getSalons } from "@/lib/api";
import SalonDirectory from "@/components/SalonDirectory";
```

Inside the hero `<section>`, after the existing `<p>` tagline, add:

```tsx
        <Link href="/join" className="mt-4 text-sm text-white underline underline-offset-4 hover:text-terracotta-light">
          List Your Salon
        </Link>
```

- [ ] **Step 5: Verify manually**

```bash
pg_isready -h localhost -p 5433 || brew services start postgresql@15
cd backend && .venv/bin/uvicorn app.main:app --port 8000 &
cd ../frontend && npm run dev &
sleep 6
curl -s http://localhost:3000/join | grep -o "List Your Salon"
curl -s -X POST http://localhost:8000/leads -H "Content-Type: application/json" -d '{"contact_name":"Test","contact_phone":"0771234567","contact_email":"test@example.com","message":"Hi"}' | grep -o '"status":"pending"'
kill %1 %2
```

Expected: both greps match. Follow up in the browser: visit the homepage, click "List Your Salon", submit the form, confirm the thank-you message appears.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/types.ts frontend/lib/api.ts frontend/app/join/page.tsx frontend/app/page.tsx
git commit -m "feat: add public salon owner join form"
```

---

### Task 5: Frontend — platform admin leads review page

**Files:**
- Create: `frontend/app/platform/leads/page.tsx`
- Modify: `frontend/app/platform/layout.tsx`

**Interfaces:**
- Consumes: `platformFetch<T>`, `PlatformApiError` from `@/lib/platformApi` (existing, unchanged); no dependency on Task 4.
- Produces: nothing consumed elsewhere (final task in this plan).

- [ ] **Step 1: Create `frontend/app/platform/leads/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { platformFetch, PlatformApiError } from "@/lib/platformApi";

interface Lead {
  id: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  message: string;
  status: string;
  created_at: string;
}

const EMPTY_APPROVE_FORM = { slug: "", name: "", category: "", address: "", city: "", latitude: "", longitude: "" };

const FIELD_CLASS = "rounded border border-hairline px-3 py-2 focus:border-terracotta focus:outline-none";

export default function PlatformLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [approveForm, setApproveForm] = useState(EMPTY_APPROVE_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ leadId: string; email: string; password: string; emailSent: boolean } | null>(
    null
  );

  async function loadLeads() {
    setLoading(true);
    try {
      const data = await platformFetch<Lead[]>("/admin/leads");
      setLeads(data);
    } catch (err) {
      setError(err instanceof PlatformApiError ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

  function startReview(lead: Lead) {
    setReviewingId(lead.id);
    setApproveForm(EMPTY_APPROVE_FORM);
    setResult(null);
  }

  async function handleReject(leadId: string) {
    setError(null);
    try {
      const updated = await platformFetch<Lead>(`/admin/leads/${leadId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "rejected" }),
      });
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setReviewingId(null);
    } catch (err) {
      setError(err instanceof PlatformApiError ? err.message : "Failed to reject lead");
    }
  }

  async function handleApprove(event: React.FormEvent, leadId: string, contactEmail: string) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        slug: approveForm.slug,
        name: approveForm.name,
        category: approveForm.category,
        address: approveForm.address,
        city: approveForm.city,
        latitude: approveForm.latitude ? Number(approveForm.latitude) : null,
        longitude: approveForm.longitude ? Number(approveForm.longitude) : null,
      };
      const response = await platformFetch<{ email_sent: boolean; temporary_password: string }>(
        `/admin/leads/${leadId}/approve`,
        { method: "POST", body: JSON.stringify(payload) }
      );
      setResult({
        leadId,
        email: contactEmail,
        password: response.temporary_password,
        emailSent: response.email_sent,
      });
      await loadLeads();
      setReviewingId(null);
    } catch (err) {
      setError(err instanceof PlatformApiError ? err.message : "Failed to approve lead");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink">Leads</h1>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {result && (
        <div className="mt-4 rounded-lg border border-hairline bg-white p-4 text-sm">
          <p className="text-ink">
            Salon created for <strong>{result.email}</strong>.{" "}
            {result.emailSent ? "Invite email sent." : "Invite email failed to send — share these manually:"}
          </p>
          {!result.emailSent && (
            <p className="mt-1 text-taupe">
              Email: {result.email} — Temporary password: <strong>{result.password}</strong>
            </p>
          )}
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-taupe">Loading...</p>
      ) : leads.length === 0 ? (
        <p className="mt-6 text-taupe">No leads yet.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {leads.map((lead) => (
            <div key={lead.id} className="rounded-lg border border-hairline bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{lead.contact_name}</p>
                  <p className="text-sm text-taupe">
                    {lead.contact_phone} · {lead.contact_email}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${
                    lead.status === "pending"
                      ? "bg-terracotta/10 text-terracotta"
                      : lead.status === "approved"
                        ? "bg-hairline text-ink"
                        : "bg-hairline text-taupe"
                  }`}
                >
                  {lead.status}
                </span>
              </div>
              {lead.message && <p className="mt-2 text-sm text-taupe">{lead.message}</p>}

              {lead.status === "pending" && reviewingId !== lead.id && (
                <div className="mt-3 flex gap-3">
                  <button onClick={() => startReview(lead)} className="text-sm text-terracotta">
                    Review
                  </button>
                  <button onClick={() => handleReject(lead.id)} className="text-sm text-red-600">
                    Reject
                  </button>
                </div>
              )}

              {reviewingId === lead.id && (
                <form onSubmit={(e) => handleApprove(e, lead.id, lead.contact_email)} className="mt-4 border-t border-hairline pt-4">
                  <p className="text-sm font-medium text-ink">Approve — enter salon details</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <input
                      required
                      placeholder="Slug"
                      className={FIELD_CLASS}
                      value={approveForm.slug}
                      onChange={(e) => setApproveForm({ ...approveForm, slug: e.target.value })}
                    />
                    <input
                      required
                      placeholder="Name"
                      className={FIELD_CLASS}
                      value={approveForm.name}
                      onChange={(e) => setApproveForm({ ...approveForm, name: e.target.value })}
                    />
                    <input
                      required
                      placeholder="Category (mens/womens/unisex)"
                      className={FIELD_CLASS}
                      value={approveForm.category}
                      onChange={(e) => setApproveForm({ ...approveForm, category: e.target.value })}
                    />
                    <input
                      required
                      placeholder="City"
                      className={FIELD_CLASS}
                      value={approveForm.city}
                      onChange={(e) => setApproveForm({ ...approveForm, city: e.target.value })}
                    />
                    <input
                      required
                      placeholder="Address"
                      className={`${FIELD_CLASS} col-span-2`}
                      value={approveForm.address}
                      onChange={(e) => setApproveForm({ ...approveForm, address: e.target.value })}
                    />
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="Latitude (optional)"
                      className={FIELD_CLASS}
                      value={approveForm.latitude}
                      onChange={(e) => setApproveForm({ ...approveForm, latitude: e.target.value })}
                    />
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="Longitude (optional)"
                      className={FIELD_CLASS}
                      value={approveForm.longitude}
                      onChange={(e) => setApproveForm({ ...approveForm, longitude: e.target.value })}
                    />
                  </div>
                  <div className="mt-3 flex gap-3">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded bg-terracotta px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      {submitting ? "Approving..." : "Approve & Create Salon"}
                    </button>
                    <button type="button" onClick={() => setReviewingId(null)} className="text-sm text-taupe">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add a "Leads" nav link to `frontend/app/platform/layout.tsx`**

Add the `Link`/`usePathname` nav alongside the existing header. Replace the `<header>` block:

```tsx
  return (
    <div className="min-h-screen bg-ivory">
      <header className="flex items-center justify-between border-b border-hairline bg-white px-8 py-4">
        <p className="font-serif text-sm uppercase tracking-wide text-terracotta">Ceylon Bellezza — Platform Admin</p>
        <nav className="flex items-center gap-4">
          <Link href="/platform" className={`text-sm ${pathname === "/platform" ? "text-terracotta" : "text-ink hover:text-terracotta"}`}>
            Salons
          </Link>
          <Link href="/platform/leads" className={`text-sm ${pathname === "/platform/leads" ? "text-terracotta" : "text-ink hover:text-terracotta"}`}>
            Leads
          </Link>
          <button onClick={handleLogout} className="text-sm text-taupe hover:text-terracotta">
            Log Out
          </button>
        </nav>
      </header>
      <main className="p-8">{children}</main>
    </div>
  );
}
```

Add `import Link from "next/link";` at the top of the file (alongside the existing `usePathname, useRouter` import from `next/navigation`).

- [ ] **Step 3: Verify manually**

```bash
pg_isready -h localhost -p 5433 || brew services start postgresql@15
cd backend && .venv/bin/uvicorn app.main:app --port 8000 &
cd ../frontend && npm run dev &
sleep 6
curl -s -X POST http://localhost:8000/leads -H "Content-Type: application/json" -d '{"contact_name":"Verify Lead","contact_phone":"0779998888","contact_email":"verify@example.com","message":"Testing"}' > /dev/null
TOKEN=$(curl -s -X POST http://localhost:8000/auth/platform-admin/login -H "Content-Type: application/json" -d '{"email":"admin@ceylonbellezza.com","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s http://localhost:8000/admin/leads -H "Authorization: Bearer $TOKEN" | grep -o "Verify Lead"
kill %1 %2
```

Expected: the grep matches. Follow up in the browser: log in at `/platform/login`, click "Leads" in the nav, confirm the lead from Task 4/this step appears with "Review"/"Reject" actions. Click "Review", fill in salon details (a unique slug), submit — confirm the success banner shows (with the temporary password if `RESEND_API_KEY` isn't configured locally, since `email_sent` will be `false`), the lead's status updates to "approved", and the new salon appears in the existing `/platform` salon list. Confirm the owner can log in at `/admin/login` with the shown email + temporary password. Try rejecting a separate pending lead and confirm its status updates to "rejected" with no further actions shown.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/platform/leads/page.tsx frontend/app/platform/layout.tsx
git commit -m "feat: add platform admin leads review page"
```

---

## Self-Review Notes

- **Spec coverage**: public lead submission (Task 1), admin list + reject (Task 2), approve with generated password + email + salon creation (Task 3), public join form + homepage link (Task 4), admin leads review UI + nav (Task 5). All non-goals from the spec (role-picker landing page, lead-form salon details, magic-link auth, editing/reopening processed leads) are correctly absent from every task.
- **Placeholder scan**: no TBD/TODO; every step has complete, runnable code. The Resend "from" address and sandbox-sender caveat from the spec is carried through verbatim into Task 3's code.
- **Type consistency**: `LeadRead`/`Lead` (backend Pydantic vs. frontend TS interface) share the same field set across Tasks 1-2-5. `platformFetch`/`PlatformApiError` (existing) are consumed identically in Task 5 to how the Platform Admin Dashboard plan used them. `send_owner_invite`'s signature defined in Task 3 matches its one call site in the same task's `approve_lead`.
- **Scope check**: five tasks — three backend (model+public endpoint, admin list/reject, approve+email), two frontend (public form, admin review UI) — each independently testable and committable. Tasks 4 and 5 have no interdependency and could be built in either order.
