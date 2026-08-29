# CeylonBellezza Redesign Roadmap — Full Brand + UI/UX Rebuild

## Context

A high-fidelity design handoff (`design_handoff_ceylonbellezza_ui/`, built with Claude Design) specifies a complete rebrand: a new palette (forest `#0E3B32` / emerald `#14574A` / champagne `#C9A34E` / cream/sand neutrals, replacing Phase 0's teal `#0f9b8e` system), new typography (Cormorant Garamond display + DM Sans body, replacing Playfair Display), and 14 high-fidelity screens across the customer-facing site and the salon-owner dashboard. The user wants the whole site rebuilt to match, not just the landing page the attached instruction snippet named.

This supersedes the visual direction of Phase 0 (`docs/superpowers/plans/2026-08-04-design-system-motion-foundation.md`) — that phase's tokens/primitives get replaced, not extended. It also **absorbs and supersedes** the in-flight, not-yet-implemented `feature/admin-sidebar-payments-booking` plan (spec written, code not started) — the mockup's Owner Dashboard screens (O1 Dashboard, O2 Calendar, O5 Payments & Reports) cover that same ground (sidebar, New Booking, Payments) in much richer, final-fidelity form. That branch's spec is not wasted — it correctly identified the real gaps (no paid status, no manual booking creation) — but the UI it specified should not be built twice; the mockup's version supersedes it.

## Fidelity note from the handoff

Per the design README: this is a high-fidelity reference to rebuild pixel-close using our existing component primitives, not HTML to copy. Photography is all placeholder (`<image-slot>`) — real salon photos are a separate, later concern. Icons are Lucide-style — use the real `lucide-react` icon set in implementation (a new, small dependency; matches the mockup's explicit instruction to use real Lucide icons, not hand-rolled SVGs).

## What's genuinely new vs. a restyle of something that exists

This matters for sequencing and honesty about scope — several screens are **not just a redesign**, they require backend capabilities that don't exist yet:

| Screen | Maps to | Backend gap |
|---|---|---|
| Landing (desktop+mobile) | `frontend/app/page.tsx` (exists) | None — pure restyle |
| Search results | Net new page | None — can build from existing `GET /salons`, client or server filtered |
| Salon profile | `frontend/app/salons/[slug]/page.tsx` (exists) | Reviews/ratings don't exist (mockup shows star ratings, review counts) |
| Booking flow (4-step wizard) | Today: single inline `BookingForm` | Multi-step UX rework; stylist-availability-aware slot computation doesn't exist (Phase 1 of the bookings-calendar work explicitly deferred this) |
| Confirmation screen | Today: inline success state in `BookingForm` | None functionally, but SMS confirmation shown in mockup — no SMS infra exists |
| Customer account (Upcoming/Past/Favourites) | Nothing exists | **Full dependency on Customer Accounts + Favorites**, which are Phases 4–5 of the existing full-site-roadmap and are NOT built |
| States (empty/loading/error) | Cross-cutting | None — pure UI patterns |
| O1 Dashboard (KPIs, drag-reschedule chairs view) | `frontend/app/admin/bookings/` (exists, day-view only) | KPI aggregates (revenue today, utilization %, no-shows) don't exist; drag-to-reschedule doesn't exist |
| O2 Calendar (week view + drawer) | Same | Week view was explicitly out of scope in the bookings-calendar plan (day-view only, by design) |
| O3 Services & pricing | `frontend/app/admin/services/` (exists) | Mostly restyle; "assigned staff count," "monthly bookings," live/hidden toggle need small backend additions |
| O4 Team & rosters | `frontend/app/admin/staff/` + Working Hours tab (exists) | Commission %, targets, time-off requests are net-new data concepts `StaffAvailability` doesn't cover |
| O5 Payments & reports | Nothing exists (the paused sidebar-payments-booking plan covered a simple version) | Revenue aggregates by month/service/channel, PayHere payment-channel tracking — real reporting infrastructure |
| O6 Owner on the floor (mobile, walk-in) | Nothing exists | A "waiting" queue state and fast walk-in booking creation — new concept |

## Recommended phasing

Same lesson as Phase 0 of the previous redesign: **tokens and one real page first**, so every later screen builds on real primitives instead of ad hoc styles, and so there's a working, shippable checkpoint early rather than a big-bang rewrite.

### Phase 1 — Design tokens + Landing page (start here, matches the literal instruction given)

- Replace `frontend/app/globals.css` / `frontend/tailwind.config.ts` tokens: forest/emerald/champagne/cream/sand palette, radii (12/16/20/22–24/28/999px pills), shadows (sm/md/lg per the README's exact values), spacing rhythm.
- Add Cormorant Garamond + DM Sans via `next/font/google` (same mechanism Playfair Display already uses), replacing the serif font stack.
- Add `lucide-react` as a new dependency (the one deliberate exception to Phase 0's "no new dependencies" convention — the mockup explicitly calls for real Lucide icons).
- Rebuild `frontend/app/page.tsx` (desktop hero + overlapping search card + featured salons grid + footer) and its mobile layout, using the new tokens and existing/extended `components/ui/*` primitives — not copying the HTML board's markup, matching the handoff's own instruction.
- Retrofit shared primitives (`Button`, `Card`, `Badge`, etc.) onto the new tokens where the landing page uses them, same "cheap, additive retrofit" pattern as Phase 0's Tasks 6–9 — full retrofit of every other page is later phases, not this one.

### Phase 2 — Search results page + Salon profile restyle

Net-new search results page (service/location/date query params, filter sidebar, result cards) plus restyling the existing salon detail page to match (tabs, service list table, staff section). No new backend needed for search; reviews/ratings display is stubbed or deferred depending on whether Phase 6-equivalent (reviews) has landed by then.

### Phase 3 — Booking flow wizard + Confirmation screen

Rework the single-page `BookingForm` into the mockup's 4-step wizard (service → stylist → date/time → confirm). This is a genuine UX rebuild, not a restyle — worth its own brainstorm on how much of the "availability-aware slot computation" (no-slots error state, alternative suggestions) is in scope now vs. deferred, since that depends on `StaffAvailability` data being reliably populated.

### Phase 4 — Owner Dashboard: O1 Dashboard + O3 Services + O4 Team restyle

Restyle the three owner-dashboard screens that map to existing pages, plus the KPI cards on O1 (revenue-today/utilization/no-shows aggregates are new small queries, not a subsystem). This is also where the sidebar gets its final redesigned look (forest sidebar, salon switcher, badge counts) — superseding the paused sidebar-payments-booking plan's simpler version.

### Phase 5 — Owner Dashboard: O2 Week Calendar + O5 Payments & Reports

The two genuinely new subsystems on the owner side: real week-view calendar with drag-reschedule, and real revenue reporting (monthly chart, payment-channel breakdown, top services). Sequenced after Phase 4 since both extend that phase's dashboard shell.

### Phase 6 — Customer Accounts + Customer Account screen + Favourites

This screen is fully blocked on Customer Accounts (Phase 4) and Favorites (Phase 5) from the existing `docs/superpowers/plans/full-site roadmap` — build those first, then this screen becomes straightforward.

### Phase 7 — O6 Owner on the floor (mobile walk-in) + polish states

Walk-in flow and the empty/loading/error state patterns applied consistently across every screen built so far — sequenced last since it's the most novel concept (a live "waiting" state) and benefits from every other screen's patterns already existing to reuse.

## What this roadmap does not decide

Each phase still needs its own brainstorm before code — this stays at the "what and why and in what order" level. In particular: Phase 3's exact wizard-vs-availability scope, Phase 5's exact revenue-aggregate SQL, and Phase 6's dependency on the still-unbuilt customer-accounts phases all need their own design pass when picked up.

## Suggested Next Action

**Start Phase 1** — design tokens + landing page. It's what was literally instructed, it's the same low-risk, high-leverage starting point Phase 0 used last time, and every later phase depends on the new tokens existing first.
