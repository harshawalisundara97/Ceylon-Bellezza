# Redesign Phase 1: Design Tokens + Landing Page — Design Spec

**Goal:** Replace Phase 0's teal design system with the palette/typography specified in the Claude-Design mockup handoff, and rebuild the customer landing page (`frontend/app/page.tsx`, desktop + mobile) to match it — the first phase of the [CeylonBellezza redesign roadmap](../plans/2026-08-29-ceylonbellezza-redesign-roadmap.md).

**Non-goals:**
- No other pages retrofitted onto the new tokens this phase (admin/platform dashboards, salon detail) — they inherit new *colors* automatically (same token keys, new values) but keep their current layout/copy until their own later-phase retrofit.
- No search-results page, no working Location/Date search, no rating or next-available-slot data — all explicitly deferred (Phase 2+ or blocked on subsystems that don't exist: reviews, availability aggregation).
- No customer accounts — "Sign in", mobile "Bookings"/"Saved"/"Account" tabs are visually present but inert or link to `/admin/login`-adjacent stubs, not functional customer auth.
- No new backend subsystem beyond one additive field on the existing salon-list endpoint.

## Architecture

Five pieces: tokens, fonts, a new icon dependency, two new shared components (Header/Footer), and a rebuild of the existing landing-page component tree — plus one small backend addition.

### 1. Design tokens (`frontend/app/globals.css` + `frontend/tailwind.config.ts`)

Same mechanism as Phase 0 (CSS custom properties consumed by Tailwind), **same token key names, new hex values** — every page site-wide re-themes without code changes elsewhere:

```css
:root {
  --color-bg: #FBF8F3;        /* was #ffffff */
  --color-surface: #F7F3EB;    /* was #f7f8f7 */
  --color-ink: #1E2422;        /* was #1f2422 (near-identical, kept) */
  --color-taupe: #6B7570;      /* was #6b7570 (identical — kept) */
  --color-hairline: #EFE9DE;   /* was #e2e6e4 */
  --color-accent: #0E3B32;     /* was #0f9b8e — forest, was teal */
  --color-accent-light: #E8F0ED; /* was #cdeee9 */
  --color-danger: #A6412F;     /* was #dc2626 */
  --color-success: #2F7D5F;    /* NEW token — status text, next-slot-style copy */
  --color-champagne: #C9A34E;  /* NEW token — accent CTA, stars, highlights */
  --color-champagne-light: #F3E9D2; /* NEW token — badge/pending surfaces */
  --color-charcoal: #1E2422;   /* NEW token — footer bg, high-contrast text (same value as ink, distinct semantic name since footer needs a name-stable dark bg independent of future ink tuning) */

  --radius-sm: 0.75rem;   /* 12px — was 6px */
  --radius-md: 1rem;      /* 16px chip/tile — was 8px */
  --radius-lg: 1.25rem;   /* 20px card — was 12px */
  --radius-xl: 1.5rem;    /* 24px frame — was 16px */
  --radius-pill: 999px;   /* NEW token — buttons/inputs/tags/chips */

  --shadow-sm: 0 4px 14px rgba(30, 36, 34, 0.07);
  --shadow-md: 0 14px 34px rgba(30, 36, 34, 0.13);
  --shadow-lg: 0 22px 60px rgba(30, 36, 34, 0.16);
  --shadow-floating: 0 16px 44px rgba(30, 36, 34, 0.12); /* NEW token — the overlapping search card */
}
```

`tailwind.config.ts`'s `theme.extend` gains `champagne`/`champagne-light`/`charcoal`/`success` colors and a `pill` borderRadius key, alongside the existing color/radius/shadow keys repointed at the new variables. `fontFamily.serif` is repointed to the new display font (see below) rather than renamed, so existing `font-serif` usages across the whole app pick up the new typeface automatically.

### 2. Fonts (`frontend/app/layout.tsx`)

```tsx
import { Cormorant_Garamond, DM_Sans } from "next/font/google";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
  display: "swap",
});
```

`tailwind.config.ts`: `fontFamily.serif` → `["var(--font-display)", "Georgia", "serif"]` (replaces Playfair), `fontFamily.sans` → `["var(--font-body)", "system-ui", "sans-serif"]` (new — the app currently has no explicit sans override, falling back to Tailwind's default stack). `<html>` tag's `className` gains both font variables.

### 3. Icons

Add `lucide-react` to `frontend/package.json` — the one deliberate new dependency this phase, per the handoff's explicit instruction to use the real Lucide set rather than hand-rolled SVGs. Used for: search/map-pin/calendar/star/heart/menu icons in Header/SearchBarCard/SalonCard.

### 4. New components

**`frontend/components/Header.tsx`** (`"use client"`, since it needs `usePathname`-independent static nav — actually no client state needed, can be a server component): sticky top nav, cream background, bottom rule `border-hairline`. Brand mark (`Ceylon<span className="text-champagne">.lk</span>`, `font-serif` 25px/700), nav links "Salons" (→ `/`, functional), "Services" / "Offers" / "For business" (→ `/`, inert placeholders — no pages exist yet, kept as real `<Link>` elements per the approved design so nothing looks broken, just not yet meaningfully destination-specific), right side "List your salon" text link (→ `/join`, already exists and functional) + forest pill "Sign in" button (→ `/admin/login`, the closest existing login surface — there is no customer login yet, so this points at the salon-owner login as a placeholder destination, matching the "show it, link somewhere reasonable" approach).

**`frontend/components/Footer.tsx`**: charcoal background, brand + one-line description, three language pills (English active/opaque, Sinhala/Tamil at 50% opacity, all inert — no i18n exists), three link columns (Discover / For salons / Company — all links point at `/` as placeholders, same inert-but-visible approach as Header), bottom bar with copyright + "Payments by PayHere · Visa · Mastercard · eZ Cash" (static text, no real payment integration exists — this is copy only, matching the handoff's own framing that payment-provider mentions here are marketing copy, not functional badges).

### 5. Rebuilt landing-page tree

- **`frontend/app/page.tsx`**: adds `<Header />`/`<Footer />` around the existing `<Hero />`/`<SalonDirectory>` structure.
- **`frontend/components/Hero.tsx`**: restyled to the new spec (520px desktop / 300px mobile via responsive classes, 102°/vertical scrim gradient per breakpoint, radius-xl, champagne overline, `font-serif` 62px headline, DM Sans body at 82% opacity) — same `fadeInUp` motion entrance from `frontend/lib/motion.ts`, unchanged.
- **`frontend/components/SearchBarCard.tsx`** (new, replaces the current `SearchBar.tsx`'s role in `SalonDirectory`): the overlapping white card (`-mt-[58px]` desktop / `-mt-[26px]` mobile, radius-lg, `shadow-floating`). Desktop: 3 fields (Service/Location/Date) in a `1.3fr 1fr 1fr auto` grid with vertical dividers, champagne pill submit "Search salons". Mobile: full-width Service field, 2-up Location/Today row, full-width champagne "Search" button. Only the **Service** field is wired to real behavior — it drives the exact same client-side name/city substring filter `SalonDirectory` already implements (renamed conceptually, not behaviorally, from a generic search box to occupying the "Service" slot visually); Location and Date fields render but are inert (no location/date query capability exists yet — deferred to Phase 2's real search-results page per the roadmap). This is a conscious, temporary mismatch between visual promise and function, acceptable because Phase 2 is the very next roadmap phase and closes it.
- **`frontend/components/SalonDirectory.tsx`**: swap `SearchBar` for `SearchBarCard`, restyle the "Featured this week" heading + prev/next circle buttons (Lucide `ChevronLeft`/`ChevronRight`, prev outlined, next forest-filled) above the existing staggered grid — the prev/next buttons are decorative/inert this phase (the existing grid has no pagination or carousel state; clicking them does nothing yet, acceptable since the handoff's own interaction notes don't specify what they page through without a carousel data model that doesn't exist).
- **`frontend/components/SalonCard.tsx`**: restyled to the mockup's card (172px photo, emerald-100 category tag, `font-serif` 24px name, `MapPin` icon + city, top-ruled footer with "From Rs. {starting_price}" left, using the new `formatCurrency` helper below). Rating pill and "Next slot" text are omitted per the approved design (no backend data exists for either). The 36px heart icon renders but is inert (no favorites/customer-accounts subsystem exists yet — Phase 6 of the roadmap).
- **New `frontend/lib/format.ts`**: `formatCurrency(amount: number): string` → `"Rs. 3,500"` (thousands-separated, no decimals, non-breaking space per the locale rule) for reuse across this and future phases.

### 6. Backend

`backend/app/schemas/public.py`'s `PublicSalonSummary` gains `starting_price: float | None`. `backend/app/routers/public.py`'s `list_active_salons` computes it via a correlated subquery (`func.min(Service.price)` grouped by `salon_id`, left-joined so salons with zero services get `None`) rather than N+1 querying — one query for the list, same as today's single `db.query(Salon)...all()` call.

## Error Handling

No new error paths — this phase adds read-only display data and static UI. The `starting_price` field is nullable and the frontend renders "Price on request" (a static fallback string) when `null`, rather than hiding the footer row entirely, so the card layout never collapses.

## Testing

Backend: extend `backend/tests/test_public.py` (or the equivalent salon-list test file) with a case asserting `starting_price` reflects the cheapest of multiple services, and a case asserting `null` for a salon with zero services. Frontend: no automated tests, per this repo's established convention — manual verification: load `/` at desktop and mobile viewport widths, confirm the new palette/fonts/icons render correctly, confirm the Service field's existing filter behavior still works, confirm salon cards show "From Rs. X" or "Price on request" correctly, confirm `tsc --noEmit` and `npm run build` are clean.

## Self-Review Notes

- **Spec coverage**: tokens, fonts, icon dependency, Header/Footer, Hero/SearchBarCard/SalonCard rebuilds, and the backend `starting_price` field are all covered — matches every point from the approved design.
- **Placeholder scan**: no TBD/TODO. Every inert nav/tab item is explicitly named as inert with its reasoning, not left ambiguous.
- **Internal consistency**: the "Service field only, Location/Date inert" decision is stated once in the SearchBarCard section and not contradicted elsewhere; the roadmap's Phase 2 is referenced as where this gets closed, matching the roadmap doc's own phasing.
- **Scope check**: one cohesive phase (tokens + one real page), matching Phase 0's own precedent in size and shape — appropriately sized for one implementation plan.
