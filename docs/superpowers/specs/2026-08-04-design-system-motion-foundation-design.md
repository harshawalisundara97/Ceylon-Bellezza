# Design System & Motion Foundation — Design Spec

**Goal:** Bring Ceylon Bellezza's visual and interaction quality toward the level of Fresha.com and Mangomint.com — clean modern styling, a teal/mint accent, and lively, expressive micro-interactions — without touching backend behavior. This is Phase 0 of the [Fresha/Mangomint parity roadmap](../plans/2026-07-21-full-enhancement-roadmap.md#phase-0) and lands before any feature work so later phases build on real conventions instead of inventing them ad hoc.

**Non-goals:**
- No backend changes of any kind.
- No structural page rebuilds — this is a retrofit (swap tokens/primitives into existing pages), not a redesign of layout or information architecture.
- No new UI library dependency (no Radix/Headless UI/MUI) — new primitives are hand-rolled in the existing `components/ui/` style, consistent with how the codebase already avoids heavy UI frameworks.
- Typography is not changing — Playfair Display headings stay as a distinctive touch even under the cleaner palette.
- No dark mode — CSS custom properties are used for token hygiene and future flexibility, not to ship theming now.

## Architecture

Three additive layers, in dependency order:

1. **Design tokens** — CSS custom properties in `frontend/app/globals.css`, consumed by `frontend/tailwind.config.ts`.
2. **Motion conventions** — a new `frontend/lib/motion.ts` exporting typed duration/easing/variant constants for Framer Motion (already a dependency), since Framer Motion needs real JS values, not CSS vars.
3. **New shared primitives** — added to `frontend/components/ui/`, built on top of layers 1–2.

Then a retrofit pass applies all three across the four existing page groups (public site, salon detail, salon-admin dashboard, platform-admin dashboard).

### 1. Design tokens

New custom properties in `globals.css`:

```css
:root {
  /* Colors — clean neutral base + teal/mint accent, replacing terracotta as primary accent */
  --color-bg: #ffffff;
  --color-surface: #f7f8f7;       /* soft gray surface, replaces current ivory as the "off-white" */
  --color-ink: #1f2422;           /* dark text — close to existing ink, slightly cooled to pair with teal */
  --color-taupe: #6b7570;         /* secondary text — cooled from current warm taupe */
  --color-hairline: #e2e6e4;      /* borders — cooled from current warm hairline */
  --color-accent: #0f9b8e;        /* teal/mint primary accent */
  --color-accent-light: #cdeee9;  /* accent-tinted backgrounds/hover */
  --color-danger: #dc2626;        /* error state, currently ad hoc red-600 per page */

  /* Spacing/radii/shadows */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 12px 32px rgba(0,0,0,0.12);
}
```

`tailwind.config.ts` extends `theme.colors`/`theme.borderRadius`/`theme.boxShadow` to reference these variables (e.g. `accent: 'var(--color-accent)'`), so existing Tailwind class usage (`bg-terracotta` → `bg-accent`, etc.) becomes a mechanical rename across the codebase rather than inline style changes. `ivory`/`terracotta` token names are removed since the palette itself is changing (per the approved direction), not just re-pointed — anything referencing them gets updated at retrofit time (section 4).

### 2. Motion conventions (`frontend/lib/motion.ts`)

```ts
export const duration = { fast: 0.15, base: 0.3, slow: 0.5 };
export const spring = { type: "spring", stiffness: 300, damping: 20 }; // lively, moderate bounce

export const fadeInUp: Variants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: duration.base } } };
export const staggerContainer: Variants = { visible: { transition: { staggerChildren: 0.08 } } };
export const staggerItem: Variants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };
export const scaleTap = { whileHover: { scale: 1.03 }, whileTap: { scale: 0.97 }, transition: spring };
export const modalOverlay: Variants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
export const modalContent: Variants = { hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1, transition: spring } };
export const drawerSlide: Variants = { hidden: { x: "100%" }, visible: { x: 0, transition: spring } };

export const scrollReveal = { initial: "hidden", whileInView: "visible", viewport: { once: true, margin: "-80px" } };
```

A `usePrefersReducedMotion()` hook (wraps `window.matchMedia("(prefers-reduced-motion: reduce)")`) is exported alongside these; components that use spring/stagger variants check it and fall back to a near-instant `{ duration: 0.01 }` transition when true. This is checked once at the primitive level (e.g. inside `scaleTap`-consuming components) rather than duplicated per page.

### 3. New shared primitives (`frontend/components/ui/`)

All follow the existing pattern: small function components, Tailwind classes, minimal props, no new dependency.

- **`Skeleton.tsx`** — pulsing placeholder block (`div` with `animate-pulse bg-surface`), takes `className` for sizing.
- **`EmptyState.tsx`** — icon slot (optional) + message + optional CTA button, for "no leads yet" / "no bookings" / "no services" states.
- **`Toast.tsx`** + `ToastProvider` (context) — success/error notifications via `useToast()` hook, portal-rendered, auto-dismiss after ~4s, uses `modalOverlay`-style fade.
- **`Modal.tsx`** — portal + focus trap (basic: trap Tab within dialog, close on Escape/overlay click), uses `modalOverlay`/`modalContent` variants.
- **`Tabs.tsx`** — simple controlled tabs (active index/key + `onChange`), no URL sync in v1.
- **`Badge.tsx`** — status pill, `variant` prop (`success`/`warning`/`danger`/`neutral`) mapping to token colors — replaces today's hand-styled inline `<span>`s for booking/salon/lead status.
- **`Dropdown.tsx`** — styled native `<select>` wrapper (not a custom listbox — keeps it simple and accessible for v1) for filters/forms.

### 4. Retrofit plan

Applied as additive changes — swap hardcoded color/spacing classes for token-based ones, add scroll-reveal/stagger to existing lists, replace ad hoc loading/empty/error text with the new primitives. No layout/structure changes.

- **Public homepage & salon directory** (`app/page.tsx`, `SalonCard.tsx`, `SalonDirectory.tsx`): hero gets `fadeInUp` entrance; `SalonCard`/`SalonDirectory` move their existing one-off Framer Motion code onto `staggerContainer`/`staggerItem`/`scaleTap`; search/filter loading state gets `Skeleton`.
- **Salon detail page** (`app/salons/[slug]/page.tsx` and children): each section (`ServiceList`, `StaffList`, `GalleryGrid`, `AboutContact`) wrapped with `scrollReveal`; `BookingForm` submit gets `Toast` feedback alongside its existing inline success/error text.
- **Salon-admin dashboard** (`app/admin/*`): CRUD list pages (services/staff/gallery/content) get `Skeleton` while loading and `EmptyState` when empty; form saves get `Toast` confirmations; primary buttons/active nav move to the accent color.
- **Platform-admin dashboard** (`app/platform/*`): salons list and leads list get `Skeleton`/`EmptyState`/`Toast`; salon status and lead status get `Badge` instead of today's hand-styled spans.

Token/color renames (e.g. `terracotta` → `accent`) are applied file-by-file during this pass; this is mechanical but touches every existing page, so it's the bulk of the diff size for this phase.

## Error Handling

- `Toast` and inline form errors are not mutually exclusive in this phase — existing inline error text stays where it already exists (per-page decision, not removed), `Toast` is additive for success confirmations and newly-added error paths. No blanket replacement of existing error UI to avoid regressing tested flows.
- `Modal`'s focus trap and Escape-to-close are the only new interactive-accessibility surface introduced; `prefers-reduced-motion` handling in `motion.ts` covers the rest.

## Testing

No automated frontend tests exist in this repo by established convention (confirmed across every prior frontend feature — deliberate, manual-verification-only). Verification for this phase: `tsc --noEmit` clean across the frontend, then a manual browser walkthrough of all four page groups confirming — token colors render correctly (teal accent, clean neutral background), animations fire with the intended "lively" spring feel and respect `prefers-reduced-motion` (verified via OS/browser emulation of the media query), and each new primitive renders correctly in at least one real usage (Skeleton on a loading list, EmptyState on an empty list, Toast on a form submit, Modal on one real flow, Badge on status pills, Dropdown on one filter/form).

## Self-Review Notes

- **Spec coverage**: all four brainstorming decisions (evolve palette toward teal/mint accent + clean neutral base, lively/expressive motion, retrofit all four page groups) are reflected in sections 1–4. No placeholders.
- **Internal consistency**: token names removed (`ivory`/`terracotta`) are called out explicitly as replaced, not left ambiguous; retrofit section explains the rename is mechanical but touches every page, setting an accurate expectation for diff size.
- **Scope check**: single cohesive phase (tokens → motion lib → primitives → retrofit), matches the roadmap's Phase 0 scope exactly, appropriately sized for one implementation plan.
- **Ambiguity check**: exact hex values, spring constants, and primitive prop shapes are specified concretely rather than left to implementation-time guessing, so the implementer isn't inventing design decisions.
