# Admin Bookings Dashboard + Staff Availability & Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give salon admins a day-view bookings calendar (staff as columns) with status management, and a weekly working-hours editor per staff member — closing the largest half-built gap in the codebase (`bookings_dashboard` router with no UI, `StaffAvailability` model with no router at all).

**Architecture:** Backend: a `BookingStatus` Pydantic literal closes a real validation gap, two new optional query params extend the existing bookings-list endpoint, and a new `StaffAvailability` CRUD sub-resource is added to the existing staff router using a join-through-parent ownership check. Frontend: a new `/admin/bookings` day-view page (staff-as-columns grid, pure CSS positioning, no new dependency) with a `Modal`-based booking detail/status flow, and a new "Working Hours" `Tabs` panel on the existing staff page.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic (backend); Next.js 14 App Router, TypeScript, Tailwind, Framer Motion via `frontend/lib/motion.ts` (frontend). No new dependencies on either side.

## Global Constraints

- No new npm dependencies — the calendar grid is built with plain CSS positioning.
- No new Alembic migration — the `staff_availability` table already exists.
- No week view — day view only, prev/next/today navigation.
- No changes to the public `BookingForm.tsx` — admin-side only, explicitly deferred.
- Four booking statuses only: `pending`, `confirmed`, `completed`, `cancelled` — no others.
- No automated frontend tests exist in this repo (established convention) — frontend verification is `tsc --noEmit` plus a manual browser check described in each task. Backend gets real `pytest` coverage, following this repo's existing test-fixture conventions (see `backend/tests/test_bookings_dashboard.py` and `backend/tests/test_staff.py` for the exact fixture-building pattern to reuse, not reinvent).
- Ownership scoping for every new/modified endpoint must use `uuid.UUID(admin["salon_id"])` and 404 (never 403) on mismatch, matching every existing router in this codebase.

---

### Task 1: Booking status validation

**Files:**
- Modify: `backend/app/schemas/booking.py`
- Test: `backend/tests/test_bookings_dashboard.py` (append)

**Interfaces:**
- Produces: `BookingStatus = Literal["pending", "confirmed", "completed", "cancelled"]`, exported from `app.schemas.booking`, used as the type of `BookingStatusUpdateRequest.status` and `BookingRead.status`/`DashboardBookingRead.status` (inherited).

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_bookings_dashboard.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && source .venv/bin/activate && pytest tests/test_bookings_dashboard.py -k "invalid_value or accepts_completed" -v`
Expected: both FAIL — `test_update_booking_status_rejects_invalid_value` fails because the endpoint currently accepts any string (returns 200, not 422); `test_update_booking_status_accepts_completed` may already pass by accident (since there's no validation today) but re-run after Step 3 to confirm it passes for the right reason.

- [ ] **Step 3: Add the `BookingStatus` literal**

Replace the full contents of `backend/app/schemas/booking.py` with:

```python
import uuid
from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel


class Gender(str, Enum):
    male = "male"
    female = "female"
    other = "other"


BookingStatus = Literal["pending", "confirmed", "completed", "cancelled"]


class BookingCreateRequest(BaseModel):
    service_id: uuid.UUID
    staff_id: uuid.UUID | None = None
    scheduled_at: datetime
    customer_name: str
    customer_phone: str
    customer_email: str
    gender: Gender


class BookingRead(BaseModel):
    id: uuid.UUID
    salon_id: uuid.UUID
    service_id: uuid.UUID
    staff_id: uuid.UUID | None
    customer_name: str
    customer_phone: str
    customer_email: str
    gender: str
    scheduled_at: datetime
    status: BookingStatus

    model_config = {"from_attributes": True}


class DashboardBookingRead(BookingRead):
    service_name: str
    staff_name: str | None


class BookingStatusUpdateRequest(BaseModel):
    status: BookingStatus
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && source .venv/bin/activate && pytest tests/test_bookings_dashboard.py -v`
Expected: all PASS, including the two new tests and every pre-existing test in this file (in particular, `test_update_booking_status` which sets status to `"confirmed"` must still pass).

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/booking.py backend/tests/test_bookings_dashboard.py
git commit -m "feat: validate booking status against a closed set of four values"
```

---

### Task 2: Bookings-list date-range and status query params

**Files:**
- Modify: `backend/app/routers/bookings_dashboard.py`
- Test: `backend/tests/test_bookings_dashboard.py` (append)

**Interfaces:**
- Consumes: `BookingStatus` from Task 1 (`app.schemas.booking`).
- Produces: `GET /dashboard/bookings` now accepts optional `to_date: date` and `status: BookingStatus` query params, in addition to the existing `from_date`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_bookings_dashboard.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && source .venv/bin/activate && pytest tests/test_bookings_dashboard.py -k "to_date_excludes or status_filter" -v`
Expected: `test_list_bookings_to_date_excludes_later_days` FAILS (both bookings returned, `to_date` param is silently ignored today). `test_list_bookings_status_filter` FAILS (both bookings returned, `status` param ignored today).

- [ ] **Step 3: Add the query params**

Replace the full contents of `backend/app/routers/bookings_dashboard.py` with:

```python
import uuid
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_salon_admin
from app.database import get_db
from app.models import Booking, Service, Staff
from app.schemas.booking import BookingRead, BookingStatus, BookingStatusUpdateRequest, DashboardBookingRead

router = APIRouter(prefix="/dashboard/bookings", tags=["bookings"])


@router.get("", response_model=list[DashboardBookingRead])
def list_bookings(
    from_date: date | None = None,
    to_date: date | None = None,
    status: BookingStatus | None = None,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    effective_from = from_date or date.today()
    effective_to = to_date or (effective_from + timedelta(days=1))
    start = datetime.combine(effective_from, time.min, tzinfo=timezone.utc)
    end = datetime.combine(effective_to, time.min, tzinfo=timezone.utc)

    query = (
        db.query(Booking, Service.name, Staff.name)
        .join(Service, Booking.service_id == Service.id)
        .outerjoin(Staff, Booking.staff_id == Staff.id)
        .filter(
            Booking.salon_id == uuid.UUID(admin["salon_id"]),
            Booking.scheduled_at >= start,
            Booking.scheduled_at < end,
        )
    )
    if status is not None:
        query = query.filter(Booking.status == status)

    rows = query.order_by(Booking.scheduled_at.asc()).all()

    return [
        DashboardBookingRead(
            **BookingRead.model_validate(booking).model_dump(),
            service_name=service_name,
            staff_name=staff_name,
        )
        for booking, service_name, staff_name in rows
    ]


def _get_owned_booking(booking_id: uuid.UUID, admin: dict, db: Session) -> Booking:
    booking = db.get(Booking, booking_id)
    if booking is None or booking.salon_id != uuid.UUID(admin["salon_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return booking


@router.patch("/{booking_id}", response_model=BookingRead)
def update_booking_status(
    booking_id: uuid.UUID,
    payload: BookingStatusUpdateRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    booking = _get_owned_booking(booking_id, admin, db)
    booking.status = payload.status
    db.commit()
    db.refresh(booking)
    return booking
```

Note: the query parameter `status` shadows the imported `status` module (used for `status.HTTP_404_NOT_FOUND` inside `_get_owned_booking`) only within `list_bookings`'s own function scope — `_get_owned_booking` and `update_booking_status` are separate functions and are unaffected. This mirrors how FastAPI route functions commonly name query params after domain concepts; no rename needed since Python scoping keeps them separate.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && source .venv/bin/activate && pytest tests/test_bookings_dashboard.py -v`
Expected: all PASS, including every pre-existing test in this file (in particular `test_list_bookings_today_and_future_only`, which calls the endpoint with no `to_date` — confirm the new default-to-`from_date + 1 day` behavior doesn't break it, since that test's "future" booking is `+1 day` from now and must still fall inside the default window... re-check: with no `to_date`, `effective_to = effective_from + 1 day` where `effective_from` is `date.today()`, so the window is exactly today only. The pre-existing test's "future" booking is `+1 day` from *now*, which lands on tomorrow's calendar date — outside today's window. **This is a real behavior change**: verify by running the full file and reading the actual output; if `test_list_bookings_today_and_future_only` starts failing, it means the endpoint's default window shrank from "everything from today onward" to "just today," which breaks the existing dashboard's un-dated default view. Fix: keep `to_date` fully optional in its effect — when `to_date` is not provided, do NOT default it to `from_date + 1 day` for the upper bound; only apply an upper bound when the caller explicitly passes `to_date`. Change the query building to:

```python
    effective_from = from_date or date.today()
    start = datetime.combine(effective_from, time.min, tzinfo=timezone.utc)

    query = (
        db.query(Booking, Service.name, Staff.name)
        .join(Service, Booking.service_id == Service.id)
        .outerjoin(Staff, Booking.staff_id == Staff.id)
        .filter(
            Booking.salon_id == uuid.UUID(admin["salon_id"]),
            Booking.scheduled_at >= start,
        )
    )
    if to_date is not None:
        end = datetime.combine(to_date, time.min, tzinfo=timezone.utc)
        query = query.filter(Booking.scheduled_at < end)
    if status is not None:
        query = query.filter(Booking.status == status)
```

This preserves the existing "from_date onward, no upper bound" default behavior exactly, while still letting the day-view frontend pass `from_date=X&to_date=X+1day` to get a single day. Use this version instead of the one in Step 3 above. Re-run the full test file after this correction.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/bookings_dashboard.py backend/tests/test_bookings_dashboard.py
git commit -m "feat: add to_date and status query params to bookings dashboard list"
```

---

### Task 3: `StaffAvailability` schema + CRUD router

**Files:**
- Create: `backend/app/schemas/staff_availability.py`
- Modify: `backend/app/routers/staff.py`
- Test: `backend/tests/test_staff_availability.py` (new)

**Interfaces:**
- Consumes: `StaffAvailability` model from `app.models` (already exported, fields: `id, staff_id, day_of_week: int, start_time: str, end_time: str`); `_get_owned_staff(staff_id, admin, db) -> Staff` already exists in `backend/app/routers/staff.py`, reuse it directly — do not redefine it.
- Produces: `AvailabilityCreateRequest`, `AvailabilityUpdateRequest`, `AvailabilityRead` from `app.schemas.staff_availability`; routes `GET/POST /dashboard/staff/{staff_id}/availability`, `PUT/DELETE /dashboard/staff/{staff_id}/availability/{availability_id}`.

- [ ] **Step 1: Write the schema file**

Create `backend/app/schemas/staff_availability.py`:

```python
import uuid

from pydantic import BaseModel, Field


class AvailabilityCreateRequest(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: str
    end_time: str


class AvailabilityUpdateRequest(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: str
    end_time: str


class AvailabilityRead(BaseModel):
    id: uuid.UUID
    staff_id: uuid.UUID
    day_of_week: int
    start_time: str
    end_time: str

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Write the failing tests**

Create `backend/tests/test_staff_availability.py`:

```python
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && source .venv/bin/activate && pytest tests/test_staff_availability.py -v`
Expected: all FAIL with 404 "Not Found" (no such routes exist yet).

- [ ] **Step 4: Add the router endpoints**

Replace the full contents of `backend/app/routers/staff.py` with:

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_salon_admin
from app.database import get_db
from app.models import Staff, StaffAvailability
from app.schemas.staff import StaffCreateRequest, StaffRead, StaffUpdateRequest
from app.schemas.staff_availability import AvailabilityCreateRequest, AvailabilityRead, AvailabilityUpdateRequest

router = APIRouter(prefix="/dashboard/staff", tags=["staff"])


@router.post("", response_model=StaffRead, status_code=status.HTTP_201_CREATED)
def create_staff(
    payload: StaffCreateRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    staff = Staff(salon_id=uuid.UUID(admin["salon_id"]), **payload.model_dump())
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.get("", response_model=list[StaffRead])
def list_staff(admin: dict = Depends(get_current_salon_admin), db: Session = Depends(get_db)):
    return db.query(Staff).filter(Staff.salon_id == uuid.UUID(admin["salon_id"])).all()


def _get_owned_staff(staff_id: uuid.UUID, admin: dict, db: Session) -> Staff:
    staff = db.get(Staff, staff_id)
    if staff is None or staff.salon_id != uuid.UUID(admin["salon_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")
    return staff


@router.patch("/{staff_id}", response_model=StaffRead)
def update_staff(
    staff_id: uuid.UUID,
    payload: StaffUpdateRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    staff = _get_owned_staff(staff_id, admin, db)
    for field, value in payload.model_dump().items():
        setattr(staff, field, value)
    db.commit()
    db.refresh(staff)
    return staff


@router.delete("/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_staff(
    staff_id: uuid.UUID,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    staff = _get_owned_staff(staff_id, admin, db)
    db.delete(staff)
    db.commit()


def _get_owned_availability(availability_id: uuid.UUID, staff_id: uuid.UUID, db: Session) -> StaffAvailability:
    availability = db.get(StaffAvailability, availability_id)
    if availability is None or availability.staff_id != staff_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Availability entry not found")
    return availability


@router.get("/{staff_id}/availability", response_model=list[AvailabilityRead])
def list_availability(
    staff_id: uuid.UUID,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    _get_owned_staff(staff_id, admin, db)
    return db.query(StaffAvailability).filter(StaffAvailability.staff_id == staff_id).all()


@router.post("/{staff_id}/availability", response_model=AvailabilityRead, status_code=status.HTTP_201_CREATED)
def create_availability(
    staff_id: uuid.UUID,
    payload: AvailabilityCreateRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    _get_owned_staff(staff_id, admin, db)
    availability = StaffAvailability(staff_id=staff_id, **payload.model_dump())
    db.add(availability)
    db.commit()
    db.refresh(availability)
    return availability


@router.put("/{staff_id}/availability/{availability_id}", response_model=AvailabilityRead)
def update_availability(
    staff_id: uuid.UUID,
    availability_id: uuid.UUID,
    payload: AvailabilityUpdateRequest,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    _get_owned_staff(staff_id, admin, db)
    availability = _get_owned_availability(availability_id, staff_id, db)
    for field, value in payload.model_dump().items():
        setattr(availability, field, value)
    db.commit()
    db.refresh(availability)
    return availability


@router.delete("/{staff_id}/availability/{availability_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_availability(
    staff_id: uuid.UUID,
    availability_id: uuid.UUID,
    admin: dict = Depends(get_current_salon_admin),
    db: Session = Depends(get_db),
):
    _get_owned_staff(staff_id, admin, db)
    availability = _get_owned_availability(availability_id, staff_id, db)
    db.delete(availability)
    db.commit()
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && source .venv/bin/activate && pytest tests/test_staff_availability.py tests/test_staff.py -v`
Expected: all PASS.

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && source .venv/bin/activate && pytest -v`
Expected: all PASS, no regressions in any other file.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/staff_availability.py backend/app/routers/staff.py backend/tests/test_staff_availability.py
git commit -m "feat: add StaffAvailability CRUD endpoints with ownership scoping"
```

---

### Task 4: Bookings nav link + day-view page shell

**Files:**
- Modify: `frontend/app/admin/layout.tsx`
- Create: `frontend/app/admin/bookings/page.tsx`

**Interfaces:**
- Consumes: `adminFetch<T>`, `AdminApiError` from `@/lib/adminApi`; `useToast` from `@/components/ui/Toast`; `PageHeading`, `Button`, `Dropdown` from `@/components/ui/*`.
- Produces: `DashboardBooking` TS interface `{ id: string; salon_id: string; service_id: string; staff_id: string | null; customer_name: string; customer_phone: string; customer_email: string; gender: string; scheduled_at: string; status: "pending" | "confirmed" | "completed" | "cancelled"; service_name: string; staff_name: string | null }`, `StaffMember` TS interface `{ id: string; name: string; photo_url: string | null; bio: string }` — both exported from `frontend/app/admin/bookings/page.tsx` for Tasks 5 and 6 to import.

- [ ] **Step 1: Add the nav link**

In `frontend/app/admin/layout.tsx`, change the `NAV_LINKS` array from:

```ts
const NAV_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/gallery", label: "Gallery" },
  { href: "/admin/content", label: "Content" },
];
```

to:

```ts
const NAV_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/gallery", label: "Gallery" },
  { href: "/admin/content", label: "Content" },
];
```

No other change to this file.

- [ ] **Step 2: Create the page shell**

Create `frontend/app/admin/bookings/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { adminFetch, AdminApiError } from "@/lib/adminApi";
import PageHeading from "@/components/ui/PageHeading";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

export interface DashboardBooking {
  id: string;
  salon_id: string;
  service_id: string;
  staff_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  gender: string;
  scheduled_at: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  service_name: string;
  staff_name: string | null;
}

export interface StaffMember {
  id: string;
  name: string;
  photo_url: string | null;
  bio: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

export default function BookingsPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [statusFilter, setStatusFilter] = useState("");
  const [bookings, setBookings] = useState<DashboardBooking[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const from = toIsoDate(selectedDate);
      const to = toIsoDate(addDays(selectedDate, 1));
      const params = new URLSearchParams({ from_date: from, to_date: to });
      if (statusFilter) params.set("status", statusFilter);
      const [bookingsData, staffData] = await Promise.all([
        adminFetch<DashboardBooking[]>(`/dashboard/bookings?${params.toString()}`),
        adminFetch<StaffMember[]>("/dashboard/staff"),
      ]);
      setBookings(bookingsData);
      setStaff(staffData);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : "Failed to load bookings";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, statusFilter]);

  function updateBookingInPlace(updated: DashboardBooking) {
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? { ...b, status: updated.status } : b)));
  }

  return (
    <div>
      <PageHeading>Bookings</PageHeading>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => setSelectedDate((d) => addDays(d, -1))}>
          Previous
        </Button>
        <Button variant="secondary" onClick={() => setSelectedDate(new Date())}>
          Today
        </Button>
        <Button variant="secondary" onClick={() => setSelectedDate((d) => addDays(d, 1))}>
          Next
        </Button>
        <span className="text-sm font-medium text-ink">
          {selectedDate.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </span>
        <Dropdown value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Dropdown>
      </div>

      {loading ? (
        <div className="mt-6 flex flex-col gap-3">
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-16 rounded-md" />
        </div>
      ) : staff.length === 0 ? (
        <EmptyState title="No staff yet" description="Add staff members to start scheduling bookings." />
      ) : bookings.length === 0 ? (
        <EmptyState title="No bookings for this day" description="Try a different date or status filter." />
      ) : (
        <p className="mt-6 text-sm text-taupe">
          {bookings.length} booking{bookings.length === 1 ? "" : "s"} across {staff.length} staff member
          {staff.length === 1 ? "" : "s"}. Calendar grid coming in the next task.
        </p>
      )}
    </div>
  );
}
```

Task 5 will replace the placeholder `<p>` at the bottom with the real `DayCalendar` grid, and Task 6 will wire `updateBookingInPlace` into the booking-detail modal's status-change flow — both already declared here so this task's shell has a stable interface for later tasks to consume.

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual check**

Start the backend and frontend dev servers (per `.claude/launch.json`), log into `/admin/login`, navigate to `/admin/bookings`. Confirm: the "Bookings" nav link appears and is active; the page loads without error; date navigation buttons change the displayed date; the status dropdown is present; either the staff-empty-state, bookings-empty-state, or the summary count paragraph renders depending on seeded data.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/admin/layout.tsx frontend/app/admin/bookings/page.tsx
git commit -m "feat: add bookings nav link and day-view page shell with data loading"
```

---

### Task 5: Day-view calendar grid (staff-as-columns)

**Files:**
- Create: `frontend/app/admin/bookings/DayCalendar.tsx`
- Modify: `frontend/app/admin/bookings/page.tsx`

**Interfaces:**
- Consumes: `DashboardBooking`, `StaffMember` types from Task 4 (same file, `frontend/app/admin/bookings/page.tsx`).
- Produces: `DayCalendar({ bookings, staff, onSelectBooking }: { bookings: DashboardBooking[]; staff: StaffMember[]; onSelectBooking: (booking: DashboardBooking) => void })`, default export from `frontend/app/admin/bookings/DayCalendar.tsx`.

- [ ] **Step 1: Create the grid component**

Create `frontend/app/admin/bookings/DayCalendar.tsx`:

```tsx
"use client";

import { DashboardBooking, StaffMember } from "./page";

const WINDOW_START_HOUR = 8;
const WINDOW_END_HOUR = 20;
const WINDOW_MINUTES = (WINDOW_END_HOUR - WINDOW_START_HOUR) * 60;
const BLOCK_MINUTES = 30;
const PX_PER_HOUR = 60;
const GRID_HEIGHT_PX = (WINDOW_END_HOUR - WINDOW_START_HOUR) * PX_PER_HOUR;

const STATUS_BAR_CLASS: Record<DashboardBooking["status"], string> = {
  pending: "bg-amber-100 border-amber-400 text-amber-800",
  confirmed: "bg-accent-light border-accent text-accent",
  completed: "bg-hairline border-taupe text-ink",
  cancelled: "bg-red-100 border-danger text-danger",
};

function minutesSinceWindowStart(isoDateTime: string): number {
  const d = new Date(isoDateTime);
  return (d.getHours() - WINDOW_START_HOUR) * 60 + d.getMinutes();
}

function formatTime(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

interface DayCalendarProps {
  bookings: DashboardBooking[];
  staff: StaffMember[];
  onSelectBooking: (booking: DashboardBooking) => void;
}

export default function DayCalendar({ bookings, staff, onSelectBooking }: DayCalendarProps) {
  const hourLabels = Array.from(
    { length: WINDOW_END_HOUR - WINDOW_START_HOUR + 1 },
    (_, i) => WINDOW_START_HOUR + i
  );

  const bookingsByStaff = new Map<string, DashboardBooking[]>();
  const unassigned: DashboardBooking[] = [];
  for (const booking of bookings) {
    if (!booking.staff_id) {
      unassigned.push(booking);
      continue;
    }
    const list = bookingsByStaff.get(booking.staff_id) ?? [];
    list.push(booking);
    bookingsByStaff.set(booking.staff_id, list);
  }

  const columns = [...staff.map((s) => ({ id: s.id, name: s.name })), { id: "__unassigned__", name: "Unassigned" }];

  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-hairline">
      <div className="flex min-w-max">
        <div className="w-16 shrink-0 border-r border-hairline">
          <div className="h-10 border-b border-hairline" />
          <div style={{ height: GRID_HEIGHT_PX }} className="relative">
            {hourLabels.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 -translate-y-1/2 px-1 text-xs text-taupe"
                style={{ top: `${((hour - WINDOW_START_HOUR) / (WINDOW_END_HOUR - WINDOW_START_HOUR)) * 100}%` }}
              >
                {hour}:00
              </div>
            ))}
          </div>
        </div>
        {columns.map((column) => {
          const columnBookings = column.id === "__unassigned__" ? unassigned : bookingsByStaff.get(column.id) ?? [];
          return (
            <div key={column.id} className="w-48 shrink-0 border-r border-hairline last:border-r-0">
              <div className="flex h-10 items-center justify-center border-b border-hairline px-2 text-sm font-medium text-ink">
                {column.name}
              </div>
              <div style={{ height: GRID_HEIGHT_PX }} className="relative bg-bg">
                {hourLabels.slice(0, -1).map((hour) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-hairline/60"
                    style={{ top: `${((hour - WINDOW_START_HOUR) / (WINDOW_END_HOUR - WINDOW_START_HOUR)) * 100}%` }}
                  />
                ))}
                {columnBookings.map((booking) => {
                  const offset = minutesSinceWindowStart(booking.scheduled_at);
                  if (offset < 0 || offset > WINDOW_MINUTES) return null;
                  const top = (offset / WINDOW_MINUTES) * 100;
                  const height = (BLOCK_MINUTES / WINDOW_MINUTES) * 100;
                  return (
                    <button
                      key={booking.id}
                      onClick={() => onSelectBooking(booking)}
                      className={`absolute left-1 right-1 overflow-hidden rounded border px-1 text-left text-xs ${STATUS_BAR_CLASS[booking.status]}`}
                      style={{ top: `${top}%`, height: `${height}%` }}
                    >
                      <span className="block truncate font-medium">{formatTime(booking.scheduled_at)}</span>
                      <span className="block truncate">{booking.customer_name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the page**

In `frontend/app/admin/bookings/page.tsx`, add `import DayCalendar from "./DayCalendar";` near the top, and replace the placeholder summary paragraph:

```tsx
        <p className="mt-6 text-sm text-taupe">
          {bookings.length} booking{bookings.length === 1 ? "" : "s"} across {staff.length} staff member
          {staff.length === 1 ? "" : "s"}. Calendar grid coming in the next task.
        </p>
```

with:

```tsx
        <DayCalendar bookings={bookings} staff={staff} onSelectBooking={() => {}} />
```

(`onSelectBooking` is a no-op for now; Task 6 wires it to the detail modal.)

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual check**

Reload `/admin/bookings` with seeded staff and at least one booking scheduled between 08:00–20:00 today. Confirm: one column per staff member plus an "Unassigned" column, hour labels down the left gutter, the booking renders as a colored block positioned at roughly the right vertical offset for its time, and the block's color/border matches its status (amber=pending, teal=confirmed, gray=completed, red=cancelled).

- [ ] **Step 5: Commit**

```bash
git add frontend/app/admin/bookings/DayCalendar.tsx frontend/app/admin/bookings/page.tsx
git commit -m "feat: add day-view calendar grid with staff columns and time-positioned bookings"
```

---

### Task 6: Booking detail modal + status transitions

**Files:**
- Create: `frontend/app/admin/bookings/BookingDetailModal.tsx`
- Modify: `frontend/app/admin/bookings/page.tsx`

**Interfaces:**
- Consumes: `DashboardBooking` type from Task 4; `Modal` from `@/components/ui/Modal` (props: `{ open: boolean; onClose: () => void; children: ReactNode }`); `Badge` from `@/components/ui/Badge` (props: `{ variant: "success" | "warning" | "danger" | "neutral"; children: ReactNode }`); `Button` from `@/components/ui/Button`; `adminFetch`, `AdminApiError` from `@/lib/adminApi`; `useToast` from `@/components/ui/Toast`.
- Produces: `BookingDetailModal({ booking, onClose, onStatusChanged }: { booking: DashboardBooking | null; onClose: () => void; onStatusChanged: (updated: DashboardBooking) => void })`, default export.

- [ ] **Step 1: Create the modal component**

Create `frontend/app/admin/bookings/BookingDetailModal.tsx`:

```tsx
"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { adminFetch, AdminApiError } from "@/lib/adminApi";
import { useToast } from "@/components/ui/Toast";
import { DashboardBooking } from "./page";

const STATUS_BADGE_VARIANT: Record<DashboardBooking["status"], "success" | "warning" | "danger" | "neutral"> = {
  pending: "warning",
  confirmed: "neutral",
  completed: "success",
  cancelled: "danger",
};

const ALL_STATUSES: DashboardBooking["status"][] = ["pending", "confirmed", "completed", "cancelled"];

interface BookingDetailModalProps {
  booking: DashboardBooking | null;
  onClose: () => void;
  onStatusChanged: (updated: DashboardBooking) => void;
}

export default function BookingDetailModal({ booking, onClose, onStatusChanged }: BookingDetailModalProps) {
  const [updating, setUpdating] = useState(false);
  const { showToast } = useToast();

  async function handleStatusChange(newStatus: DashboardBooking["status"]) {
    if (!booking) return;
    setUpdating(true);
    try {
      const updated = await adminFetch<{ status: DashboardBooking["status"] }>(`/dashboard/bookings/${booking.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      onStatusChanged({ ...booking, status: updated.status });
      showToast("Booking updated", "success");
      onClose();
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : "Failed to update booking";
      showToast(message, "error");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <Modal open={booking !== null} onClose={onClose}>
      {booking && (
        <div>
          <div className="flex items-center justify-between">
            <p className="font-serif text-xl text-ink">{booking.customer_name}</p>
            <Badge variant={STATUS_BADGE_VARIANT[booking.status]}>{booking.status}</Badge>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-taupe">Service</dt>
              <dd className="text-ink">{booking.service_name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-taupe">Staff</dt>
              <dd className="text-ink">{booking.staff_name ?? "Unassigned"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-taupe">Time</dt>
              <dd className="text-ink">{new Date(booking.scheduled_at).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-taupe">Phone</dt>
              <dd className="text-ink">{booking.customer_phone}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-taupe">Email</dt>
              <dd className="text-ink">{booking.customer_email}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            {ALL_STATUSES.filter((s) => s !== booking.status).map((s) => (
              <Button key={s} variant="secondary" disabled={updating} onClick={() => handleStatusChange(s)}>
                Mark {s}
              </Button>
            ))}
          </div>
          <button onClick={onClose} className="mt-4 text-sm text-taupe hover:text-ink">
            Close
          </button>
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Wire it into the page**

In `frontend/app/admin/bookings/page.tsx`:

1. Add `import BookingDetailModal from "./BookingDetailModal";` near the top.
2. Add state: `const [selectedBooking, setSelectedBooking] = useState<DashboardBooking | null>(null);`
3. Change the `<DayCalendar ... onSelectBooking={() => {}} />` call to `<DayCalendar bookings={bookings} staff={staff} onSelectBooking={setSelectedBooking} />`.
4. Add, right after the `<DayCalendar ... />` element (still inside the outer `<div>`):

```tsx
      <BookingDetailModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onStatusChanged={updateBookingInPlace}
      />
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual check**

Reload `/admin/bookings`, click a booking block. Confirm: the modal opens with correct customer/service/staff/time details and a status `Badge` matching the block's color; clicking a "Mark ___" button updates the booking's status, closes the modal, shows a success `Toast`, and the calendar block's color changes to reflect the new status without a full page reload. Also confirm Escape key and clicking outside the modal close it without changes.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/admin/bookings/BookingDetailModal.tsx frontend/app/admin/bookings/page.tsx
git commit -m "feat: add booking detail modal with status transitions"
```

---

### Task 7: Staff working-hours editor (Tabs on `/admin/staff`)

**Files:**
- Create: `frontend/components/admin/StaffAvailabilityEditor.tsx`
- Modify: `frontend/app/admin/staff/page.tsx`

**Interfaces:**
- Consumes: `Tabs` from `@/components/ui/Tabs` (props: `{ tabs: { key: string; label: string }[]; activeKey: string; onChange: (key: string) => void }`); `Dropdown` from `@/components/ui/Dropdown`; `adminFetch`, `AdminApiError` from `@/lib/adminApi`; `useToast` from `@/components/ui/Toast`; the existing `Staff` interface already defined in `frontend/app/admin/staff/page.tsx`.
- Produces: `StaffAvailabilityEditor({ staff }: { staff: Staff[] })`, default export from `frontend/components/admin/StaffAvailabilityEditor.tsx`.

- [ ] **Step 1: Create the editor component**

Create `frontend/components/admin/StaffAvailabilityEditor.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Dropdown from "@/components/ui/Dropdown";
import Button from "@/components/ui/Button";
import { adminFetch, AdminApiError } from "@/lib/adminApi";
import { useToast } from "@/components/ui/Toast";

interface StaffOption {
  id: string;
  name: string;
}

interface Availability {
  id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface DayRow {
  dayOfWeek: number;
  available: boolean;
  startTime: string;
  endTime: string;
  existingId: string | null;
}

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function buildRows(existing: Availability[]): DayRow[] {
  return DAY_LABELS.map((_, dayOfWeek) => {
    const match = existing.find((a) => a.day_of_week === dayOfWeek);
    return match
      ? { dayOfWeek, available: true, startTime: match.start_time, endTime: match.end_time, existingId: match.id }
      : { dayOfWeek, available: false, startTime: "09:00", endTime: "17:00", existingId: null };
  });
}

interface StaffAvailabilityEditorProps {
  staff: StaffOption[];
}

export default function StaffAvailabilityEditor({ staff }: StaffAvailabilityEditorProps) {
  const [selectedStaffId, setSelectedStaffId] = useState(staff[0]?.id ?? "");
  const [rows, setRows] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!selectedStaffId) return;
    setLoading(true);
    adminFetch<Availability[]>(`/dashboard/staff/${selectedStaffId}/availability`)
      .then((data) => setRows(buildRows(data)))
      .catch((err) => {
        const message = err instanceof AdminApiError ? err.message : "Failed to load availability";
        showToast(message, "error");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStaffId]);

  function updateRow(dayOfWeek: number, patch: Partial<DayRow>) {
    setRows((prev) => prev.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row)));
  }

  async function handleSave() {
    if (!selectedStaffId) return;
    setSaving(true);
    try {
      for (const row of rows) {
        if (row.available && !row.existingId) {
          await adminFetch(`/dashboard/staff/${selectedStaffId}/availability`, {
            method: "POST",
            body: JSON.stringify({ day_of_week: row.dayOfWeek, start_time: row.startTime, end_time: row.endTime }),
          });
        } else if (row.available && row.existingId) {
          await adminFetch(`/dashboard/staff/${selectedStaffId}/availability/${row.existingId}`, {
            method: "PUT",
            body: JSON.stringify({ day_of_week: row.dayOfWeek, start_time: row.startTime, end_time: row.endTime }),
          });
        } else if (!row.available && row.existingId) {
          await adminFetch(`/dashboard/staff/${selectedStaffId}/availability/${row.existingId}`, {
            method: "DELETE",
          });
        }
      }
      const refreshed = await adminFetch<Availability[]>(`/dashboard/staff/${selectedStaffId}/availability`);
      setRows(buildRows(refreshed));
      showToast("Working hours saved", "success");
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : "Failed to save working hours";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  if (staff.length === 0) {
    return <p className="mt-6 text-sm text-taupe">Add a staff member first to set their working hours.</p>;
  }

  return (
    <div className="mt-6">
      <Dropdown value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)}>
        {staff.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </Dropdown>

      {loading ? (
        <p className="mt-4 text-sm text-taupe">Loading...</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {rows.map((row) => (
            <div key={row.dayOfWeek} className="flex items-center gap-4 rounded-md border border-hairline p-3">
              <label className="flex w-32 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={row.available}
                  onChange={(e) => updateRow(row.dayOfWeek, { available: e.target.checked })}
                />
                {DAY_LABELS[row.dayOfWeek]}
              </label>
              {row.available && (
                <>
                  <input
                    type="time"
                    value={row.startTime}
                    onChange={(e) => updateRow(row.dayOfWeek, { startTime: e.target.value })}
                    className="rounded border border-hairline px-2 py-1 text-sm"
                  />
                  <span className="text-taupe">to</span>
                  <input
                    type="time"
                    value={row.endTime}
                    onChange={(e) => updateRow(row.dayOfWeek, { endTime: e.target.value })}
                    className="rounded border border-hairline px-2 py-1 text-sm"
                  />
                </>
              )}
            </div>
          ))}
          <Button onClick={handleSave} disabled={saving} className="self-start">
            {saving ? "Saving..." : "Save working hours"}
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire `Tabs` into the staff page**

In `frontend/app/admin/staff/page.tsx`:

1. Add imports: `import Tabs from "@/components/ui/Tabs";` and `import StaffAvailabilityEditor from "@/components/admin/StaffAvailabilityEditor";`
2. Add state near the other `useState` declarations: `const [activeTab, setActiveTab] = useState("staff");`
3. Immediately after the `<PageHeading>Staff</PageHeading>` line and the `{error && ...}` line, insert:

```tsx
      <Tabs
        tabs={[
          { key: "staff", label: "Staff" },
          { key: "hours", label: "Working Hours" },
        ]}
        activeKey={activeTab}
        onChange={setActiveTab}
      />
```

4. Wrap the existing `<Card as="form" ...>` block through the closing of the staff grid/`EmptyState`/`Skeleton` block (everything currently below the error message and above the final closing `</div>` of the component) in a conditional: `{activeTab === "staff" && ( ... existing JSX ... )}`.
5. After that conditional block, before the component's final closing `</div>`, add:

```tsx
      {activeTab === "hours" && <StaffAvailabilityEditor staff={staff} />}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual check**

Load `/admin/staff`. Confirm the "Staff" / "Working Hours" tabs render, "Staff" tab shows the existing CRUD UI unchanged, clicking "Working Hours" shows a staff picker and 7-day editor. Select a staff member, toggle a day available, set start/end times, click "Save working hours" — confirm a success `Toast`, then reload the page and re-select the same staff member to confirm the saved hours persist. Toggle a previously-available day off, save, and confirm it's removed on reload.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/admin/StaffAvailabilityEditor.tsx frontend/app/admin/staff/page.tsx
git commit -m "feat: add staff working-hours editor as a Tabs panel on the staff page"
```

---

### Task 8: Full-project verification pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Backend full suite**

Run: `cd backend && source .venv/bin/activate && pytest -v`
Expected: all tests pass, including every test added in Tasks 1-3 and every pre-existing test in the suite.

- [ ] **Step 2: Frontend typecheck and build**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && rm -rf .next && npm run build`
Expected: clean build, exit code 0, all routes including `/admin/bookings` listed in the output.

- [ ] **Step 3: End-to-end manual walkthrough**

Start both dev servers. Seed at least one salon with 2+ staff members and several bookings across different times/statuses today (use the existing seed script or the SQLAdmin dashboard at `/admin` on the backend if faster). In the browser:
1. Log into `/admin/login`, confirm the "Bookings" nav link is present and active-highlighted on `/admin/bookings`.
2. Confirm the day grid shows the seeded bookings in correct staff columns at roughly correct time positions, color-coded by status.
3. Click a booking, confirm the detail modal shows correct data, change its status, confirm the Badge/Toast/grid-block color update without reload.
4. Navigate to the next/previous day and back to today; confirm the grid refetches and updates.
5. Filter by status; confirm only matching bookings render.
6. Go to `/admin/staff`, switch to "Working Hours," edit and save a staff member's hours, reload, and confirm persistence; toggle a day off and confirm it's removed after save+reload.

No commit for this task — verification only. If any issue surfaces, fix it in the relevant earlier task's files with a small fixup commit, then re-run this task's steps.
