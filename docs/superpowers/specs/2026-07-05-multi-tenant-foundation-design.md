# Ceylon Bellezza — Multi-Tenant Foundation & Public Marketplace Design

**Status**: Approved
**Date**: 2026-07-05
**Scope**: First sub-project of the Ceylon Bellezza platform. Covers the data model, auth/permissions, public salon directory + salon pages, salon admin dashboard, and Ceylon Bellezza super-admin panel. Does not cover: payments/billing, customer accounts, SMS notifications, request-based custom sections beyond the standard template — these are explicitly deferred (see Out of Scope).

## Product Context

Ceylon Bellezza is a SaaS product for salons (men's, women's, and unisex) in Sri Lanka (or similar market). Salons pay to be onboarded onto the platform. Once registered, a salon gets:

- A public page on the Ceylon Bellezza marketplace showcasing their services, pricing, staff, gallery, and a booking widget.
- A login-protected admin dashboard to manage their own content and bookings.
- A unique salon ID that scopes all of their data.

Guests visiting the main Ceylon Bellezza site can search or map-browse registered salons by location/city, click into a salon's page, and book an appointment as a guest (no account required). Unregistered salons do not appear anywhere on the site.

All salons share one professionally designed template. Each salon customizes it themselves (branding, colors, section visibility) from their own dashboard — no per-salon custom code.

## Architecture Overview

One Next.js app, one FastAPI backend, one PostgreSQL database, one domain (`ceylonbellezza.com`). Multi-tenancy is achieved by scoping every salon-owned table with a `salon_id`, not by subdomains or separate databases.

```
Guest ──▶ Next.js (SSR) ──▶ FastAPI ──▶ PostgreSQL
                                   └──▶ Object storage (images)
                                   └──▶ Email provider (booking confirmations)

Salon Admin ──▶ /dashboard (JWT, salon_id-scoped) ──▶ FastAPI
Ceylon Bellezza Staff ──▶ /admin (JWT, platform-wide) ──▶ FastAPI
```

### Routing

- `/` — marketplace homepage: search, map view (Google Maps), browse by city/service. Shows only `status = active` salons.
- `/salons/[slug]` — a salon's public page (server-rendered for SEO): hero, services, staff, gallery, about/contact, booking widget.
- `/dashboard` (protected) — salon admin panel, scoped to their own `salon_id` via JWT claim.
- `/admin` (protected) — Ceylon Bellezza super-admin panel, platform-wide access.

Unregistered salons have no page and do not appear in search/map results.

## Data Model

All tables below except `platform_admins` are scoped by `salon_id` (directly or via foreign key). Every API query for salon-owned data filters by the `salon_id` derived from the authenticated session (dashboard) or the URL slug (public page) — never trusted from raw client input.

- **`salons`**: `id` (UUID, the unique salon ID), `slug` (unique, used in URL), `name`, `category` (men's/women's/unisex), `address`, `city`, `latitude`, `longitude`, `status` (active/suspended), `enabled_modules` (JSON: gallery, booking, contact_form), `template_settings` (JSON: brand color, font, hero image URL, logo URL, section order/visibility).
- **`salon_admins`**: `id`, `salon_id` (FK), `email`, `password_hash`, `role`.
- **`platform_admins`**: `id`, `email`, `password_hash` — Ceylon Bellezza staff, no `salon_id`.
- **`services`**: `id`, `salon_id`, `name`, `description`, `category`, `price`, `duration_minutes`.
- **`staff`**: `id`, `salon_id`, `name`, `photo_url`, `bio`.
- **`staff_services`**: many-to-many join between `staff` and `services`.
- **`staff_availability`**: `id`, `staff_id`, `day_of_week`/`date`, working hours, blocked/time-off ranges.
- **`gallery_items`**: `id`, `salon_id`, `image_url`, `caption`.
- **`bookings`**: `id`, `salon_id`, `service_id`, `staff_id` (nullable), `customer_name`, `customer_phone`, `customer_email`, `scheduled_at`, `status` (pending/confirmed/cancelled/completed).
- **`content_blocks`**: `id`, `salon_id`, `key` (e.g. `about_us`, `contact_info`), `value` (text).

## Auth & Permissions

Two independent JWT-based auth flows:

- **Salon admin** (`/dashboard/login`): email + password. Token carries `salon_id` + role. All dashboard API calls are automatically restricted to that salon's own records — a salon admin cannot read or write another salon's data even by guessing IDs.
- **Super-admin** (`/admin/login`): email + password for Ceylon Bellezza staff. Token has no `salon_id` restriction — can act across all tenants.

Passwords hashed with bcrypt. JWTs short-lived with refresh tokens.

**Super-admin capabilities:**
- Register a new salon: enter name, address (auto-geocoded to lat/lng via Google Maps Geocoding API, with manual lat/lng entry fallback if geocoding fails), category → generates unique `salon_id` + slug → creates first salon-admin login → salon immediately appears in the public directory as active.
- Toggle feature modules per salon (gallery, booking, contact form) — reflected instantly on the public page.
- Suspend/reactivate a salon (suspended salons show a friendly "temporarily unavailable" page/response instead of a 500 or a blank page).
- View all salons in a list with status at a glance.
- View booking activity across the whole platform (for support purposes).

**Salon admin capabilities** (all scoped to their own `salon_id`):
- Customize their public page: logo, cover/hero image, brand accent color, font choice (from a preset list), section order/visibility (e.g. hide the staff section if solo salon).
- Manage services (CRUD: name, price, duration, category).
- Manage staff (CRUD: name, bio, photo, working hours, which services they perform).
- Manage gallery (upload/remove photos).
- Manage bookings (view calendar/list, confirm/cancel/mark complete, filter by date/staff).
- Edit About Us / Contact Us content.

Feature-module toggles and account suspension can only be changed by super-admin, never by a salon admin.

## Public Salon Page & Booking Flow

Each `/salons/[slug]` page, server-rendered for SEO:

- **Hero**: cover image, name, category, city.
- **Services**: grouped by category, with price + duration.
- **Staff**: cards with photo/bio (optional — hidden if salon has no staff configured or toggles it off).
- **Gallery**: photo grid.
- **About / Contact**: editable text, address shown on an embedded map, phone number.
- **Booking widget**: customer selects a service → (optionally) a staff member → an available time slot (computed from staff working hours minus existing bookings) → enters name/phone/email → confirms as a guest (no account required). Confirmation email sent to the customer; the salon admin gets an email + dashboard notification of the new booking.

Double-booking is prevented at the database level via a unique constraint on (`staff_id`, `scheduled_at`); if a slot is taken between page load and submission, the API returns a clear "that slot was just taken, please pick another" error rather than failing silently.

## Tech Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion (animations/transitions), Google Maps JavaScript API (directory map/search). Mobile-responsive throughout.
- **Backend**: FastAPI, SQLAlchemy + Alembic (migrations), Pydantic schemas, JWT auth, bcrypt.
- **Database**: PostgreSQL.
- **Object storage**: Cloudflare R2 (or S3-compatible) for logos, gallery photos, cover images.
- **Email**: transactional email provider (e.g. Resend) for booking confirmations.
- **Hosting**: Next.js on Vercel; FastAPI on Railway or Render; PostgreSQL on Neon or Supabase.

## Error Handling

- **Booking conflicts**: DB-level unique constraint + clear API error message (see above).
- **Geocoding failures**: super-admin panel flags the salon and allows manual lat/lng entry.
- **Suspended salon**: public page and booking API return a friendly "temporarily unavailable" response instead of an error page.

## Testing Approach

Kept lean for v1, focused on the two areas where bugs would be most damaging:

- Backend unit tests for booking-conflict logic (no double-booking possible).
- Backend unit tests for tenant isolation (a salon-admin JWT must never be able to read or write another salon's data).
- Basic frontend smoke test for the guest booking flow (select service → slot → submit → confirmation).

Full end-to-end coverage is not required for v1.

## Out of Scope (deferred to later sub-projects)

- Payments/billing for salon subscriptions.
- Customer accounts (guest booking only for v1).
- SMS notifications (email only for v1).
- Request-based custom sections beyond the standard template's self-serve options.
- Reviews/ratings for salons.
- PostGIS-based geo search (simple lat/lng distance calculation is sufficient at current scale).
