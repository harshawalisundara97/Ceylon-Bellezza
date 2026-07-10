# Ceylon Bellezza — Public Marketplace Frontend (Plan 4a) Design

**Status**: Approved
**Date**: 2026-07-08
**Scope**: First half of the original Plan 4 ("public marketplace + booking") sub-project. Covers: two new public (unauthenticated) backend endpoints, a new Next.js frontend with a homepage directory and per-salon public pages, and seeded demo data. Booking submission (new backend endpoint + booking UI) is explicitly deferred to a follow-up plan ("Plan 4b") so a real, browsable website exists as soon as possible.

## Product Context

Plan 1 (backend foundation, merged) built the data model, both auth flows, and salon-admin/super-admin CRUD APIs — but every existing endpoint requires a login. There is currently no way for an anonymous visitor to browse the salon directory or view a salon's public page. This plan adds that public-facing layer, plus the actual Next.js website that renders it, matching the "customized shared template" marketplace described in the original multi-tenant foundation spec.

## Out of Scope (deferred to Plan 4b)

- The booking widget and its backend endpoint (`POST` for creating a booking, availability computation, conflict prevention, confirmation email).
- Google Maps-based map/pin search — the homepage ships with a text/city filter instead; the map is a drop-in enhancement once a Google Maps API key is available.
- Image upload pipeline (object storage) — demo/seed data uses plain external image URLs, matching how `gallery_items.image_url` already works today (just a string column).
- Salon admin dashboard UI and super-admin panel UI (separate plans).

## Backend Addition: Public API

One new router, `app/routers/public.py`, mounted with no auth dependency, only ever returning salons where `status == "active"`.

- **`GET /salons`** — returns a list of active salons: `id`, `slug`, `name`, `category`, `city`, `template_settings` (for cover image/brand color on the card). Used by the homepage grid.
- **`GET /salons/{slug}`** — returns one active salon's full public page payload: the salon's own fields, plus nested `services` (all fields), `staff` (all fields), `gallery` (all `gallery_items`), and `content` (all `content_blocks` as a `{key: value}` map for easy template access). Returns 404 if the slug doesn't exist or the salon isn't active — never a 500, never distinguishing "doesn't exist" from "suspended" in the response (consistent with the tenant-isolation "don't leak existence" pattern already used elsewhere in the backend).

Both endpoints are read-only aggregations over existing models — no new tables, no new migrations. Response schemas live in `app/schemas/public.py`.

## Frontend: Next.js Application

New `frontend/` directory at the repo root, sibling to `backend/`. Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion — matching the tech stack decided in the original platform-wide design spec.

```
frontend/
  app/
    layout.tsx                  # root layout: fonts, nav, footer, metadata
    page.tsx                    # homepage
    globals.css                 # Tailwind base + brand tokens
    salons/
      [slug]/
        page.tsx                # salon public page
        not-found.tsx           # custom 404 for unknown/inactive slugs
  components/
    SalonCard.tsx                # homepage grid item (cover, name, category, city)
    SalonHero.tsx                 # salon page hero section
    ServiceList.tsx                # services grouped by category, price/duration
    StaffList.tsx                   # staff cards, omitted entirely if salon has no staff
    GalleryGrid.tsx                  # photo grid
    AboutContact.tsx                  # about_us / contact_info content blocks
    SearchBar.tsx                      # homepage city/name filter input
  lib/
    api.ts                        # typed fetch wrapper: getSalons(), getSalonBySlug(slug)
    types.ts                        # TypeScript types mirroring the backend's public schemas
  .env.local.example               # NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Data flow

Both `app/page.tsx` and `app/salons/[slug]/page.tsx` are React Server Components that call `lib/api.ts` functions directly (server-side `fetch` against the FastAPI backend at `NEXT_PUBLIC_API_URL`) at request time — no client-side data fetching, no loading spinners needed for the initial render, and pages are fully server-rendered for SEO as specified in the original design. `app/salons/[slug]/page.tsx` calls `notFound()` (rendering `not-found.tsx`) when the API returns 404.

### Homepage (`/`)

Hero banner with Ceylon Bellezza branding and tagline, a `SearchBar` that filters the already-fetched salon list client-side by city or name (no extra network round trip — the full active-salon list is small enough to filter in the browser), and a responsive grid of `SalonCard`s below. Framer Motion: staggered fade-in for the grid on load, hover lift/shadow on each card. Empty state (no salons yet) renders a friendly placeholder message instead of an empty grid.

### Salon page (`/salons/[slug]`)

- **Hero**: cover image (from `template_settings`), salon name, category badge, city.
- **Services**: grouped by `category`, each row showing name, price, duration.
- **Staff**: cards with photo/bio; the whole section is omitted if the salon has zero staff.
- **Gallery**: responsive photo grid from `gallery_items`.
- **About/Contact**: renders `content.about_us` and `content.contact_info` if present; sections omitted if the corresponding key is missing.
- **Book Appointment button**: visible but disabled, with a "Coming soon" tooltip — the booking flow itself is Plan 4b.

## Demo Data

Two salons seeded once via the existing authenticated backend APIs (not application runtime code — a one-off setup step, e.g. a short script or manual API calls during implementation):

1. A unisex salon with a mixed service menu (haircuts, coloring, styling), 2 staff members, several gallery photos.
2. A men's grooming-focused salon (haircuts, beard trims, shaves), 1-2 staff members, a few gallery photos.

Both use external placeholder image URLs (e.g. stock photography URLs) for cover/gallery images.

## Testing

- **Backend**: pytest cases for the two new public endpoints — `GET /salons` returns only `active` salons (a `suspended` salon is excluded); `GET /salons/{slug}` returns the full nested payload for an active salon and 404s for both a nonexistent slug and a suspended salon's slug.
- **Frontend**: primarily verified manually via the browser preview, given this is a visual/UI-heavy plan. A small number of basic rendering smoke tests (e.g. homepage renders salon cards from a mocked API response, salon page renders services) may be added if they fit naturally during implementation, but full frontend test coverage is not a goal of this plan.

## Error Handling

- Public endpoints never 500 on a bad/missing slug — always a clean 404.
- A suspended salon behaves identically to a nonexistent one from the public API's perspective (404), so the frontend's `not-found.tsx` handles both cases uniformly.
- If the backend is unreachable when a page is requested, Next.js's default server-error handling applies (out of scope to build custom retry/fallback UI for this plan).
