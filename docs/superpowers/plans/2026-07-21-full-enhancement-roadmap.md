# Ceylon Bellezza — Full Enhancement Roadmap (Backend + Frontend)

## Context

Over this build-out, Ceylon Bellezza has grown from a bare public salon directory into a working multi-tenant marketplace: public browsing + guest booking, a full salon-admin dashboard (services/staff/gallery/content), a unified visual design system, and demo data across 8 Sri Lankan cities. What's still missing is everything that turns this from "a working demo" into "a platform a real salon owner and a real customer could actually use end-to-end" — onboarding new salons, salon owners actually managing their calendar and revenue, and customers finding salons near them and trusting them via reviews.

This document is a **roadmap**, not a single implementation plan — it inventories what's built, what's not, and sequences the remaining work into 8 phases. Each phase is independently sized for its own brainstorm → design spec → implementation plan cycle (the same process used for every feature built so far), not a single mega-plan, because they touch different parts of the system and different stakeholders (platform operator vs. salon owner vs. customer). **This document's job is to give you the map; each phase gets scoped for real right before it's built**, the same way the Salon Admin Dashboard and Booking Backend specs were written just-in-time rather than upfront.

## Current State

**Built and merged to `main`:**
- Public marketplace: homepage directory + search (text-only), salon detail pages, guest booking form (`POST /salons/{slug}/bookings`)
- Salon Admin Dashboard (`/admin/*`): login, services/staff/gallery/content CRUD, `/dashboard/bookings` list+status-update API (no calendar UI yet — data-only)
- Unified design system: shared UI primitives (`frontend/components/ui/*`), consistent serif/utilitarian styling across public site and admin dashboard
- Platform-admin backend API exists (`/admin/salons` — create/list/toggle-modules/status) but **no frontend** for it
- 10 demo salons seeded across 8 cities

**Explicitly not built yet (this roadmap's subject):**
- Platform Admin Dashboard UI
- Any way for a real salon owner to *become* a salon owner (today, only the platform admin API/seed script can create one — no public-facing onboarding)
- Any UI for the booking data the calendar needs
- Email of any kind (no SMTP/email-sending capability exists in the codebase at all)
- Reviews, image upload, cash flow view, location-aware search

## Phases (recommended build order)

Ordering follows dependencies: onboarding needs the platform dashboard to exist; notifications reuse onboarding's email infrastructure; the calendar and cash-flow views consume booking data already built; reviews need completed bookings to attach to; image upload and nearby-search are independent and can slot in anywhere, placed last as polish.

### Phase 1 — Platform Admin Dashboard
**Why first:** the backend API has existed since before the Salon Admin Dashboard was built, but there's still no way for you (the platform operator) to create a salon through the UI — only via `curl`/the seed script. Spec already exists: `docs/superpowers/specs/2026-07-17-platform-admin-dashboard-design.md`.
**Scope:** `/platform/*` route group — login, salon list with status/module toggles, add-salon form (which also creates the owner's login credentials in one step).
**Backend:** none needed — `/admin/salons` endpoints already exist and are tested.
**Next step when picked up:** go straight to `superpowers:writing-plans` off the existing spec (brainstorm already done).

### Phase 2 — Salon-owner onboarding + email infrastructure
**Why second:** this is the actual growth path (real salons joining) and introduces the first email-sending capability in the codebase, which Phase 3 (notifications) then reuses.
**Scope:**
- Public "Join with Ceylon Bellezza" page: role picker (customer vs. salon owner) on the landing experience, salon-owner interest form (contact number, email, free-text message).
- New backend model + endpoint: a lead/application table, distinct from `Salon`/`SalonAdmin` (a lead isn't a salon yet).
- Platform Admin Dashboard (Phase 1) gets a "Leads" section: view submitted applications, and an action to convert an approved lead into a real salon + salon-admin account (reuses the Phase 1 create-salon flow).
- **Email infrastructure** (new): pick a provider (transactional email API — e.g. Resend/SendGrid/Postmark; needs your input on which, or SMTP via existing infra if you have one) to send the salon owner a login-link email once approved.
- Salon owner clicks the link → lands on `/admin/login` (already built) with credentials already set.

### Phase 3 — Booking notifications
**Why third:** trivial once Phase 2's email infrastructure exists; deferring it standalone would mean building email-sending twice.
**Scope:** confirmation email to the customer on booking creation; new-booking alert email to the salon owner. Both are one-shot sends off the existing `POST /salons/{slug}/bookings` and don't need new data models.

### Phase 4 — Salon owner appointments calendar
**Why fourth:** the data layer (`GET /dashboard/bookings`, denormalized with `service_name`/`staff_name`/`gender`) was built specifically to support this and is sitting unused by any UI.
**Scope:** a Google-Calendar-style day/week view in `/admin/appointments` (or similar) — bookings plotted by date/time, showing customer name, gender, and service; likely needs a date-range query addition to the existing endpoint (currently defaults to "today onward" with no upper bound) and a status-update action (confirm/cancel) wired to the existing `PATCH /dashboard/bookings/{id}`.
**Backend:** minor — probably just an optional `to_date` param alongside the existing `from_date`.

### Phase 5 — Cash flow / revenue view for salon owners
**Why fifth:** depends on Phase 4's booking data being visible/manageable first, and needs a decision from you on scope before it can be designed: is this booking-revenue totals derived from `Service.price × completed bookings`, or does it include manually-entered expenses too? That question blocked scoping earlier in this project and still needs an answer.
**Scope:** TBD pending that decision — likely a `/admin/revenue` summary view (daily/weekly/monthly totals) reading from `Booking`+`Service`, no new write-side data model if it's booking-revenue-only.

### Phase 6 — Ratings & reviews
**Why sixth:** needs completed bookings to attach reviews to (a review without a real booking behind it is spam-prone), so it's sequenced after the booking flow is fully operational.
**Scope:**
- New `Review` model: rating (1-5) + comment, linked to a `Booking` (not just a salon, so it's tied to a real visit) — needs a decision on whether reviews require the guest's original booking email to match (lightweight anti-spam) since there's still no customer account system.
- Public: review form on the salon page (or a link from a post-booking confirmation), reviews displayed on the salon detail page.
- Salon admin: no moderation UI in v1 (defer unless you want one) — reviews post directly.

### Phase 7 — Image upload for salon photos
**Why seventh:** independent of everything else; today salon owners paste image URLs for gallery/staff photos (a deliberate simplification from the original Salon Admin Dashboard spec). Needs a storage decision (S3, Cloudinary, or similar — none currently configured) and turns the existing `image_url`/`photo_url` text inputs into real file-upload widgets.
**Backend:** new upload endpoint(s) proxying to the chosen storage provider; `GalleryItem`/`Staff` models keep the same `image_url`/`photo_url` fields (just populated by upload instead of hand-typed URL).

### Phase 8 — Nearby-location search for customers
**Why last:** fully independent, customer-facing polish. `Salon.latitude`/`longitude` already exist and are already populated (via `backend/app/auth/geocoding.py` on salon creation) but nothing queries by distance today.
**Scope:** browser geolocation permission prompt on the homepage, a distance-sorted/filtered view (backend: a `nearby` query param on `GET /salons` using Postgres math or the `earthdistance`/PostGIS extension — plain lat/lng Euclidean distance is probably sufficient at Sri Lanka's scale and avoids a new Postgres extension).

## What This Roadmap Does Not Decide

Each phase still needs its own brainstorming pass before a line of code is written — this document intentionally stays at the "what and why and in what order" level, not "exact schemas and endpoints," because:
- Phase 2 needs your input on an email provider before it can be designed.
- Phase 5 needs your input on what "cash flow" means before it can be scoped.
- Phase 6 needs a decision on spam-prevention approach for guest reviews.
- Phase 7 needs a storage provider decision.

## Verification

This roadmap makes no code changes, so there's nothing to run. When a phase is picked up, it follows the same cycle every prior feature in this repo has: `superpowers:brainstorming` → written spec in `docs/superpowers/specs/` → `superpowers:writing-plans` → implementation on its own feature branch → tests/manual verification → PR.

## Suggested Next Action

Start Phase 1 (Platform Admin Dashboard) — its spec is already written and approved, so it can go straight to `writing-plans` with no further brainstorming needed, same pattern as the Salon Admin Dashboard build.
