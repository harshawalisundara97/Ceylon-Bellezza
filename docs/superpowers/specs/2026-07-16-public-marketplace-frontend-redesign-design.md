# Ceylon Bellezza — Public Marketplace Frontend Redesign ("Elegant Boutique") Design

**Status**: Approved
**Date**: 2026-07-16
**Scope**: Visual/UX restyle of the existing public marketplace frontend (Plan 4a: homepage + salon detail page). No new features, no data model changes, no new dependencies — a styling and markup pass over the components that already exist.

## Product Context

Plan 4a (merged) built the first real public website for Ceylon Bellezza: a homepage with a searchable salon directory grid, and per-salon detail pages with services/staff/gallery/about-contact. It works, but visually it's generic default-Tailwind styling (flat gold/gray palette, system sans-serif everywhere, plain white cards). This redesign gives it a distinctive "elegant boutique" identity — warm, premium, salon/spa-appropriate — without touching data fetching, routing, or component boundaries.

## Design Direction

Chosen from three options presented visually during brainstorming (Elegant Boutique over Bold Editorial and Soft Contemporary), with a full-bleed photo hero (over text-only or split) for both the homepage and the salon detail page.

### Palette & Typography

- **Background**: warm ivory `#faf6f0` (page background), white `#ffffff` (card surfaces)
- **Ink**: near-black warm gray `#2b241d` (headings, primary text), taupe `#8a7c6c` (secondary/meta text)
- **Accent**: terracotta `#a6784f` (category badges, price text, links, search-bar focus ring, section dividers) — replaces the current `brand`/`brand-dark` gold tokens in `tailwind.config.ts`
- **Borders**: hairline `#e8ddd0` on card outlines and dividers, replacing harder gray borders/shadows
- **Typography**: a serif display font (Playfair Display via `next/font/google`) for salon names, page headings, and section titles; the existing system sans-serif stack stays for body copy and UI chrome (buttons, labels, nav, search input) — the pairing is what signals "boutique" rather than a generic template
- These become new Tailwind theme tokens (`colors.ivory`, `colors.ink`, `colors.taupe`, `colors.terracotta`, `colors.hairline`, `fontFamily.serif`) rather than one-off inline styles, so every component pulls from the same palette

### Homepage (`/`)

- **Hero**: full-bleed salon interior photo (Unsplash stock, matching the existing seed-data image sourcing pattern) with a dark gradient overlay (`rgba(20,15,10,0.15)` to `rgba(20,15,10,0.55)`, top to bottom) for text contrast. Centered content: small letter-spaced "Ceylon Bellezza" label, serif headline, sans subtext.
- **Search bar**: pill-shaped, white background, positioned to visually overlap the bottom edge of the hero (floats between hero and grid) — this becomes part of `SearchBar.tsx`'s container styling, not a new component.
- **Salon grid**: cards restyled — white surface, hairline border instead of the current shadow-only treatment, terracotta pill category badge, serif salon name. Hover state adds a subtle image zoom (`scale-105` on the cover image) in addition to the existing lift/shadow animation.
- **Empty state**: same copy/logic as today (Plan 4a), restyled to match — centered, taupe text, no visual overhaul needed since there's no content to style.

### Salon Detail Page (`/salons/[slug]`)

- **Hero**: same full-bleed treatment as the homepage hero, using the salon's own cover image (`template_settings.hero_image` with the existing Unsplash fallback) — centered serif salon name, category badge, city, and the "Book Appointment" button.
- **Book Appointment button**: restyled as a terracotta-outlined pill (still `disabled`, still `title="Coming soon"`) — visually distinct from a real CTA without looking broken or grayed-out-by-accident.
- **Services**: unchanged grouping-by-category logic; category labels become small-caps serif with a thin terracotta underline/divider instead of the current plain gray hairline; prices stay right-aligned in terracotta.
- **Staff**: portrait photos become fully rounded (`rounded-full`, already close to this — confirm consistent sizing), names in serif.
- **Gallery**: grid gains slightly varied card heights for a masonry-ish feel within a plain CSS grid (using `grid-row-span` variation via a simple alternating pattern — no new grid library), rounded corners (`rounded-lg`).
- **About/Contact**: two-column layout on desktop (`md:grid-cols-2`), stacked on mobile (existing default); small serif section headers (`About Us`, `Contact`).
- **Not-found page**: light restyle to match the ivory/serif palette, no structural change.

### Motion

- Framer Motion is already a dependency (Plan 4a) — this redesign refines existing animations rather than adding new interaction patterns:
  - Grid stagger: slightly slower/softer (`staggerChildren` increased marginally from `0.05`)
  - Card hover: existing lift (`y: -4`) plus a new image `scale` transition on the cover photo
  - Hero text: a simple fade-up on mount (`opacity`/`y` transition), matching the calm, unhurried boutique tone
- No new animation libraries; no scroll-triggered or parallax effects (out of scope — keep it simple and performant)

### Responsive Behavior

No change to the existing breakpoint strategy (`sm:`/`lg:` grid columns already in place). The hero's overlapping search bar needs a mobile-specific adjustment: on small screens the search bar sits directly below the hero rather than overlapping it (overlap looks cramped on narrow viewports) — a straightforward Tailwind responsive utility change, not a new component.

## Technical Approach

- **No new dependencies.** Tailwind CSS and Framer Motion are already installed (Plan 4a scaffold); this is a config + markup + className pass.
- **New Google Font**: `Playfair Display`, loaded via `next/font/google` in `app/layout.tsx` and exposed as a CSS variable / Tailwind `fontFamily.serif` token (Next.js's built-in font optimization — no manual `<link>` tags, no layout shift).
- **`tailwind.config.ts`**: replace the `brand`/`brand-dark` color tokens with the ivory/ink/taupe/terracotta/hairline palette; add the serif `fontFamily` entry.
- **Component scope**: every component touched in Plan 4a's Tasks 4 and 5 gets restyled — `SalonCard`, `SearchBar`, `SalonDirectory`, `app/page.tsx`, `SalonHero`, `ServiceList`, `StaffList`, `GalleryGrid`, `AboutContact`, `app/salons/[slug]/page.tsx`, `app/salons/[slug]/not-found.tsx`, plus `app/globals.css` and `app/layout.tsx` for the font setup. **No component's props, data fetching, or Server/Client boundary changes** — `lib/api.ts` and `lib/types.ts` are untouched.
- **Images**: continue using the existing Unsplash-URL pattern from `backend/scripts/seed_demo_data.py` (no image upload pipeline — that's still out of scope per the original Plan 4a spec). If the full-bleed hero needs a better/more premium-feeling photo than what's currently seeded, update the seed script's URLs to more suitable Unsplash images as part of this work (cosmetic data change, not a schema change).

## Testing

- No automated visual regression tooling introduced (out of scope). Verification is manual via the browser preview: homepage hero/grid/search, salon detail page hero/services/staff/gallery/about-contact, empty state, 404 state, and a mobile viewport check for the hero/search-bar responsive behavior.
- Existing backend tests (`backend/tests/test_public.py`) are unaffected — this redesign touches only `frontend/`.

## Out of Scope

- Any change to data fetching, routing, or the public API (Task 1 of Plan 4a).
- Booking UI, image upload pipeline, Google Maps search (still deferred to "Plan 4b" per the original spec).
- Admin dashboard / super-admin panel UI (separate, unplanned work).
- New animation libraries, scroll effects, or a full design-system/component-library extraction — this stays a targeted restyle of existing components.
