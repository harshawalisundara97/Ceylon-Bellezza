# Public Marketplace Frontend Redesign ("Elegant Boutique") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the existing public marketplace frontend (homepage + salon detail page, built in Plan 4a) into a distinctive "Elegant Boutique" visual identity — warm ivory/terracotta palette, serif+sans typography pairing, full-bleed photo heroes — with zero changes to data fetching, routing, or the public API.

**Architecture:** This is a styling and markup pass over existing components. Task 1 establishes the shared design tokens (Tailwind color/font config) that every later task consumes. Tasks 2 and 3 restyle the homepage and salon detail page respectively, each independently verifiable against the already-seeded demo data (`glamour-lk`, `the-gents-room`) from Plan 4a.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Framer Motion (all already installed — no new dependencies except a Google Font loaded via `next/font/google`, which is a build-time asset, not an npm package).

## Global Constraints

- No new npm dependencies. `next/font/google` ships with Next.js 14 already installed — do not add a font package.
- No changes to `frontend/lib/api.ts`, `frontend/lib/types.ts`, or any Server/Client Component boundary. Every component's props signature stays identical — this is a `className`/markup-only change in every task.
- No changes to the backend, the public API, or the database — this plan is `frontend/`-only.
- Color tokens (exact hex values, from the design spec):
  - `ivory`: `#faf6f0` (page background)
  - `ink`: `#2b241d` (primary text/headings)
  - `taupe`: `#8a7c6c` (secondary/meta text)
  - `terracotta.DEFAULT`: `#a6784f` (accent: badges, prices, links, focus rings)
  - `terracotta.light`: `#e8c9a0` (accent on dark/photo backgrounds only)
  - `hairline`: `#e8ddd0` (borders/dividers)
- Font: `Playfair Display` (serif, via `next/font/google`) for headings/salon names/section titles; existing system sans-serif stack stays for body text and UI chrome.
- Full-bleed photo hero gradient overlay (both homepage and salon page): `linear-gradient(180deg, rgba(20,15,10,0.15) 0%, rgba(20,15,10,0.55) 100%)`.
- Frontend has no automated test suite by design (established in Plan 4a's spec — "full frontend test coverage is not a goal"). Verification in every task is manual: run the dev server against the already-seeded demo data and confirm via `curl`/grep and/or the browser preview, matching Plan 4a's own precedent.
- Postgres for local verification runs on **port 5433** (not the default 5432 — see `backend/.env`, already configured from Plan 4a's implementation). Demo salons `glamour-lk` and `the-gents-room` are already seeded; do not re-run the seed script.

---

## File Structure

```
frontend/
  tailwind.config.ts          # + ivory/ink/taupe/terracotta/hairline tokens, fontFamily.serif
  app/
    layout.tsx                  # + next/font/google Playfair Display, body bg-ivory text-ink
    page.tsx                      # full-bleed hero (replaces bg-brand/5 text hero)
    salons/[slug]/
      not-found.tsx                  # restyled to ivory/serif palette
  components/
    SalonCard.tsx                # hairline border, terracotta badge, serif name, image-zoom hover
    SearchBar.tsx                  # restyled pill input, terracotta focus ring
    SalonDirectory.tsx               # search bar repositioned to overlap hero
    SalonHero.tsx                      # full-bleed photo hero (was: photo strip + white panel)
    ServiceList.tsx                      # serif category labels, terracotta divider/price
    StaffList.tsx                          # serif names, hairline-bordered portraits
    GalleryGrid.tsx                          # alternating aspect ratios (masonry-ish), hairline border
    AboutContact.tsx                           # two-column desktop layout, serif headers
```

No files are created or deleted — every file in this plan already exists from Plan 4a.

---

### Task 1: Design tokens — palette and typography

**Files:**
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/app/layout.tsx`

**Interfaces:**
- Consumes: nothing (foundational task).
- Produces: Tailwind utility classes `bg-ivory`, `text-ink`, `text-taupe`, `bg-terracotta`/`text-terracotta`/`border-terracotta` (+ `-light` and opacity variants like `terracotta/10`), `border-hairline`/`divide-hairline`, and `font-serif` — every later task in this plan uses these class names verbatim.

- [ ] **Step 1: Update `frontend/tailwind.config.ts` with the new palette and font token**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ivory: "#faf6f0",
        ink: "#2b241d",
        taupe: "#8a7c6c",
        terracotta: {
          DEFAULT: "#a6784f",
          light: "#e8c9a0",
        },
        hairline: "#e8ddd0",
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Update `frontend/app/layout.tsx` to load Playfair Display and apply the ivory/ink body theme**

```tsx
import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ceylon Bellezza",
  description: "Find and book the best salons near you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={playfair.variable}>
      <body className="min-h-screen bg-ivory text-ink">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Verify the build succeeds with the new config**

```bash
cd frontend && npm run build
```

Expected: build completes with no Tailwind config errors and no font-loading errors (the `Playfair_Display` font is fetched and self-hosted by Next.js at build time — this requires network access, which is available in this environment).

- [ ] **Step 4: Verify the token classes render in dev**

```bash
cd frontend && npm run dev &
sleep 5
curl -s http://localhost:3000 | grep -o 'bg-ivory'
curl -s http://localhost:3000 | grep -o 'text-ink'
kill %1
```

Expected: both greps find a match (the class names appear in the server-rendered HTML's `class` attributes on `<body>`), confirming the new config compiled and applied.

- [ ] **Step 5: Commit**

```bash
git add frontend/tailwind.config.ts frontend/app/layout.tsx
git commit -m "feat: add Elegant Boutique design tokens (palette + Playfair Display)"
```

---

### Task 2: Homepage — full-bleed hero and restyled directory

**Files:**
- Modify: `frontend/components/SalonCard.tsx`
- Modify: `frontend/components/SearchBar.tsx`
- Modify: `frontend/components/SalonDirectory.tsx`
- Modify: `frontend/app/page.tsx`

**Interfaces:**
- Consumes: Task 1's Tailwind tokens (`bg-ivory`, `text-ink`, `text-taupe`, `terracotta` family, `hairline`, `font-serif`).
- Produces: no new props or exports — `SalonCard`, `SearchBar`, `SalonDirectory` keep their exact existing prop signatures (`{ salon: SalonSummary }`, `{ value, onChange }`, `{ initialSalons: SalonSummary[] }`) so Task 3 (which doesn't touch these) and any future task can rely on them unchanged.

- [ ] **Step 1: Restyle `frontend/components/SalonCard.tsx`**

```tsx
import Link from "next/link";
import { motion } from "framer-motion";
import { SalonSummary } from "@/lib/types";

const DEFAULT_COVER_IMAGE = "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80";

function coverImage(salon: SalonSummary): string {
  const settings = salon.template_settings as { hero_image?: string };
  return settings.hero_image ?? DEFAULT_COVER_IMAGE;
}

export default function SalonCard({ salon }: { salon: SalonSummary }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="group overflow-hidden rounded-lg border border-hairline bg-white transition-shadow duration-300 hover:shadow-xl"
    >
      <Link href={`/salons/${salon.slug}`}>
        <div className="h-48 w-full overflow-hidden">
          <img
            src={coverImage(salon)}
            alt={salon.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="p-4">
          <span className="inline-block rounded-full bg-terracotta/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-terracotta">
            {salon.category}
          </span>
          <h3 className="mt-2 font-serif text-lg text-ink">{salon.name}</h3>
          <p className="text-sm text-taupe">{salon.city}</p>
        </div>
      </Link>
    </motion.div>
  );
}
```

- [ ] **Step 2: Restyle `frontend/components/SearchBar.tsx`**

```tsx
"use client";

export default function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search by salon name or city..."
      className="w-full max-w-md rounded-full border border-hairline bg-white px-5 py-3 text-sm text-ink shadow-lg shadow-black/5 focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
    />
  );
}
```

- [ ] **Step 3: Restyle `frontend/components/SalonDirectory.tsx` — reposition the search bar to overlap the hero, restyle empty state**

```tsx
"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { SalonSummary } from "@/lib/types";
import SalonCard from "./SalonCard";
import SearchBar from "./SearchBar";

export default function SalonDirectory({ initialSalons }: { initialSalons: SalonSummary[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return initialSalons;
    return initialSalons.filter(
      (salon) => salon.name.toLowerCase().includes(normalized) || salon.city.toLowerCase().includes(normalized)
    );
  }, [initialSalons, query]);

  return (
    <div>
      <div className="relative z-10 mt-4 flex justify-center px-6 sm:-mt-8">
        <SearchBar value={query} onChange={setQuery} />
      </div>
      {filtered.length === 0 ? (
        <p className="py-16 text-center text-taupe">
          {initialSalons.length === 0 ? "No salons yet — check back soon." : "No salons match your search."}
        </p>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          className="grid grid-cols-1 gap-6 px-6 pb-16 pt-10 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filtered.map((salon) => (
            <motion.div key={salon.id} variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
              <SalonCard salon={salon} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
```

Note the responsive overlap: `mt-4` (normal spacing below the hero) on mobile, `sm:-mt-8` (pulls the search bar up to overlap the hero's bottom edge) from the `sm` breakpoint up — this is the mobile-specific adjustment the design spec calls for, so the pill doesn't look cramped on narrow viewports.

- [ ] **Step 4: Replace the hero in `frontend/app/page.tsx` with a full-bleed photo hero**

```tsx
import { getSalons } from "@/lib/api";
import SalonDirectory from "@/components/SalonDirectory";

const HERO_IMAGE = "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&q=80";

export default async function HomePage() {
  const salons = await getSalons();

  return (
    <main>
      <section
        className="flex h-[420px] flex-col items-center justify-center bg-cover bg-center px-6 text-center"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(20,15,10,0.15) 0%, rgba(20,15,10,0.55) 100%), url('${HERO_IMAGE}')`,
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-terracotta-light">Ceylon Bellezza</p>
        <h1 className="mt-3 font-serif text-4xl text-white sm:text-5xl">Find your next favourite salon</h1>
        <p className="mt-3 max-w-md text-base text-white/80">Curated hair, beauty &amp; grooming across Sri Lanka</p>
      </section>
      <SalonDirectory initialSalons={salons} />
    </main>
  );
}
```

- [ ] **Step 5: Verify against the seeded data**

```bash
pg_isready -h localhost -p 5433 || brew services start postgresql@15
cd backend && .venv/bin/uvicorn app.main:app --port 8000 &
cd ../frontend && npm run dev &
sleep 6
curl -s http://localhost:3000 | grep -o "Find your next favourite salon"
curl -s http://localhost:3000 | grep -o "Glamour Salon Colombo"
curl -s http://localhost:3000 | grep -o "font-serif"
kill %1 %2
```

Expected: all three greps find a match — the hero headline renders, the seeded salon name still renders (confirms `SalonDirectory`/`SalonCard` still work end-to-end against the real API), and the `font-serif` class is present (confirms the typography change applied). Follow up with a browser screenshot to confirm the full-bleed hero, overlapping search pill, and card hover zoom all look correct — this is a visual redesign, so a rendered screenshot is the real acceptance check, not just grep.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/SalonCard.tsx frontend/components/SearchBar.tsx frontend/components/SalonDirectory.tsx frontend/app/page.tsx
git commit -m "feat: redesign homepage with full-bleed hero and boutique styling"
```

---

### Task 3: Salon detail page — full-bleed hero and restyled sections

**Files:**
- Modify: `frontend/components/SalonHero.tsx`
- Modify: `frontend/components/ServiceList.tsx`
- Modify: `frontend/components/StaffList.tsx`
- Modify: `frontend/components/GalleryGrid.tsx`
- Modify: `frontend/components/AboutContact.tsx`
- Modify: `frontend/app/salons/[slug]/not-found.tsx`

**Interfaces:**
- Consumes: Task 1's Tailwind tokens. `frontend/app/salons/[slug]/page.tsx` is unchanged — it composes these five components exactly as before (`SalonHero`, `ServiceList`, `StaffList`, `GalleryGrid`, `AboutContact`, all with their existing prop signatures), and inherits the `bg-ivory`/`text-ink` body theme from Task 1's `layout.tsx` automatically, so no edit is needed there.
- Produces: no new props or exports — every component keeps its exact existing signature.

- [ ] **Step 1: Restyle `frontend/components/SalonHero.tsx` as a full-bleed photo hero**

```tsx
import { SalonDetail } from "@/lib/types";

const DEFAULT_HERO_IMAGE = "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&q=80";

function coverImage(salon: SalonDetail): string {
  const settings = salon.template_settings as { hero_image?: string };
  return settings.hero_image ?? DEFAULT_HERO_IMAGE;
}

export default function SalonHero({ salon }: { salon: SalonDetail }) {
  return (
    <section
      className="flex h-[420px] flex-col items-center justify-center bg-cover bg-center px-6 text-center"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(20,15,10,0.15) 0%, rgba(20,15,10,0.55) 100%), url('${coverImage(salon)}')`,
      }}
    >
      <span className="rounded-full border border-white/40 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white">
        {salon.category}
      </span>
      <h1 className="mt-3 font-serif text-4xl text-white sm:text-5xl">{salon.name}</h1>
      <p className="mt-1 text-white/80">{salon.city}</p>
      <button
        disabled
        title="Coming soon"
        className="mt-6 cursor-not-allowed rounded-full border border-white/60 px-6 py-3 text-sm font-medium text-white/70"
      >
        Book Appointment
      </button>
    </section>
  );
}
```

- [ ] **Step 2: Restyle `frontend/components/ServiceList.tsx`**

```tsx
import { Service } from "@/lib/types";

function groupByCategory(services: Service[]): Record<string, Service[]> {
  return services.reduce<Record<string, Service[]>>((groups, service) => {
    (groups[service.category] ??= []).push(service);
    return groups;
  }, {});
}

export default function ServiceList({ services }: { services: Service[] }) {
  const grouped = groupByCategory(services);

  return (
    <section className="bg-white px-6 py-12">
      <h2 className="font-serif text-2xl text-ink">Services</h2>
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="mt-8">
          <h3 className="border-b border-terracotta/30 pb-2 font-serif text-sm uppercase tracking-widest text-terracotta">
            {category}
          </h3>
          <ul className="mt-3 divide-y divide-hairline">
            {items.map((service) => (
              <li key={service.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-ink">{service.name}</p>
                  <p className="text-sm text-taupe">{service.duration_minutes} min</p>
                </div>
                <p className="font-serif font-semibold text-terracotta">Rs. {service.price.toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 3: Restyle `frontend/components/StaffList.tsx`**

```tsx
import { Staff } from "@/lib/types";

const DEFAULT_STAFF_PHOTO = "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80";

export default function StaffList({ staff }: { staff: Staff[] }) {
  return (
    <section className="bg-ivory px-6 py-12">
      <h2 className="font-serif text-2xl text-ink">Our Team</h2>
      <div className="mt-8 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
        {staff.map((member) => (
          <div key={member.id} className="text-center">
            <img
              src={member.photo_url ?? DEFAULT_STAFF_PHOTO}
              alt={member.name}
              className="mx-auto h-24 w-24 rounded-full border border-hairline object-cover"
            />
            <p className="mt-3 font-serif text-ink">{member.name}</p>
            <p className="text-sm text-taupe">{member.bio}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Restyle `frontend/components/GalleryGrid.tsx` with an alternating aspect-ratio pattern**

```tsx
import { GalleryItem } from "@/lib/types";

export default function GalleryGrid({ items }: { items: GalleryItem[] }) {
  return (
    <section className="bg-white px-6 py-12">
      <h2 className="font-serif text-2xl text-ink">Gallery</h2>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => (
          <img
            key={item.id}
            src={item.image_url}
            alt={item.caption || "Gallery photo"}
            className={`w-full rounded-lg border border-hairline object-cover ${
              index % 3 === 0 ? "aspect-[3/4]" : "aspect-square"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Restyle `frontend/components/AboutContact.tsx` with a two-column desktop layout**

```tsx
export default function AboutContact({ content }: { content: Record<string, string> }) {
  if (!content.about_us && !content.contact_info) {
    return null;
  }

  return (
    <section className="bg-ivory px-6 py-12">
      <div className="grid gap-8 md:grid-cols-2">
        {content.about_us && (
          <div>
            <h2 className="font-serif text-2xl text-ink">About Us</h2>
            <p className="mt-3 text-taupe">{content.about_us}</p>
          </div>
        )}
        {content.contact_info && (
          <div>
            <h2 className="font-serif text-2xl text-ink">Contact</h2>
            <p className="mt-3 text-taupe">{content.contact_info}</p>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Restyle `frontend/app/salons/[slug]/not-found.tsx`**

```tsx
export default function SalonNotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center bg-ivory px-6 text-center">
      <h1 className="font-serif text-3xl text-ink">Salon not found</h1>
      <p className="mt-3 text-taupe">This salon doesn&apos;t exist or isn&apos;t available right now.</p>
    </main>
  );
}
```

- [ ] **Step 7: Verify against the seeded data**

```bash
pg_isready -h localhost -p 5433 || brew services start postgresql@15
cd backend && .venv/bin/uvicorn app.main:app --port 8000 &
cd ../frontend && npm run dev &
sleep 6
curl -s http://localhost:3000/salons/glamour-lk | grep -o "Women's Haircut"
curl -s http://localhost:3000/salons/glamour-lk | grep -o "Nadeesha Perera"
curl -s http://localhost:3000/salons/glamour-lk | grep -o "font-serif"
curl -s http://localhost:3000/salons/does-not-exist | grep -o "Salon not found"
kill %1 %2
```

Expected: all four greps find a match — services and staff still render (confirms the redesign didn't break data rendering), `font-serif` is present, and the restyled not-found page renders for an unknown slug. Follow up with a browser screenshot of the salon page (hero, services, staff, gallery, about/contact) to confirm the visual result — this is a visual redesign, so the screenshot is the real acceptance check.

- [ ] **Step 8: Commit**

```bash
git add frontend/components/SalonHero.tsx frontend/components/ServiceList.tsx frontend/components/StaffList.tsx frontend/components/GalleryGrid.tsx frontend/components/AboutContact.tsx frontend/app/salons/[slug]/not-found.tsx
git commit -m "feat: redesign salon detail page with full-bleed hero and boutique styling"
```

---

## Self-Review Notes

- **Spec coverage**: palette/typography tokens (Task 1), homepage full-bleed hero + overlapping responsive search bar + restyled cards/empty-state (Task 2), salon detail page full-bleed hero + restyled services/staff/gallery/about-contact/not-found (Task 3). The design spec's "Out of Scope" items (booking UI, image upload, Maps, admin dashboards, new animation libraries, visual regression tooling) are untouched by this plan. `app/salons/[slug]/page.tsx` needed no edit — confirmed it only composes the five restyled components and inherits the body theme, so it's correctly omitted from Task 3's file list rather than listed with a no-op step. `app/error.tsx` is intentionally not restyled — it is outside the design spec's explicit component-scope list (added in a prior plan's final review fix, not part of the original Plan 4a Tasks 4/5 this spec is redesigning).
- **Placeholder scan**: no TBD/TODO; every step has complete, runnable code.
- **Type consistency**: no component's prop signature changes anywhere in this plan (`SalonCard({ salon })`, `SearchBar({ value, onChange })`, `SalonDirectory({ initialSalons })`, `SalonHero({ salon })`, `ServiceList({ services })`, `StaffList({ staff })`, `GalleryGrid({ items })`, `AboutContact({ content })` are all identical to Plan 4a) — Task 2 and Task 3 are independently orderable/reviewable since neither changes an interface the other depends on.
