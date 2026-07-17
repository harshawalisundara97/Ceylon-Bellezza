# Platform Admin Dashboard — Design Spec

**Goal:** Give the platform operator (you) a working UI to onboard and manage salons — add a new salon (with its owner's login credentials), see all salons at a glance, toggle their enabled feature modules, and activate/suspend accounts — by building a `/platform/*` section into the existing `frontend/` Next.js app. The backend already has full CRUD-ish APIs for this (`backend/app/routers/salons.py`); today there is zero frontend for it. This is the second of two admin surfaces — the first, the Salon Admin Dashboard (`/admin/*`, for salon owners managing their own services/staff/gallery/content), was spec'd in [2026-07-16-salon-admin-dashboard-design.md](2026-07-16-salon-admin-dashboard-design.md) and follows the same conventions this spec reuses.

**Non-goals:**
- No changes to the backend. Every endpoint this spec uses already exists and is already tested (`backend/tests/test_salons.py`, `test_auth.py`).
- No salon deletion — no such endpoint exists (`suspended` status is the mechanism for taking a salon offline).
- No editing a salon's core fields (name/address/category/slug) after creation — no update endpoint exists for that; only `status` and `enabled_modules` are mutable post-creation.
- No new npm dependencies — plain `useState` + `fetch`, matching both the public app and the salon admin dashboard.
- No cross-dashboard navigation — `/admin/*` and `/platform/*` are separate, unrelated login flows for different roles; neither links to the other.

## Architecture

Same overall approach as the Salon Admin Dashboard: a new route group under `frontend/app/platform/`, Client Components, localStorage-held JWT, a `layout.tsx` auth guard.

### New files

```
frontend/
  lib/
    platformAuth.ts     # saveToken/getToken/clearToken, storage key "cb_platform_token"
                          # (distinct from admin's "cb_admin_token" — see Auth flow)
    platformApi.ts        # fetch wrapper: attaches Authorization header from platformAuth,
                            # throws PlatformApiError on non-2xx, 401 clears token
  app/
    platform/
      layout.tsx             # auth guard + simple nav (title + logout), all routes below except login
      login/
        page.tsx                 # email/password form -> POST /auth/platform-admin/login
      page.tsx                    # salon list + inline "Add Salon" form (the only real page — see Pages)
```

No dashboard-home/landing page distinct from the list — with a single resource type (salons), the list page *is* the dashboard, avoiding a pointless extra click-through.

### Auth flow

Identical pattern to the salon dashboard, with one important difference: **token isolation**. A browser could plausibly have both a salon-admin session and a platform-admin session open (you might manage your own demo salon *and* onboard salons in the same browser). Using separate localStorage keys (`cb_admin_token` vs `cb_platform_token`) and separate API wrapper modules (`adminApi.ts` vs `platformApi.ts`) means there's no risk of a platform token being sent to a `/dashboard/*` endpoint (which would 401 anyway, since `get_current_salon_admin` checks `role == "salon_admin"`) or vice versa — but keeping them structurally separate makes that guarantee obvious from the code rather than relying on the backend's role check as the only safety net.

1. `/platform/login` posts `{ email, password }` to `POST /auth/platform-admin/login`, stores the token via `platformAuth.saveToken`, redirects to `/platform`.
2. `frontend/app/platform/layout.tsx` guards all `/platform/*` routes except `/platform/login` (sibling route, same non-nested structure as the salon dashboard).
3. `platformApi.ts` attaches `Authorization: Bearer <token>`; on 401, clears the token and the calling page redirects to `/platform/login`.
4. Logout clears the token client-side only (no backend logout endpoint).

### Data flow

`/platform` (the salon list page) on mount:
1. `GET /admin/salons` → list of `SalonRead` (id, slug, name, category, address, city, lat/lng, status, enabled_modules, template_settings).
2. Renders as a table: Name, Slug, City, Category, Status (badge), Modules (which of gallery/booking/contact_form are on, as small pills).
3. Each row expands into an inline panel (click the row) with two independent controls:
   - **Status**: a select/toggle (`active` / `suspended`) → `PATCH /admin/salons/{id}/status`, updates that row's local state on success.
   - **Modules**: three checkboxes (gallery, booking, contact_form) → `PATCH /admin/salons/{id}/modules` (the endpoint takes all three as one payload, so toggling any checkbox sends the full current set, not a single-field patch).
4. An "Add Salon" form sits above the table (same inline-form pattern as the salon dashboard's Services/Staff pages, not a separate route) — fields: slug, name, category, address, city, latitude (optional), longitude (optional), admin_email, admin_password. Submits to `POST /admin/salons`. On success, prepends the new salon to the local list and clears the form.

## Error handling

- **401**: centrally handled in `platformApi.ts` — clear token, redirect to `/platform/login`.
- **409 (duplicate slug or admin_email)**: inline error on the Add Salon form — "Slug or email already in use" (matches the backend's actual conflict condition per `create_salon`'s atomic check).
- **422 (validation, e.g. missing required field)**: inline error, form stays populated.
- **Network/500**: generic inline "Something went wrong — try again."

## Testing

Manual verification, same convention as the salon dashboard spec:
1. Run backend + frontend against the seeded data.
2. Log in at `/platform/login` as `admin@ceylonbellezza.com` / `admin123` (seeded in `backend/scripts/seed_demo_data.py`).
3. Confirm the two seeded salons (`glamour-lk`, `the-gents-room`) plus any others already in the dev database appear in the list with correct status/modules.
4. Create a new test salon via the Add Salon form; confirm it appears in the list, and that its owner can then log in at `/admin/login` with the credentials just entered.
5. Toggle a module off/on for a salon; confirm the change persists across a page reload (re-fetch shows the new state, not just local optimistic state).
6. Suspend a salon; confirm it disappears from the public homepage's salon directory (the public `/salons` endpoint filters by active status) while still appearing in the platform list.
7. Confirm visiting `/platform` directly without a token redirects to `/platform/login`, and that a platform token doesn't grant access to `/admin/*` (different role, different storage key).

## Self-Review Notes

- **Spec coverage**: all four platform-admin endpoints (`create_salon`, `list_salons`, `toggle_modules`, `update_status`) plus `platform-admin/login` have a corresponding UI control. No platform-admin endpoint is left unaddressed.
- **Placeholder scan**: no TBD/TODO; the "why two separate token keys" question is answered explicitly rather than left implicit.
- **Internal consistency**: the module-toggle UI sends the full three-field payload on every change because that's what `ModuleToggleRequest` requires (all three fields, not partial) — matches the backend contract, not an oversight.
- **Scope check**: single resource (salons), two mutable fields (status, modules) plus create — appropriately sized for one implementation plan, consistent in scope with the salon dashboard spec it mirrors.
