# Redesign Phase 2: Search Results + Salon Profile Restyle — Design Spec

**Goal:** Build a net-new search results page and restyle the existing salon profile page to match the Claude-Design mockup handoff, continuing the rebrand started in [Phase 1](2026-08-29-redesign-tokens-landing-design.md). This is Phase 2 of the [full redesign roadmap](../plans/2026-08-29-ceylonbellezza-redesign-roadmap.md).

**Non-goals:**
- No reviews/ratings subsystem — no reviews section, no rating stars/pills anywhere, no "Top rated"/"Verified" badges. These require a subsystem that doesn't exist yet.
- No geo/distance — no radius-based location filter, no "N km away," no map card. `Salon.latitude/longitude` exists but is best-effort and there's no Haversine query yet (that's Phase 6 of the separate full-site roadmap).
- No slot-availability computation — no "Next available" time chips, no Availability filter in the sidebar, no per-slot booking logic. That's the future 4-step booking wizard (Phase 3 of this redesign roadmap).
- No opening-hours display — no salon-level hours field exists (only per-staff `StaffAvailability`), and deriving an approximation is out of scope.
- No new backend endpoints — both new/changed pages filter client-side against the existing `GET /salons` (already returns `starting_price` as of Phase 1) and `GET /salons/{slug}`, matching this codebase's small-dataset, client-filtered pattern already used by `SalonDirectory`.
- No favorites/save functionality — the profile page's `Save` button is inert, consistent with the Phase 1 precedent of shipping non-functional nav affordances ahead of their backing feature.
- No multi-service "Add" builder on the profile's service list — it's a read-only table; the existing single-service `BookingForm` remains the actual booking mechanism, unchanged.

## Architecture

Two frontend surfaces, both continuing Phase 1's tokens/primitives, no backend changes:

1. **New `/search` page** (`frontend/app/search/page.tsx`) — client component, filters the full active-salon list client-side.
2. **Salon profile restyle** (`frontend/app/salons/[slug]/page.tsx` and its child components) — visual restyle of an existing page, same data.
3. **`SearchBarCard` becomes a real search form** that navigates to `/search`, and the landing page's `SalonDirectory` reverts to a non-filtering, full-list display now that filtering has moved to `/search`.

### 1. `/search` page

`frontend/app/search/page.tsx` reads `service`, `location`, and `date` from the URL query string via `useSearchParams()`. `date` is accepted and carried in the URL for forward-compatibility with the future slot-availability engine, but is not used to filter anything in this phase.

Data: calls the existing `getSalons()` once on mount (same client-side pattern as `SalonDirectory` today — the active-salon list is small enough that client-side filtering is appropriate, avoiding a new backend endpoint).

Client-side filtering pipeline, applied in order:
- `service` query param: substring match against `salon.name` (case-insensitive) — same match `SalonDirectory` already performs.
- `location` query param: substring match against `salon.city` (case-insensitive).
- **Price range facet**: a dual-handle slider. Bounds are computed dynamically from `Math.min`/`Math.max` of the fetched salons' non-null `starting_price` values (not hardcoded mockup values) so the facet is always meaningful for the actual dataset. Salons with `starting_price: null` are excluded once a price filter is active (nothing to compare).
- **Service type facet**: pill buttons for the three existing `Salon.category` values (`mens`/`womens`/`unisex`) — reusing the field already shown as a badge on `SalonCard`, not a new granular per-service taxonomy (services have their own `category` field, e.g. "Hair"/"Nails", but no aggregation of that onto `SalonSummary` exists, and adding one is out of scope for this phase).

Both facets apply immediately (no "Apply" button), matching the mockup's stated interaction: "Filters apply immediately... reflected in the result count line." A "Clear all" control resets both facets to their full-range/all-categories defaults (text `service`/`location` params are untouched by "Clear all" — those came from the search bar, not the sidebar).

Layout: `Filters` sidebar (price range + service type + clear-all) on the left, results header (`"<count> salons available"` — no fabricated "sorted by recommended" copy since there's no ranking algorithm) plus the result grid on the right. Availability, Rating, and radius-Location sidebar sections from the mockup are omitted outright, not stubbed disabled.

### 2. `SearchResultCard.tsx` (new)

`frontend/components/SearchResultCard.tsx` — wider layout than the landing page's `SalonCard` (mockup: 250×180 photo + right-side detail column, `display: flex`), reusing Phase 1's tokens:
- Photo (`<img>`, matching this codebase's existing convention of plain `<img>` over `next/image`).
- Name (Cormorant, matching `SalonCard`'s heading treatment).
- City with `MapPin` icon (reusing the icon already used on `SalonCard`).
- `Salon.category` tag, styled with the existing `bg-accent-light` token (same treatment as `SalonCard`'s category badge).
- "Starting from" + `formatCurrency(salon.starting_price)`, or "Price on request" when null — same null-guard pattern as `SalonCard` (`!= null`).
- A `Book now` pill (`bg-accent`, per Phase 1's token palette) that is a `<Link href={`/salons/${salon.slug}`}>` — navigates to the salon profile page, per the decision that booking CTAs land on the existing `BookingForm` rather than a not-yet-built wizard.
- Rating pill, distance, and "Next available" chips are omitted (not rendered, not stubbed).

Loading state: reuse the existing `Skeleton` primitive while `getSalons()` resolves. Empty state (zero results after filtering): reuse the existing `EmptyState` primitive with copy "No salons match your search" (same copy `SalonDirectory` already uses for its empty case).

### 3. `SearchBarCard.tsx` changes

Currently (`frontend/components/SearchBarCard.tsx`): `Service` is a real controlled `<input>`; `Location` and `Date` are static, non-interactive `<span>`s reading "Anywhere"/"Today" at `opacity-60`; the submit button is `type="button"` with no handler.

Changes:
- `Location` becomes a real controlled `<input>` (same visual treatment as the existing `Service` field — label, icon, `min-h-[44px]` row), added as a new prop (`locationValue`/`onLocationChange`) alongside the existing `value`/`onChange` for Service.
- `Date` stays exactly as-is: a static, non-interactive "Today" display. (Kept inert per the decision to carry a `date` param without building anything that filters by it — an interactive date picker with no backing filter would be more misleading than a static label.)
- The submit button becomes a real `<button type="submit">` inside a `<form>` wrapping the whole card; `onSubmit` calls `router.push()` (Next.js `useRouter`) to `/search?service=<value>&location=<locationValue>&date=today` (the literal string `"today"`, since there's no real date picker to source a value from — this keeps the query param present and shaped correctly for when a real date picker is added later).

### 4. `SalonDirectory.tsx` change

`SalonDirectory` currently uses its local `query` state (wired to `SearchBarCard`'s `Service` field) to live-filter the "Featured this week" grid as the user types. That responsibility moves entirely to `/search`. `SalonDirectory` changes to:
- Keep rendering `SearchBarCard` (still the entry point for the search *form*, now navigating instead of filtering).
- Drop its internal `query`/`filtered` state and the `useMemo` filter — always render the full `initialSalons` list under "Featured this week."
- `SearchBarCard`'s `value`/`onChange` (Service) and new `locationValue`/`onLocationChange` (Location) become local, uncontrolled-from-the-parent's-perspective state living inside `SalonDirectory` only long enough to pass to the form's submit handler — `SalonDirectory` no longer needs the value for filtering, only to hand off to navigation on submit.

### 5. Salon profile restyle

`frontend/app/salons/[slug]/page.tsx` keeps its current data flow (`getSalonBySlug`, `notFound()` on missing salon) and component composition (`SalonHero`, `BookingForm`, `ServiceList`, `StaffList`, `GalleryGrid`, `AboutContact`), restyling each in place:

- **`SalonHero.tsx`**: gallery restyled to the mockup's asymmetric grid (`grid-template-columns: 2fr 1fr 1fr`, two 150px rows, gap 12, first cell spanning both rows; if a salon has more than 4 gallery photos, the last visible cell gets a `rgba(14,59,50,.5)` scrim with a `+N photos` count, matching the mockup — otherwise no overlay). Adds a badge row using the existing `Salon.category` field (styled like the mockup's badge, e.g. `bg-accent-light` pill reading "Mens"/"Womens"/"Unisex") and an inert `Save` outlined button (no favorites backend yet — same "ship the affordance, no-op the handler" pattern Phase 1 used for `Header`'s `Sign in`). The in-page tab row is a single static `Services` tab (bold, champagne underline) — no other tabs exist yet since Team/Reviews aren't separate routable sections. `Verified`/`Top rated`/`Open until` elements are omitted (no backing data).
- **`ServiceList.tsx`**: restyled into the mockup's table treatment — category heading, then a white `radius-22` list with columns for name+note, duration, and right-aligned price. Read-only: no per-row "Add" toggle/button (that interaction belongs to the future multi-select booking wizard). The existing `BookingForm` below is unchanged in behavior.
- **`StaffList.tsx`**: restyled into the mockup's 4-up team cards (circular avatar, name, role). No rating pill (no staff rating data).
- **`GalleryGrid.tsx`**: restyled to match the mockup's grid treatment (separate from `SalonHero`'s smaller preview grid — this is the full gallery section further down the page, same as today's structure, same data).
- **`AboutContact.tsx`**: restyled visually (card treatment, token colors) with the same data it already displays (address, contact info) — no opening-hours or map addition.
- **Right rail**: a new sticky summary card replacing the mockup's full "booking summary + Continue to booking" panel with a simplified version — salon name, starting price, and a CTA (`<a href="#booking">` or equivalent) that scrolls down to the existing `BookingForm`, which gets an `id="booking"` anchor. No per-service running total (that needs the multi-select builder this phase explicitly excludes). Sits alongside the restyled `AboutContact` card in the same right-column position the mockup specifies.

## Error Handling

- `/search` with zero matches after filtering: `EmptyState`, no error thrown — same non-error empty-result pattern `SalonDirectory` already uses.
- `getSalons()` failure on `/search`: no new pattern needed — matches how `SalonDirectory`'s existing fetch failure is handled today (this page is client-rendered the same way).
- Salon profile page: `notFound()` on a missing/invalid slug is unchanged from today's behavior.
- No new form submissions, no new POST/PATCH calls — nothing in this phase can fail server-side beyond the two already-existing GET endpoints.

## Testing

No automated frontend tests, per this repo's established convention (confirmed across every prior frontend phase). Manual verification:
- Submit the landing page's search bar with a service name and a city; confirm navigation to `/search` with correct query params and correct filtered results.
- On `/search`, adjust the price-range slider and service-type pills; confirm the result grid and count line update immediately, and that the price bounds reflect the actual dataset's min/max `starting_price`.
- Confirm `/search` with no matches renders the `EmptyState`.
- Visit an existing salon's profile page; confirm the restyled gallery, single `Services` tab, services table, team cards, and right-rail summary card all render with real data, and that the summary card's CTA scrolls to the existing `BookingForm`.
- Confirm the landing page's "Featured this week" grid now always shows the full salon list (no more live-filter-as-you-type), and that `SearchBarCard`'s Location field is now a working input.

## Self-Review Notes

- **Spec coverage**: all decisions from brainstorming (omit missing-data elements outright, booking CTAs link to the existing `BookingForm`, filter sidebar reduced to price+service-type, Date stays inert but carried as a param, hero search now navigates to `/search`, opening-hours omitted) are reflected in the relevant sections above. No placeholders.
- **Placeholder scan**: no TBD/TODO. Every omission is a deliberate, named non-goal rather than a stub.
- **Internal consistency**: the "Service type" facet is explicitly defined as `Salon.category`, not a new granular taxonomy, and this same definition is used consistently in both the `/search` filter section and the `SearchResultCard` tag description.
- **Scope check**: one cohesive phase (search results page + salon profile restyle), matching the roadmap's own Phase 2 scope, appropriately sized for a single implementation plan — comparable in size to Phase 1's plan (8 tasks).
- **Ambiguity check**: exact filter data sources, component names, and CTA destinations are specified concretely rather than left to implementation-time guessing.
