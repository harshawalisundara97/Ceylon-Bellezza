# Salon Admin Dashboard — Design Spec

**Goal:** Give salon owners a working UI to manage their own salon's data — services, staff, gallery photos, and about/contact content — by building a `/admin/*` section into the existing `frontend/` Next.js app. The backend already has full CRUD APIs for all of this (built in earlier plans); today there is zero frontend for it. This is the first of two admin surfaces — a follow-up spec will cover the **Platform Admin Dashboard** (salon onboarding, module toggles, status changes), which is out of scope here.

**Non-goals:**
- No changes to the backend. Every endpoint this spec uses already exists and is already tested (`backend/tests/test_services.py`, `test_staff.py`, `test_gallery.py`, `test_content.py`, `test_auth.py`).
- No salon profile editing (name/address/category) — no such endpoint exists for salon admins; only platform admins can create/modify salon records. Out of scope.
- No image upload — `image_url`/`photo_url` fields are plain text/URL inputs, matching what the backend stores (a URL string, not a file).
- No new npm dependencies — plain `useState` + `fetch`, matching the existing app's approach (see `frontend/package.json`: only `next`, `react`, `framer-motion`).
- No password reset / "forgot password" flow — not supported by the backend.

## Architecture

All new code lives under `frontend/app/admin/` and `frontend/lib/`, as **Client Components** (`"use client"`). This is a departure from the rest of the app (which uses Server Components fetching the public API at render time) because admin pages need `localStorage` access, client-side auth state, and interactive forms.

### New files

```
frontend/
  lib/
    adminAuth.ts       # saveToken/getToken/clearToken (localStorage wrapper)
    adminApi.ts         # fetch wrapper: attaches Authorization header, throws AdminApiError on non-2xx,
                          # a 401 response clears the token (caller redirects)
  app/
    admin/
      layout.tsx           # auth guard + sidebar shell for all routes below except login
      login/
        page.tsx              # email/password form -> POST /auth/salon-admin/login
      page.tsx                  # dashboard home: static welcome + 4 section links
      services/
        page.tsx                  # list + inline add/edit/delete
      staff/
        page.tsx                  # list + inline add/edit/delete
      gallery/
        page.tsx                  # grid + add/delete (no edit — backend has no update endpoint)
      content/
        page.tsx                  # fixed two-field form: about_us, contact_info
```

### Auth flow

1. `/admin/login` posts `{ email, password }` to `POST /auth/salon-admin/login`. On success, `adminAuth.saveToken(access_token)` stores the JWT in `localStorage` under a single key (`cb_admin_token`), then redirects to `/admin`.
2. `frontend/app/admin/layout.tsx` runs on every `/admin/*` route. On mount, it checks `adminAuth.getToken()`; if absent, it redirects to `/admin/login` before rendering children. (`/admin/login` itself renders outside this guard — it's a sibling route, not nested under the guarded layout, so there's no redirect loop.)
3. Every `adminApi.ts` call attaches `Authorization: Bearer <token>`. On a `401` response (missing, invalid, or expired token — the backend doesn't distinguish), the wrapper calls `adminAuth.clearToken()` and the calling page redirects to `/admin/login`. This is the single expiry-handling path; there is no token refresh (backend issues no refresh tokens).
4. Logout is a sidebar button that calls `adminAuth.clearToken()` and redirects to `/admin/login` — no backend call, since no logout endpoint exists.

### Data flow

Every admin page follows the same shape:
1. On mount, `useEffect` calls the relevant `adminApi` list function, sets local `useState` array.
2. Create/update: local form state, submit calls `adminApi`, on success re-fetches (or optimistically updates) the list, clears the form.
3. Delete: confirm inline (a "Delete? [Confirm] [Cancel]" toggle on the row, not a `window.confirm` — consistent, testable, no browser-native dialog), calls `adminApi`, removes from local state on success.
4. Errors from any `adminApi` call (validation errors, 500s) render as an inline red text message near the form — no toast library.

## Pages

**`/admin/login`** — centered card, two inputs (email, password), submit button, inline error text on 401 ("Invalid email or password").

**`/admin/page.tsx` (dashboard home)** — static welcome heading + a 2x2 grid of links to Services / Staff / Gallery / Content. No salon-identifying data shown (see Non-goals — no endpoint exists to fetch the admin's own salon name).

**`/admin/services`** — table (Name, Category, Price, Duration, actions). "Add service" button reveals a form (Name, Category, Description, Price, Duration Minutes) above the table. Edit reuses the same form, pre-filled, inline above the row being edited or at the top — pre-filled at the top for simplicity (avoids row-inline layout shifts in a table).

**`/admin/staff`** — card grid (photo thumbnail, name, bio, actions), matching the data shape of the public `StaffList`. Add/edit form: Name, Photo URL, Bio.

**`/admin/gallery`** — image grid (thumbnail + caption + delete). Add form: Image URL, Caption. No edit (backend limitation — delete and re-add to change).

**`/admin/content`** — single form, two labeled textareas ("About Us", "Contact Info"), pre-filled from `GET /dashboard/content` (matched by `key`), each with its own Save button (independent upserts, since the backend's `PUT /dashboard/content/{key}` is per-key).

## Visual style

Utilitarian dashboard look, not the public site's "Elegant Boutique" treatment: a left sidebar (nav links + logout), `font-sans` throughout (no `font-serif`), data in tables/grids rather than photo-hero layouts. Reuses the existing color tokens for brand consistency — `bg-ivory` page background, `text-ink` body text, `text-taupe` secondary text, `terracotta` for primary buttons/links/focus rings, `hairline` for table/card borders. No new Tailwind tokens needed; Task 1 of the prior redesign plan already added everything this spec uses.

## Error handling

- **401 (not authenticated / expired):** handled centrally in `adminApi.ts` — clear token, redirect to login. Pages don't handle this case individually.
- **400/409/422 (validation, e.g. duplicate handled elsewhere, malformed payload):** inline error text near the form, form stays populated so the user can fix and resubmit.
- **404 (e.g. deleting an already-deleted row):** inline error, and the page re-fetches the list to reconcile local state.
- **Network/500 errors:** generic inline "Something went wrong — try again" message.

## Testing

This app has no automated frontend test suite by design (established in the original marketplace frontend spec). Verification is manual, same convention as prior plans:
1. Run backend (`uvicorn`) + frontend (`next dev`) against the already-seeded demo data.
2. Log in as `owner@glamour.lk` / `glamour123` (seeded in `backend/scripts/seed_demo_data.py`).
3. For each of Services/Staff/Gallery/Content: create a row, confirm it appears; edit it (where supported), confirm the change; delete it, confirm removal — verified via `curl` against the API and/or browser screenshots.
4. Confirm an invalid login shows an inline error, and that visiting `/admin/services` directly without a token redirects to `/admin/login`.
5. Confirm logging in as `owner@gentsroom.lk` and viewing `/admin/services` shows only that salon's services, not Glamour's (tenant isolation — already enforced backend-side by `get_current_salon_admin`'s `salon_id` scoping, but worth a spot-check).

## Self-Review Notes

- **Spec coverage:** every backend salon-admin endpoint (services CRUD, staff CRUD, gallery create/list/delete, content upsert/list, salon-admin login) has a corresponding UI surface. Platform-admin endpoints (`create_salon`, `list_salons`, `toggle_modules`, `update_status`) and `platform-admin/login` are explicitly deferred to the follow-up Platform Admin Dashboard spec.
- **Placeholder scan:** no TBD/TODO remaining; the "no salon-name-on-dashboard" gap was resolved by explicit user decision (static welcome, no new endpoint) rather than left open.
- **Internal consistency:** gallery's lack of an edit UI matches the backend's lack of an update endpoint (`backend/app/routers/gallery.py` only has create/list/delete) — not an oversight.
- **Scope check:** single cohesive surface (one role, one app section), appropriately sized for one implementation plan.
