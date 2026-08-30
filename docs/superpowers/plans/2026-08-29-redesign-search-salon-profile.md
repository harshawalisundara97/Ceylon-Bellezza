# Redesign Phase 2: Search Results + Salon Profile Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new `/search` results page and restyle the existing salon profile page to match the Claude-Design mockup handoff, continuing Phase 1's rebrand.

**Architecture:** The landing page's search bar becomes a real navigation form; a new client-rendered `/search` page filters the existing small `GET /salons` dataset in-browser (price range + service-category facets, no new backend); the salon profile page gets a restyled gallery/services/team/gallery/about layout plus a new sticky right-rail summary card, all reusing Phase 1's design tokens and primitives.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, `lucide-react` (already a dependency, no new one added).

**Spec:** docs/superpowers/specs/2026-08-29-redesign-search-salon-profile-design.md

## Global Constraints

- No new backend endpoints — both surfaces filter client-side against the existing `GET /salons` and `GET /salons/{slug}`.
- No new npm dependencies.
- Reuse Phase 1's existing design tokens (`bg`, `surface`, `ink`, `taupe`, `hairline`, `accent`, `accent-light`, `danger`, `success`, `champagne`, `champagne-light`, `charcoal`, `radius-pill`, `shadow-floating`) — do not invent new color values.
- Reviews/ratings, distance/geo, slot-availability ("Next available" chips), and opening-hours are explicitly out of scope for this phase — omit them outright from the UI. Never render fabricated/placeholder data (no fake star ratings, no fake distances, no fake time slots).
- The `Save` button on the salon profile and any booking-CTA styling stay purely presentational where no backend exists yet (matching Phase 1's precedent of shipping inert nav affordances ahead of their backing feature).
- No automated frontend tests, per this repo's established convention — verification is `npx tsc --noEmit` plus a manual browser walkthrough (matching every prior frontend phase in this repo).

---

### Task 1: `SearchBarCard` becomes a self-contained navigating search form

**Files:**
- Modify: `frontend/components/SearchBarCard.tsx` (full replacement)

**Interfaces:**
- Produces: `SearchBarCard()` — a client component with **no props** (previously took `value`/`onChange`). Manages its own `service`/`location` state internally and navigates to `/search?service=<>&location=<>&date=today` on submit. Later tasks (Task 2) stop passing any props to it.

- [ ] **Step 1: Replace `frontend/components/SearchBarCard.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Calendar } from "lucide-react";

export default function SearchBarCard() {
  const router = useRouter();
  const [service, setService] = useState("");
  const [location, setLocation] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams({ service, location, date: "today" });
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg bg-white p-4 shadow-floating sm:grid sm:grid-cols-[1.3fr_1fr_1fr_auto] sm:items-center sm:gap-3.5 sm:p-[18px]"
    >
      <div className="border-hairline py-2 sm:border-r sm:pr-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-taupe">Service</p>
        <div className="mt-1 flex items-center gap-2">
          <Search size={18} className="text-champagne" strokeWidth={2.75} />
          <input
            type="text"
            value={service}
            onChange={(event) => setService(event.target.value)}
            placeholder="Search by salon name or city..."
            className="min-h-[44px] w-full bg-transparent text-sm text-ink placeholder:text-taupe focus:outline-none"
          />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-hairline py-2 sm:col-span-2 sm:mt-0 sm:grid sm:grid-cols-2 sm:gap-0 sm:border-r sm:px-3.5">
        <div className="border-hairline sm:border-r sm:pr-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-taupe">Location</p>
          <div className="mt-1 flex items-center gap-2">
            <MapPin size={18} className="text-champagne" strokeWidth={2.75} />
            <input
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Anywhere"
              className="min-h-[44px] w-full bg-transparent text-sm text-ink placeholder:text-taupe focus:outline-none"
            />
          </div>
        </div>
        <div className="sm:pl-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-taupe">Date</p>
          <div className="mt-1 flex min-h-[44px] items-center gap-2 opacity-60">
            <Calendar size={18} className="text-champagne" strokeWidth={2.75} />
            <span className="text-sm text-ink">Today</span>
          </div>
        </div>
      </div>
      <button
        type="submit"
        className="mt-3 min-h-[44px] w-full rounded-pill bg-champagne px-6 text-sm font-bold text-ink sm:mt-0 sm:h-14 sm:w-auto sm:min-h-0"
      >
        Search salons
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors (this step will show errors from `SalonDirectory.tsx` still passing props to `SearchBarCard` — that's expected until Task 2; if working this task in isolation, ignore errors originating from `SalonDirectory.tsx` specifically and confirm `SearchBarCard.tsx` itself has none).

- [ ] **Step 3: Commit**

```bash
git add frontend/components/SearchBarCard.tsx
git commit -m "feat: make SearchBarCard a self-contained form that navigates to /search"
```

---

### Task 2: Simplify `SalonDirectory` — drop live-filtering, stop passing props to `SearchBarCard`

**Files:**
- Modify: `frontend/components/SalonDirectory.tsx` (full replacement)

**Interfaces:**
- Consumes: `SearchBarCard()` (Task 1) — no props.
- Produces: `SalonDirectory({ initialSalons }: { initialSalons: SalonSummary[] })` — unchanged prop signature from before; always renders the full `initialSalons` list (no more query-based filtering).

- [ ] **Step 1: Replace `frontend/components/SalonDirectory.tsx`**

```tsx
"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SalonSummary } from "@/lib/types";
import SalonCard from "./SalonCard";
import SearchBarCard from "./SearchBarCard";
import { staggerContainer } from "@/lib/motion";

export default function SalonDirectory({ initialSalons }: { initialSalons: SalonSummary[] }) {
  return (
    <div>
      <div className="relative z-10 mx-4 -mt-[26px] sm:mx-11 sm:-mt-[58px]">
        <SearchBarCard />
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-11">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-[32px] font-semibold text-ink">Featured this week</h2>
          <div className="hidden gap-2 sm:flex">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-pill border border-hairline text-ink"
              aria-label="Previous"
            >
              <ChevronLeft size={18} strokeWidth={2.75} />
            </button>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-pill bg-accent text-white"
              aria-label="Next"
            >
              <ChevronRight size={18} strokeWidth={2.75} />
            </button>
          </div>
        </div>

        {initialSalons.length === 0 ? (
          <p className="py-16 text-center text-taupe">No salons yet — check back soon.</p>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="mt-6 grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-4"
          >
            {initialSalons.map((salon) => (
              <div key={salon.id}>
                <SalonCard salon={salon} />
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS, no errors anywhere.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/SalonDirectory.tsx
git commit -m "feat: drop live-filter from SalonDirectory now that search moved to /search"
```

---

### Task 3: `SearchResultCard` component

**Files:**
- Create: `frontend/components/SearchResultCard.tsx`

**Interfaces:**
- Consumes: `SalonSummary` (existing type, `frontend/lib/types.ts`), `formatCurrency` (existing, `frontend/lib/format.ts`), `Card` (existing, `frontend/components/ui/Card.tsx`).
- Produces: `SearchResultCard({ salon }: { salon: SalonSummary })`, default export — consumed by Task 5.

- [ ] **Step 1: Create `frontend/components/SearchResultCard.tsx`**

```tsx
import Link from "next/link";
import { MapPin } from "lucide-react";
import { SalonSummary } from "@/lib/types";
import Card from "@/components/ui/Card";
import { formatCurrency } from "@/lib/format";

const DEFAULT_COVER_IMAGE = "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80";

function coverImage(salon: SalonSummary): string {
  const settings = salon.template_settings as { hero_image?: string };
  return settings.hero_image ?? DEFAULT_COVER_IMAGE;
}

export default function SearchResultCard({ salon }: { salon: SalonSummary }) {
  return (
    <Card padding={false} className="overflow-hidden">
      <Link href={`/salons/${salon.slug}`} className="flex flex-col gap-5 p-4 sm:flex-row">
        <div className="h-[180px] w-full flex-shrink-0 overflow-hidden rounded-lg sm:w-[250px]">
          <img src={coverImage(salon)} alt={salon.name} className="h-full w-full object-cover" />
        </div>
        <div className="flex flex-1 flex-col">
          <span className="inline-block w-fit rounded-pill bg-accent-light px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-accent">
            {salon.category}
          </span>
          <h3 className="mt-2 font-serif text-2xl font-semibold text-ink">{salon.name}</h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-taupe">
            <MapPin size={14} strokeWidth={2.75} />
            {salon.city}
          </p>
          <div className="mt-auto flex items-center justify-between border-t border-hairline pt-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-taupe">Starting from</p>
              <p className="text-sm font-semibold text-ink">
                {salon.starting_price != null ? formatCurrency(salon.starting_price) : "Price on request"}
              </p>
            </div>
            <span className="rounded-pill bg-accent px-6 py-2.5 text-sm font-semibold text-white">Book now</span>
          </div>
        </div>
      </Link>
    </Card>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (this file has no consumers yet, so `tsc` should already be clean — this checks the new file in isolation).

- [ ] **Step 3: Commit**

```bash
git add frontend/components/SearchResultCard.tsx
git commit -m "feat: add SearchResultCard for the search results page"
```

---

### Task 4: `SearchFilters` sidebar component

**Files:**
- Create: `frontend/components/SearchFilters.tsx`

**Interfaces:**
- Produces: `SearchFilters(props: SearchFiltersProps)`, default export, where:
  ```ts
  interface SearchFiltersProps {
    priceBounds: { min: number; max: number };
    priceRange: { min: number; max: number };
    onPriceRangeChange: (range: { min: number; max: number }) => void;
    category: string | null;
    onCategoryChange: (category: string | null) => void;
    onClearAll: () => void;
  }
  ```
  Consumed by Task 5.

- [ ] **Step 1: Create `frontend/components/SearchFilters.tsx`**

```tsx
"use client";

const CATEGORIES = [
  { value: "mens", label: "Mens" },
  { value: "womens", label: "Womens" },
  { value: "unisex", label: "Unisex" },
];

interface SearchFiltersProps {
  priceBounds: { min: number; max: number };
  priceRange: { min: number; max: number };
  onPriceRangeChange: (range: { min: number; max: number }) => void;
  category: string | null;
  onCategoryChange: (category: string | null) => void;
  onClearAll: () => void;
}

function formatRs(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString("en-US")}`;
}

export default function SearchFilters({
  priceBounds,
  priceRange,
  onPriceRangeChange,
  category,
  onCategoryChange,
  onClearAll,
}: SearchFiltersProps) {
  return (
    <div className="rounded-lg border border-hairline bg-white p-[22px]">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold text-ink">Filters</h3>
        <button type="button" onClick={onClearAll} className="text-sm text-accent hover:underline">
          Clear all
        </button>
      </div>

      <div className="mt-5 border-t border-hairline pt-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-taupe">Price range</p>
        <div className="mt-3 flex items-center justify-between text-sm text-ink">
          <span>{formatRs(priceRange.min)}</span>
          <span>{formatRs(priceRange.max)}</span>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          <input
            type="range"
            min={priceBounds.min}
            max={priceBounds.max}
            value={priceRange.min}
            onChange={(event) => {
              const nextMin = Math.min(Number(event.target.value), priceRange.max);
              onPriceRangeChange({ min: nextMin, max: priceRange.max });
            }}
            aria-label="Minimum price"
            className="w-full accent-champagne"
          />
          <input
            type="range"
            min={priceBounds.min}
            max={priceBounds.max}
            value={priceRange.max}
            onChange={(event) => {
              const nextMax = Math.max(Number(event.target.value), priceRange.min);
              onPriceRangeChange({ min: priceRange.min, max: nextMax });
            }}
            aria-label="Maximum price"
            className="w-full accent-champagne"
          />
        </div>
      </div>

      <div className="mt-5 border-t border-hairline pt-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-taupe">Service type</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORIES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onCategoryChange(category === option.value ? null : option.value)}
              className={`rounded-pill border px-4 py-2 text-sm ${
                category === option.value ? "border-accent bg-accent-light text-accent" : "border-hairline text-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/SearchFilters.tsx
git commit -m "feat: add SearchFilters sidebar (price range + service type)"
```

---

### Task 5: `SearchResults` page logic + `/search` route

**Files:**
- Create: `frontend/components/SearchResults.tsx`
- Create: `frontend/app/search/page.tsx`

**Interfaces:**
- Consumes: `SearchResultCard` (Task 3), `SearchFilters` + `SearchFiltersProps` (Task 4), `getSalons` (existing, `frontend/lib/api.ts`), `Skeleton` and `EmptyState` (existing, `frontend/components/ui/`).
- Produces: the `/search` route.

- [ ] **Step 1: Create `frontend/components/SearchResults.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSalons } from "@/lib/api";
import { SalonSummary } from "@/lib/types";
import SearchResultCard from "./SearchResultCard";
import SearchFilters from "./SearchFilters";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";

export default function SearchResults() {
  const searchParams = useSearchParams();
  const service = searchParams.get("service") ?? "";
  const location = searchParams.get("location") ?? "";

  const [salons, setSalons] = useState<SalonSummary[] | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null);

  useEffect(() => {
    getSalons().then(setSalons);
  }, []);

  const priceBounds = useMemo(() => {
    if (!salons) return { min: 0, max: 0 };
    const prices = salons.map((s) => s.starting_price).filter((p): p is number => p != null);
    if (prices.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [salons]);

  const effectivePriceRange = priceRange ?? priceBounds;

  const filtered = useMemo(() => {
    if (!salons) return [];
    const normalizedService = service.trim().toLowerCase();
    const normalizedLocation = location.trim().toLowerCase();
    return salons.filter((salon) => {
      if (normalizedService && !salon.name.toLowerCase().includes(normalizedService)) return false;
      if (normalizedLocation && !salon.city.toLowerCase().includes(normalizedLocation)) return false;
      if (category && salon.category !== category) return false;
      if (priceRange) {
        if (salon.starting_price == null) return false;
        if (salon.starting_price < priceRange.min || salon.starting_price > priceRange.max) return false;
      }
      return true;
    });
  }, [salons, service, location, category, priceRange]);

  function handleClearAll() {
    setCategory(null);
    setPriceRange(null);
  }

  if (salons === null) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-11">
        <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2">
          <Skeleton className="h-[212px] w-full" />
          <Skeleton className="h-[212px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-11">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_1fr]">
        <div>
          <SearchFilters
            priceBounds={priceBounds}
            priceRange={effectivePriceRange}
            onPriceRangeChange={setPriceRange}
            category={category}
            onCategoryChange={setCategory}
            onClearAll={handleClearAll}
          />
        </div>

        <div>
          <h1 className="font-serif text-[32px] font-semibold text-ink">
            {service ? `${service} salons` : "Search results"}
            {location ? ` in ${location}` : ""}
          </h1>
          <p className="mt-1 text-sm text-taupe">{filtered.length} salons available</p>

          {filtered.length === 0 ? (
            <div className="mt-8">
              <EmptyState title="No salons match your search" />
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-5">
              {filtered.map((salon) => (
                <SearchResultCard key={salon.id} salon={salon} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/app/search/page.tsx`**

```tsx
import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SearchResults from "@/components/SearchResults";

export default function SearchPage() {
  return (
    <main>
      <Header />
      <Suspense fallback={null}>
        <SearchResults />
      </Suspense>
      <Footer />
    </main>
  );
}
```

`useSearchParams()` requires a `<Suspense>` boundary around any component that calls it in the Next.js App Router — without it, `next build` fails static generation for this route. `SearchResults` is the component calling the hook, so it must be the `<Suspense>` child, not the page itself.

- [ ] **Step 3: Verify types and build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: both clean; build output lists `/search` as a route.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/SearchResults.tsx frontend/app/search/page.tsx
git commit -m "feat: add /search results page"
```

---

### Task 6: Restyle `SalonHero` (gallery grid, badge, Save/Book now)

**Files:**
- Modify: `frontend/components/SalonHero.tsx` (full replacement)

**Interfaces:**
- Consumes: `SalonDetail` (existing type — already includes `.gallery: GalleryItem[]`, `.category`, `.name`, `.city`, `.template_settings`).
- Produces: `SalonHero({ salon }: { salon: SalonDetail })` — same signature as before, no change needed by callers.

- [ ] **Step 1: Replace `frontend/components/SalonHero.tsx`**

```tsx
import { SalonDetail } from "@/lib/types";

const DEFAULT_HERO_IMAGE = "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&q=80";

const CATEGORY_LABELS: Record<string, string> = {
  mens: "Mens",
  womens: "Womens",
  unisex: "Unisex",
};

function coverImage(salon: SalonDetail): string {
  const settings = salon.template_settings as { hero_image?: string };
  return settings.hero_image ?? DEFAULT_HERO_IMAGE;
}

export default function SalonHero({ salon }: { salon: SalonDetail }) {
  const galleryPhotos = salon.gallery.slice(0, 5);
  const extraPhotoCount = Math.max(0, salon.gallery.length - 5);

  return (
    <section className="px-6 pt-8 sm:px-11">
      {galleryPhotos.length > 0 ? (
        <div className="grid h-[312px] grid-cols-[2fr_1fr_1fr] grid-rows-2 gap-3 overflow-hidden rounded-xl">
          {galleryPhotos.map((photo, index) => {
            const isFirst = index === 0;
            const isLast = index === galleryPhotos.length - 1 && extraPhotoCount > 0;
            return (
              <div key={photo.id} className={`relative h-full w-full overflow-hidden ${isFirst ? "row-span-2" : ""}`}>
                <img src={photo.image_url} alt={photo.caption || salon.name} className="h-full w-full object-cover" />
                {isLast && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[rgba(14,59,50,0.5)]">
                    <span className="text-lg font-semibold text-white">+{extraPhotoCount} photos</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <img src={coverImage(salon)} alt={salon.name} className="h-[312px] w-full rounded-xl object-cover" />
      )}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-block rounded-pill bg-accent-light px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-accent">
            {CATEGORY_LABELS[salon.category] ?? salon.category}
          </span>
          <h1 className="mt-3 font-serif text-4xl font-semibold text-ink sm:text-5xl">{salon.name}</h1>
          <p className="mt-1 text-taupe">{salon.city}</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="rounded-pill border border-hairline px-5 py-2.5 text-sm font-semibold text-ink">
            Save
          </button>
          <a href="#book" className="rounded-pill bg-champagne px-5 py-2.5 text-sm font-semibold text-ink">
            Book now
          </a>
        </div>
      </div>

      <div className="mt-6 border-b border-hairline">
        <span className="inline-block border-b-2 border-champagne pb-3 text-sm font-semibold text-accent">Services</span>
      </div>
    </section>
  );
}
```

`href="#book"` reuses the anchor `id="book"` that already exists on `BookingForm.tsx`'s root `<section>` (both its success and default render paths) — no change needed to `BookingForm.tsx`.

- [ ] **Step 2: Verify types**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/SalonHero.tsx
git commit -m "feat: restyle SalonHero with gallery grid and new tokens"
```

---

### Task 7: Restyle `ServiceList` and `StaffList`

**Files:**
- Modify: `frontend/components/ServiceList.tsx` (full replacement)
- Modify: `frontend/components/StaffList.tsx` (full replacement)

**Interfaces:**
- Consumes: `Service`, `Staff` (existing types), `formatCurrency` (existing, `frontend/lib/format.ts`).
- Produces: same prop signatures as before (`{ services: Service[] }`, `{ staff: Staff[] }`) — no caller changes needed.

- [ ] **Step 1: Replace `frontend/components/ServiceList.tsx`**

```tsx
import { Service } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

function groupByCategory(services: Service[]): Record<string, Service[]> {
  return services.reduce<Record<string, Service[]>>((groups, service) => {
    (groups[service.category] ??= []).push(service);
    return groups;
  }, {});
}

export default function ServiceList({ services }: { services: Service[] }) {
  const grouped = groupByCategory(services);

  return (
    <section className="py-8">
      <h2 className="font-serif text-2xl font-semibold text-ink">Services</h2>
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-accent">{category}</h3>
          <ul className="mt-3 divide-y divide-hairline rounded-xl border border-hairline bg-white">
            {items.map((service) => (
              <li key={service.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium text-ink">{service.name}</p>
                  <p className="text-sm text-taupe">{service.duration_minutes} min</p>
                </div>
                <p className="font-semibold text-ink">{formatCurrency(service.price)}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Replace `frontend/components/StaffList.tsx`**

```tsx
import { Staff } from "@/lib/types";

const DEFAULT_STAFF_PHOTO = "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80";

export default function StaffList({ staff }: { staff: Staff[] }) {
  return (
    <section className="py-8">
      <h2 className="font-serif text-2xl font-semibold text-ink">Team</h2>
      <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {staff.map((member) => (
          <div key={member.id} className="rounded-xl border border-hairline bg-white p-5 text-center">
            <img
              src={member.photo_url ?? DEFAULT_STAFF_PHOTO}
              alt={member.name}
              className="mx-auto h-[88px] w-[88px] rounded-full object-cover"
            />
            <p className="mt-3 font-semibold text-ink">{member.name}</p>
            <p className="text-sm text-taupe">{member.bio}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify types**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ServiceList.tsx frontend/components/StaffList.tsx
git commit -m "feat: restyle ServiceList and StaffList with new tokens"
```

---

### Task 8: Restyle `GalleryGrid` and `AboutContact`

**Files:**
- Modify: `frontend/components/GalleryGrid.tsx` (full replacement)
- Modify: `frontend/components/AboutContact.tsx` (full replacement)

**Interfaces:**
- Consumes: `GalleryItem` (existing type).
- Produces: same prop signatures as before (`{ items: GalleryItem[] }`, `{ content: Record<string, string> }`) — no caller changes needed.

- [ ] **Step 1: Replace `frontend/components/GalleryGrid.tsx`**

```tsx
import { GalleryItem } from "@/lib/types";

export default function GalleryGrid({ items }: { items: GalleryItem[] }) {
  return (
    <section className="py-8">
      <h2 className="font-serif text-2xl font-semibold text-ink">Gallery</h2>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => (
          <img
            key={item.id}
            src={item.image_url}
            alt={item.caption || "Gallery photo"}
            className={`w-full rounded-xl object-cover ${index % 3 === 0 ? "aspect-[3/4]" : "aspect-square"}`}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Replace `frontend/components/AboutContact.tsx`**

```tsx
export default function AboutContact({ content }: { content: Record<string, string> }) {
  if (!content.about_us && !content.contact_info) {
    return null;
  }

  return (
    <section className="py-8">
      <div className="grid gap-6 md:grid-cols-2">
        {content.about_us && (
          <div className="rounded-xl border border-hairline bg-white p-6">
            <h2 className="font-serif text-xl font-semibold text-ink">About</h2>
            <p className="mt-3 text-taupe">{content.about_us}</p>
          </div>
        )}
        {content.contact_info && (
          <div className="rounded-xl border border-hairline bg-white p-6">
            <h2 className="font-serif text-xl font-semibold text-ink">Contact</h2>
            <p className="mt-3 text-taupe">{content.contact_info}</p>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify types**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/GalleryGrid.tsx frontend/components/AboutContact.tsx
git commit -m "feat: restyle GalleryGrid and AboutContact with new tokens"
```

---

### Task 9: `SalonRightRail` component + wire the two-column profile layout

**Files:**
- Create: `frontend/components/SalonRightRail.tsx`
- Modify: `frontend/app/salons/[slug]/page.tsx` (full replacement)

**Interfaces:**
- Consumes: `SalonDetail` (existing type), `formatCurrency` (existing, `frontend/lib/format.ts`), `Header`/`Footer` (existing, Phase 1), `Reveal` (existing, `frontend/components/ui/Reveal.tsx`), and every component restyled in Tasks 6–8 plus the unmodified `BookingForm`.
- Produces: `SalonRightRail({ salon }: { salon: SalonDetail })`, default export.

- [ ] **Step 1: Create `frontend/components/SalonRightRail.tsx`**

```tsx
import { SalonDetail } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

export default function SalonRightRail({ salon }: { salon: SalonDetail }) {
  const prices = salon.services.map((s) => s.price);
  const startingPrice = prices.length > 0 ? Math.min(...prices) : null;

  return (
    <div className="sticky top-24 flex flex-col gap-5">
      <div className="rounded-xl bg-accent p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-champagne">Booking</p>
        <p className="mt-3 text-sm text-white/80">Starting from</p>
        <p className="mt-1 font-serif text-3xl font-semibold">
          {startingPrice != null ? formatCurrency(startingPrice) : "Price on request"}
        </p>
        <a
          href="#book"
          className="mt-5 block rounded-pill bg-champagne px-6 py-3 text-center text-sm font-bold text-ink"
        >
          Continue to booking
        </a>
        <p className="mt-3 text-xs text-white/70">Pay at salon or online</p>
      </div>
    </div>
  );
}
```

`href="#book"` reuses `BookingForm.tsx`'s existing `id="book"` anchor — same target as `SalonHero`'s "Book now" button from Task 6, no new id needed.

- [ ] **Step 2: Replace `frontend/app/salons/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getSalonBySlug } from "@/lib/api";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SalonHero from "@/components/SalonHero";
import ServiceList from "@/components/ServiceList";
import StaffList from "@/components/StaffList";
import GalleryGrid from "@/components/GalleryGrid";
import AboutContact from "@/components/AboutContact";
import BookingForm from "@/components/BookingForm";
import SalonRightRail from "@/components/SalonRightRail";
import Reveal from "@/components/ui/Reveal";

export default async function SalonPage({ params }: { params: { slug: string } }) {
  const salon = await getSalonBySlug(params.slug);

  if (!salon) {
    notFound();
  }

  return (
    <main>
      <Header />
      <SalonHero salon={salon} />
      <div className="mx-auto max-w-6xl px-6 py-8 sm:px-11">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
          <div>
            <Reveal>
              <ServiceList services={salon.services} />
            </Reveal>
            {salon.staff.length > 0 && (
              <Reveal>
                <StaffList staff={salon.staff} />
              </Reveal>
            )}
            {salon.gallery.length > 0 && (
              <Reveal>
                <GalleryGrid items={salon.gallery} />
              </Reveal>
            )}
            <Reveal>
              <AboutContact content={salon.content} />
            </Reveal>
            <BookingForm salon={salon} />
          </div>
          <SalonRightRail salon={salon} />
        </div>
      </div>
      <Footer />
    </main>
  );
}
```

- [ ] **Step 3: Verify types and build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/SalonRightRail.tsx frontend/app/salons/[slug]/page.tsx
git commit -m "feat: wire two-column salon profile layout with right-rail summary"
```

---

### Task 10: Manual verification (no code)

- [ ] **Step 1:** Start the backend (`cd backend && source .venv/bin/activate && uvicorn app.main:app --port 8002`) and frontend (`cd frontend && npm run dev`) against seeded data.
- [ ] **Step 2:** On the landing page, submit the search bar with a service name and a city; confirm navigation to `/search?service=...&location=...&date=today` with correctly filtered results.
- [ ] **Step 3:** On `/search`, drag the price-range sliders and toggle a service-type pill; confirm the result list and count line update immediately, and that "Clear all" resets both facets.
- [ ] **Step 4:** Search for a service/location combination with zero matches; confirm the `EmptyState` renders.
- [ ] **Step 5:** Visit a salon's profile page; confirm the restyled gallery grid, badge, Save/Book now buttons, services table, team cards, gallery, about/contact cards, and sticky right-rail summary all render correctly, and that both "Book now" (hero) and "Continue to booking" (right rail) scroll to the existing `BookingForm`.
- [ ] **Step 6:** Confirm the landing page's "Featured this week" grid shows the full salon list with no live-filtering as you type in the search bar.
- [ ] **Step 7:** Resize to mobile width (375px) and repeat steps 2–6, confirming responsive layout holds (search results stack the filter sidebar above results, profile page stacks the right rail below the main column).

