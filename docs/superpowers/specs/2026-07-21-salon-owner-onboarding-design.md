# Salon Owner Onboarding — Design Spec

**Goal:** Let a prospective salon owner submit interest through a public form, let the platform admin review and approve that lead from the Platform Admin Dashboard, and automatically create their salon-admin account and email them a login link with a temporary password — closing the loop between "someone wants to join" and "they can log in and manage their salon." This is Phase 2 of the platform's [enhancement roadmap](../plans/2026-07-21-full-enhancement-roadmap.md).

**Non-goals:**
- No customer-facing role-picker landing page. Customers keep browsing the homepage directly as they do today; a "List Your Salon" link is the only new entry point.
- No magic-link/passwordless login. The invite email contains a temporary password; login still goes through the existing `/admin/login` email+password form.
- No lead-form collection of salon business details (slug, name, category, address). The public form only captures what the requester described: contact name, phone, email, and a free-text message. The admin supplies salon details at approval time, same as they do today via the Add Salon form.
- No lead editing or re-opening a rejected lead — reject is a terminal, one-way action (matches the existing "no salon deletion, only suspend" pattern for how this system treats irreversible-ish actions).
- No changes to the existing `POST /admin/salons` endpoint or the Salon Admin Dashboard — this spec only adds new endpoints/pages alongside them.

## Architecture

Three new pieces, following the exact conventions already established in this codebase:

1. **Backend**: a `SalonLead` model + public submission endpoint + platform-admin list/approve/reject endpoints, following the same router/schema/tenant-scoping patterns as `backend/app/routers/salons.py`.
2. **Email**: a small `backend/app/email.py` module wrapping the Resend API, called once from the approve endpoint. No queue, no retries — a synchronous send during the approve request, matching this codebase's existing preference for simple synchronous calls (e.g. `geocode_address` is called synchronously during salon creation today).
3. **Frontend**: a new public `/join` page (lead submission form) and a new `/platform/leads` page (list + approve/reject), plus a small link from the homepage to `/join`.

### Backend: `SalonLead` model

```python
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

New Alembic migration, following the same pattern as the recent `add gender to bookings` migration.

### Endpoints

- `POST /leads` (public, no auth) — body `{contact_name, contact_phone, contact_email, message}`, creates a `SalonLead` with `status="pending"`, returns 201. No validation beyond Pydantic's field presence — this is a public marketing form, not a security boundary.
- `GET /admin/leads` (platform-admin only) — list all leads, newest first, matching `list_salons`'s pattern (`dependencies=[Depends(get_current_platform_admin)]` on the router).
- `PATCH /admin/leads/{id}/status` (platform-admin only) — body `{status: "rejected"}` only (approval has its own endpoint below, since it needs more data and side effects than a plain status flip).
- `POST /admin/leads/{id}/approve` (platform-admin only) — body is the same salon-creation fields as `SalonCreateRequest` *minus* `admin_email`/`admin_password`: `{slug, name, category, address, city, latitude?, longitude?}`. Behavior:
  1. Look up the lead; 404 if missing, 409 if `status != "pending"` (can't approve twice or approve a rejected lead).
  2. Generate a random 16-character temporary password (`secrets.token_urlsafe(12)` — stdlib, no new dependency).
  3. Reuse the exact `create_salon` logic (geocode if lat/lng missing, create `Salon` + `SalonAdmin` with `admin_email = lead.contact_email` and the generated password, same atomic two-step commit/rollback-on-409 pattern).
  4. Set `lead.status = "approved"`.
  5. Call `send_owner_invite(lead.contact_email, temp_password, salon.name)`.
  6. Return the created `SalonRead`.

  If email sending fails (network error, bad API key), the salon account still gets created (steps 1-4 already committed) — the response includes a warning field so the admin knows to manually share credentials. This is a deliberate choice: failing to send an email shouldn't silently roll back a real database record, and the admin dashboard already displays the salon in the list either way, so nothing is lost — worst case, the admin manually reads the salon's login email off the lead's `contact_email` field and resets the password via a follow-up action (not in this spec's scope; today, a failed-email salon owner would need you to manually communicate credentials, matching how you already can for any salon you create directly).

### Email module

```python
# backend/app/email.py
import resend
from app.config import settings

def send_owner_invite(to_email: str, temp_password: str, salon_name: str) -> bool:
    """Returns True if sent, False if skipped/failed (never raises)."""
    if not settings.resend_api_key:
        print(f"[email skipped: no RESEND_API_KEY] Would invite {to_email} to manage {salon_name}")
        return False
    resend.api_key = settings.resend_api_key
    try:
        resend.Emails.send({
            "from": "Ceylon Bellezza <onboarding@resend.dev>",  # placeholder sender until a custom domain is verified
            "to": to_email,
            "subject": f"You're set up to manage {salon_name} on Ceylon Bellezza",
            "html": f"<p>Log in at <a href='{settings.frontend_url}/admin/login'>{settings.frontend_url}/admin/login</a></p>"
                    f"<p>Email: {to_email}<br>Temporary password: <strong>{temp_password}</strong></p>"
                    f"<p>Please log in and note your credentials safely.</p>",
        })
        return True
    except Exception:
        return False
```

New `Settings` fields: `resend_api_key: str = ""`, `frontend_url: str = "http://localhost:3000"` (needed to build the login link — nothing in the codebase currently knows its own frontend origin, since CORS config hardcodes it inline in `main.py` rather than reading from settings; this spec adds the setting rather than touching the existing CORS line, to keep this change additive).

New dependency: `resend` (official Python SDK) added to `backend/requirements.txt`.

### Frontend

- `frontend/app/join/page.tsx` — public page, plain form (name, phone, email, message textarea), `POST /leads` via a new `createLead` function in `frontend/lib/api.ts` (same public-fetch pattern as `createBooking`). Success state shows a thank-you message, matching `BookingForm.tsx`'s existing success-state pattern.
- Homepage (`frontend/app/page.tsx`): a small `<Link href="/join">List Your Salon</Link>` — exact placement is an implementation-time call (near the hero or in a footer, depending on what's built by then), not a spec-level decision.
- `frontend/app/platform/leads/page.tsx` — new page under the existing `/platform/*` guarded layout (reuses `platformFetch`/`PlatformApiError`/`platformAuth` from the Platform Admin Dashboard as-is, no changes there). Lists leads (contact info, message, status). Each pending lead has a "Review" action that expands an inline approve form (the same salon fields as the Platform Admin Dashboard's Add Salon form, minus owner email/password) plus a "Reject" button. Approved/rejected leads show their status, no actions.
- `frontend/app/platform/layout.tsx` nav gets a "Leads" link alongside the existing salon list (that layout currently has no nav links at all beyond the header title — this spec adds the first one, structured so a future nav item slots in the same way).

## Error Handling

- `POST /leads`: 422 on missing required fields (Pydantic default). No rate-limiting or spam protection in this spec (noted as a known gap, not blocking — this is a low-traffic admin-reviewed form, not open self-signup).
- `POST /admin/leads/{id}/approve`: 404 unknown lead, 409 already-processed lead, 409 duplicate slug/email (same as `create_salon` today). Frontend shows these inline exactly as the existing Add Salon form does.
- Email failure: never raises, returns `False`; the approve endpoint's response includes `email_sent: bool` so the frontend can show "Salon created — invite email failed to send, share credentials manually" as a one-time inline warning (the temporary password is included in that same response so the admin can copy it out, since it's otherwise never stored in retrievable form — matching how `admin_password` is never returned by `create_salon` today either, except this is the one case where the admin needs a fallback since the password wasn't theirs to remember).

## Testing

- Backend: new `backend/tests/test_leads.py` — lead creation, list (platform-admin only, 401 for salon-admin tokens matching the existing `test_create_salon_rejects_salon_admin_token` pattern), approve (success creates salon+admin, double-approve 409, reject-then-approve 409), reject. Email sending is mocked in tests (`unittest.mock.patch` on `send_owner_invite`, following the same `patch("app.routers.salons.geocode_address", ...)` pattern already used in `test_salons.py`) so tests never make real network calls or need a real API key.
- Frontend: no automated tests by design (established convention) — manual verification: submit the `/join` form, confirm the lead appears in `/platform/leads`, approve it with salon details, confirm the salon appears in `/platform` (existing salon list) and its owner can log in at `/admin/login` with the emailed (or, without a configured Resend key, console-logged) temporary password.

## Self-Review Notes

- **Spec coverage**: public lead submission, admin lead list, reject, approve-with-auto-generated-password-and-email all covered. The three deferred pieces from brainstorming (role-picker landing page, lead-form salon details, magic-link auth) are explicitly listed as non-goals with the reasoning from the conversation, not silently dropped.
- **Placeholder scan**: no TBD/TODO. The "from" email address (`onboarding@resend.dev`) is Resend's own sandbox sender, usable without domain verification — flagged as a placeholder pending a real custom domain, not a functional gap.
- **Internal consistency**: the approve endpoint reuses `create_salon`'s exact atomic-commit/409 pattern rather than inventing a new one; email failure handling is designed not to roll back a successful salon creation, consistent with treating the database as the source of truth over the email side-effect.
- **Scope check**: one cohesive flow (lead → approval → account → email), appropriately sized for one implementation plan.
