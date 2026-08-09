# Admin Bookings Dashboard + Staff Availability & Calendar — Design Spec

**Goal:** Close the largest already-half-built gap in Ceylon Bellezza: the `bookings_dashboard` backend router exists with no admin UI consuming it, and the `StaffAvailability` model has existed in the database schema with zero router, zero schema, and zero frontend since it was first created. This spec gives salon admins a real day-view calendar to manage bookings and a weekly working-hours editor for staff. This is Phase 1 of the [Fresha/Mangomint parity roadmap](../plans/2026-07-21-full-enhancement-roadmap.md) and the natural next step after Phase 0 (design system & motion foundation, merged in PR #8).

**Non-goals:**
- No week view — day view only, with prev/next/today navigation. A week view is an explicit future fast-follow.
- No changes to the public-facing `BookingForm.tsx` — it keeps its current behavior (no availability checking against `StaffAvailability` or existing bookings). Wiring real-time availability into the public booking flow is an explicit deferred follow-up, not part of this phase.
- No drag-to-reschedule, no collision/overlap layout for simultaneous bookings on different staff (each staff has their own column, so cross-staff overlap is a non-issue; same-staff overlap is already prevented by the existing DB unique constraint).
- No new npm dependency — the calendar grid is built with plain CSS positioning, consistent with Phase 0's convention.
- No bulk-upsert endpoint for availability — the frontend reconciles via individual POST/PUT/DELETE calls per changed day.

## Architecture

Two backend additions plus two frontend surfaces, following the exact conventions already established in this codebase:

1. **Backend**: a `BookingStatus` literal added to existing booking schemas (closing an actual validation gap — the status field currently accepts any string), two new optional query params on the existing `GET /dashboard/bookings` endpoint, and a new `StaffAvailability` CRUD sub-resource nested under the existing staff router.
2. **Frontend — Bookings**: a new `/admin/bookings` day-view calendar page, staff-as-columns, with a `Modal`-based booking detail/status-change flow (the first real consumer of Phase 0's `Modal` primitive).
3. **Frontend — Staff working hours**: a new "Working Hours" tab on the existing `/admin/staff` page (the first real consumer of Phase 0's `Tabs` primitive), with a per-staff weekly editor.

### Backend: booking status validation

`Booking.status` currently defaults to `"pending"` and is the only value ever set anywhere in the code; the PATCH endpoint accepts any string with zero validation. This spec introduces the full lifecycle now — `pending`, `confirmed`, `completed`, `cancelled` — because the later Reviews & Ratings phase needs `completed` to exist as a real, validated status to attach a review to.

```python
# backend/app/schemas/booking.py
BookingStatus = Literal["pending", "confirmed", "completed", "cancelled"]

class BookingStatusUpdateRequest(BaseModel):
    status: BookingStatus

class BookingRead(BaseModel):
    ...
    status: BookingStatus
    ...
```

Using `Literal` (matching this file's existing `Gender` enum pattern) gets automatic 422 rejection of invalid values from Pydantic — no manual guard needed, unlike the one-line manual status guard added to `SalonLead` in a prior phase, since here the valid set is genuinely closed and expressible as a type.

### Backend: `GET /dashboard/bookings` query extension

Two new optional query params on the existing endpoint in `backend/app/routers/bookings_dashboard.py`:

- `to_date: date | None` — when omitted, defaults to `from_date + 1 day`, so a day-view request (`from_date=X` only) naturally returns just that single day without the caller computing a range. When provided, filters `scheduled_at < to_date_start`.
- `status: BookingStatus | None` — filters by exact status match; drives the day-view's status filter so an admin can hide cancelled/completed noise from the working view.

No staff-id filter at the query level — the day-view fetches the whole day once (it already needs the full staff roster to render columns) and buckets bookings into staff columns client-side.

### Backend: `StaffAvailability` schema + router

New file `backend/app/schemas/staff_availability.py`:

```python
class AvailabilityCreateRequest(BaseModel):
    day_of_week: int  # 0=Monday .. 6=Sunday, validated 0-6
    start_time: str    # "HH:MM"
    end_time: str       # "HH:MM"

class AvailabilityRead(BaseModel):
    id: UUID
    staff_id: UUID
    day_of_week: int
    start_time: str
    end_time: str
    model_config = ConfigDict(from_attributes=True)

class AvailabilityUpdateRequest(AvailabilityCreateRequest):
    pass  # full replace, same shape as create
```

New routes added to the existing `backend/app/routers/staff.py` (co-located with the `Staff` CRUD it belongs to, matching this codebase's one-router-per-resource-family convention):

- `GET /dashboard/staff/{staff_id}/availability` — list a staff member's weekly hours.
- `POST /dashboard/staff/{staff_id}/availability` — create one day's hours.
- `PUT /dashboard/staff/{staff_id}/availability/{availability_id}` — replace one day's hours.
- `DELETE /dashboard/staff/{staff_id}/availability/{availability_id}` — remove one day's hours (day becomes "unavailable").

Ownership scoping: `StaffAvailability` has no direct `salon_id` column, only `staff_id`, so ownership is checked by joining through the parent. A new `_get_owned_staff(staff_id, admin)` helper (404 if `Staff.salon_id != admin salon` or not found) gates every availability endpoint first; a new `_get_owned_availability(availability_id, staff_id)` helper (404 if not found or `staff_id` mismatch) additionally gates update/delete. This is the join-through-parent adaptation of the existing `_get_owned_<entity>` idiom used throughout this router file.

No Alembic migration needed — the `staff_availability` table already exists from the original schema migration; this spec only adds application code on top of it.

### Frontend: `/admin/bookings` day-view calendar

Nav: add `{ href: "/admin/bookings", label: "Bookings" }` to `NAV_LINKS` in `frontend/app/admin/layout.tsx`, positioned right after "Dashboard."

New client-component page `frontend/app/admin/bookings/page.tsx`: `PageHeading` + date navigation (prev-day / "Today" / next-day) + a status `Dropdown` filter (All/Pending/Confirmed/Completed/Cancelled) driving the new `status` query param. Data loads via `useEffect` keyed on `[selectedDate, statusFilter]`, calling `adminFetch<DashboardBookingRead[]>('/dashboard/bookings?from_date=...&status=...')`. Also fetches the salon's staff list (`GET /dashboard/staff`, already exists) to render columns even on days with zero bookings for a given staff member.

**Grid layout**: staff-as-columns, absolute-positioned time blocks — no new dependency. Since neither `Booking` nor `Service` has a duration field, every booking renders as a fixed-height block (30-minute visual height) positioned via `top: (minutesSinceWindowStart / totalWindowMinutes) * 100%` within a `position: relative` column per staff member, whose height = business-hours-window × px-per-hour. A hardcoded business-hours window (08:00–20:00) is the v1 time axis; deriving real bounds from `StaffAvailability` is a future nice-to-have, not required here — it would couple the grid's render to a second network call before it can draw.

New `frontend/app/admin/bookings/DayCalendar.tsx` (`"use client"`) — the staff-columns grid itself. `Skeleton` blocks while loading; `EmptyState` when the filtered day has zero bookings.

**First real `Modal` consumer**: clicking a booking block opens `frontend/app/admin/bookings/BookingDetailModal.tsx`, showing customer name/phone/email, service name, staff name (or "Unassigned"), scheduled time, current status as a `Badge` (`pending`→warning, `confirmed`→neutral, `completed`→success, `cancelled`→danger), and status-transition buttons for the three other statuses. Clicking a transition button PATCHes the booking, optimistically updates local state, fires `showToast`, and closes the modal.

### Frontend: staff working-hours editor

Lives as a second tab on the existing `/admin/staff` page via the `Tabs` primitive ("Staff" / "Working Hours") rather than a new route — both are views over the same staff roster, and this makes `Tabs` a real second Phase-0-primitive consumer alongside `Modal`. New `frontend/components/admin/StaffAvailabilityEditor.tsx`: a staff-picker (reusing the already-loaded staff list from the "Staff" tab), then a 7-row Mon–Sun editor per selected staff member, each row an "Available" toggle plus start/end time inputs (hidden when the day is toggled off). Save reconciles the diff against the loaded rows for that staff member: POST for newly-available days with no existing row, PUT for changed days, DELETE for days toggled off.

## Error Handling

- Invalid `status` values on the PATCH endpoint now return Pydantic's standard 422 instead of silently accepting any string (a genuine bug fix, not new scope creep — the field was always meant to be a closed set, per the model's own inline comment listing pending/approved/rejected-style values for the analogous `SalonLead.status`).
- Availability endpoints return 404 (not 403) when a `staff_id` or `availability_id` doesn't belong to the calling admin's salon, matching the existing `_get_owned_*` convention across this codebase (never leaks existence of another salon's data via a distinguishable error).
- The day-view calendar's data fetch failure path uses the existing `Toast` error pattern (`showToast(errorMessage, "error")`), matching every other admin dashboard page from Phase 0's retrofit.

## Testing

- Backend: extend `backend/tests/test_bookings_dashboard.py` (or create it if it doesn't exist) with cases for the `status` literal rejecting an invalid value (422), the `to_date`/`status` query params filtering correctly, and existing coverage continuing to pass. New `backend/tests/test_staff_availability.py` covering CRUD success paths and the two-step ownership 404 cases (wrong-salon staff_id, wrong-staff availability_id), following the `unittest.mock`-free direct-DB-fixture pattern already used in `test_staff.py`.
- Frontend: no automated tests, by this repo's established convention. Manual verification: load `/admin/bookings`, confirm seeded bookings render in the correct staff column and time position; open a booking's `Modal`, change its status, confirm the `Badge` and list update with a `Toast`; navigate prev/next/today; filter by status. Load `/admin/staff`'s new "Working Hours" tab, edit and save a staff member's weekly hours, reload the page and confirm persistence.

## Self-Review Notes

- **Spec coverage**: all six areas from the approved plan (status validation, query extension, availability router, bookings calendar page, working-hours editor, file structure) are reflected above. The deferred BookingForm follow-up is stated explicitly as a non-goal, not silently dropped.
- **Placeholder scan**: no TBD/TODO. The hardcoded 08:00–20:00 business-hours window is a stated, deliberate v1 simplification, not a placeholder.
- **Internal consistency**: the two-step ownership-check pattern for availability (staff-level, then availability-level) is described identically in both the router section and the error-handling section.
- **Scope check**: one cohesive feature (calendar + availability, both serving the same "admin manages their operational day" need), appropriately sized for one implementation plan — matches the size of prior single-plan features in this repo (e.g. salon-owner-onboarding).
