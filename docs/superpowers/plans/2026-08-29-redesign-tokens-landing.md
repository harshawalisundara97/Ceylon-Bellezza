# Redesign Phase 1: Design Tokens + Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Phase 0's teal design system with the CeylonBellezza mockup's cream/forest/emerald/champagne palette and Cormorant Garamond/DM Sans typography, and rebuild the customer landing page (`frontend/app/page.tsx`) to match the mockup, desktop and mobile.

**Architecture:** Same CSS-custom-properties + Tailwind mechanism as Phase 0, reusing existing token key names with new hex values so every page re-themes automatically; two new shared components (`Header`, `Footer`); `Hero`/`SalonCard` restyled in place; a new `SearchBarCard` replaces the plain `SearchBar` inside `SalonDirectory`; one additive `starting_price` field on the existing public salon-list endpoint.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic (backend); Next.js 14 App Router, TypeScript, Tailwind, Framer Motion (frontend). One new dependency: `lucide-react` (icons), per the design handoff's explicit instruction — the sole deliberate exception to this project's usual no-new-dependency convention.

**Spec:** `docs/superpowers/specs/2026-08-29-redesign-tokens-landing-design.md`

## Global Constraints

- Same token key names as Phase 0 (`bg`, `surface`, `ink`, `taupe`, `hairline`, `accent`, `accent-light`, `danger`), new hex values — do not rename keys, every existing page's classes must keep resolving.
- New tokens added, not renamed: `success`, `champagne`, `champagne-light`, `charcoal`, `pill` (radius), `floating` (shadow).
- `lucide-react` is the only new npm dependency allowed this phase.
- No other pages retrofitted this phase (admin/platform/salon-detail) — they inherit new colors automatically via the same token keys, but their layout/copy is untouched.
- No search-results page, no working Location/Date search fields, no rating/next-slot data — Service field only drives the existing client-side name/city filter; Location/Date render but are inert.
- No customer accounts — "Sign in" links to `/admin/login`; nav/tab items with no real destination link to `/` and are visually present but not functionally distinct.
- No automated frontend tests exist in this repo (established convention) — frontend verification is `tsc --noEmit` plus a manual browser check described in each task. Backend gets real `pytest` coverage.
- `starting_price` is nullable; frontend renders "Price on request" when `null`, never collapses the card layout.
- Exact hex/token values are specified below — do not invent alternates.

---

### Task 1: Backend — `starting_price` on the public salon list

**Files:**
- Modify: `backend/app/schemas/public.py`
- Modify: `backend/app/routers/public.py`
- Test: `backend/tests/test_public.py` (append)

**Interfaces:**
- Produces: `PublicSalonSummary.starting_price: float | None`, populated in the `GET /salons` response.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_public.py`:

```python
def test_list_active_salons_includes_starting_price(client, db_session):
    salon = Salon(slug="price-salon", name="Price Salon", category="unisex", address="Addr", city="Colombo", status="active")
    db_session.add(salon)
    db_session.commit()
    db_session.add(Service(salon_id=salon.id, name="Haircut", category="hair", price=2500.0, duration_minutes=30))
    db_session.add(Service(salon_id=salon.id, name="Colour", category="hair", price=6500.0, duration_minutes=90))
    db_session.commit()

    response = client.get("/salons")

    assert response.status_code == 200
    body = response.json()
    assert body[0]["starting_price"] == 2500.0


def test_list_active_salons_starting_price_null_with_no_services(client, db_session):
    salon = Salon(slug="no-services", name="No Services", category="unisex", address="Addr", city="Colombo", status="active")
    db_session.add(salon)
    db_session.commit()

    response = client.get("/salons")

    assert response.status_code == 200
    body = response.json()
    assert body[0]["starting_price"] is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && source .venv/bin/activate && pytest tests/test_public.py -k "starting_price" -v`
Expected: both FAIL — `PublicSalonSummary` has no `starting_price` field yet, so the response body won't contain the key (`body[0]["starting_price"]` raises `KeyError`).

- [ ] **Step 3: Add the field to the schema**

In `backend/app/schemas/public.py`, add `starting_price: float | None = None` to `PublicSalonSummary`, right after `template_settings: dict`.

- [ ] **Step 4: Compute it in the router**

Replace `list_active_salons` in `backend/app/routers/public.py` with:

```python
@router.get("", response_model=list[PublicSalonSummary])
def list_active_salons(db: Session = Depends(get_db)):
    price_subquery = (
        db.query(Service.salon_id, func.min(Service.price).label("starting_price"))
        .group_by(Service.salon_id)
        .subquery()
    )
    rows = (
        db.query(Salon, price_subquery.c.starting_price)
        .outerjoin(price_subquery, Salon.id == price_subquery.c.salon_id)
        .filter(Salon.status == "active")
        .all()
    )
    return [
        PublicSalonSummary(
            **PublicSalonSummary.model_validate(salon).model_dump(exclude={"starting_price"}),
            starting_price=float(starting_price) if starting_price is not None else None,
        )
        for salon, starting_price in rows
    ]
```

Add `from sqlalchemy import func` to the imports at the top of the file.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && source .venv/bin/activate && pytest tests/test_public.py -v`
Expected: all PASS, including the two new tests and every pre-existing test in this file (in particular `test_list_active_salons_excludes_suspended` must still pass unchanged).

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && source .venv/bin/activate && pytest -v`
Expected: all PASS, no regressions.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/public.py backend/app/routers/public.py backend/tests/test_public.py
git commit -m "feat: add starting_price to public salon list endpoint"
```

---

### Task 2: Design tokens, fonts, and the `lucide-react` dependency

**Files:**
- Modify: `frontend/app/globals.css`
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/package.json` (via `npm install`)

**Interfaces:**
- Produces: Tailwind color keys `bg`/`surface`/`ink`/`taupe`/`hairline`/`accent`/`accent-light`/`danger` repointed to new hex values; new color keys `success`/`champagne`/`champagne-light`/`charcoal`; new `borderRadius.pill`; new `boxShadow.floating`; `fontFamily.serif` repointed to Cormorant Garamond; new `fontFamily.sans` set to DM Sans. `lucide-react` importable from any component.

- [ ] **Step 1: Install the new dependency**

Run: `cd frontend && npm install lucide-react`
Expected: `frontend/package.json` gains `"lucide-react"` under `dependencies`, `frontend/package-lock.json` updates.

- [ ] **Step 2: Replace the design tokens**

Replace the full contents of `frontend/app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Colors — cream/forest/emerald/champagne */
  --color-bg: #FBF8F3;
  --color-surface: #F7F3EB;
  --color-ink: #1E2422;
  --color-taupe: #6B7570;
  --color-hairline: #EFE9DE;
  --color-accent: #0E3B32;
  --color-accent-light: #E8F0ED;
  --color-danger: #A6412F;
  --color-success: #2F7D5F;
  --color-champagne: #C9A34E;
  --color-champagne-light: #F3E9D2;
  --color-charcoal: #1E2422;

  /* Spacing/radii/shadows */
  --radius-sm: 0.75rem;
  --radius-md: 1rem;
  --radius-lg: 1.25rem;
  --radius-xl: 1.5rem;
  --radius-pill: 999px;
  --shadow-sm: 0 4px 14px rgba(30, 36, 34, 0.07);
  --shadow-md: 0 14px 34px rgba(30, 36, 34, 0.13);
  --shadow-lg: 0 22px 60px rgba(30, 36, 34, 0.16);
  --shadow-floating: 0 16px 44px rgba(30, 36, 34, 0.12);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 3: Point Tailwind config at the new tokens**

Replace the full contents of `frontend/tailwind.config.ts` with:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        ink: "var(--color-ink)",
        taupe: "var(--color-taupe)",
        hairline: "var(--color-hairline)",
        accent: {
          DEFAULT: "var(--color-accent)",
          light: "var(--color-accent-light)",
        },
        danger: "var(--color-danger)",
        success: "var(--color-success)",
        champagne: {
          DEFAULT: "var(--color-champagne)",
          light: "var(--color-champagne-light)",
        },
        charcoal: "var(--color-charcoal)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        floating: "var(--shadow-floating)",
      },
      fontFamily: {
        serif: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 4: Swap fonts**

Replace the full contents of `frontend/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

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

export const metadata: Metadata = {
  title: "Ceylon Bellezza",
  description: "Find and book the best salons near you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${dmSans.variable}`}>
      <body className="min-h-screen bg-bg font-sans text-ink"><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
```

Note: `font-sans` is added to the `<body>` className so DM Sans becomes the default body font everywhere (previously the app relied on Tailwind's default sans stack with no override).

- [ ] **Step 5: Verify it compiles and builds**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && rm -rf .next && npm run build 2>&1 | tail -30`
Expected: build succeeds (this task only touches tokens/fonts/config, not component markup, so no broken-class warnings are expected — every existing class reference still resolves to a token, just a different color).

- [ ] **Step 6: Commit**

```bash
git add frontend/app/globals.css frontend/tailwind.config.ts frontend/app/layout.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: replace design tokens with cream/forest/emerald/champagne palette and Cormorant Garamond/DM Sans fonts"
```

---

### Task 3: `formatCurrency` helper + `Header` + `Footer` components

**Files:**
- Create: `frontend/lib/format.ts`
- Create: `frontend/components/Header.tsx`
- Create: `frontend/components/Footer.tsx`

**Interfaces:**
- Consumes: `champagne`/`accent`/`charcoal`/`hairline` color tokens from Task 2.
- Produces: `formatCurrency(amount: number): string` from `frontend/lib/format.ts`, exported for Task 6 to import; `Header` and `Footer` default exports, not yet wired into any page (Task 7 wires them).

- [ ] **Step 1: Write `formatCurrency`**

Create `frontend/lib/format.ts`:

```ts
export function formatCurrency(amount: number): string {
  const rounded = Math.round(amount);
  const withSeparators = rounded.toLocaleString("en-US");
  return `Rs. ${withSeparators}`;
}
```

- [ ] **Step 2: Create `Header.tsx`**

Create `frontend/components/Header.tsx`:

```tsx
import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "Salons" },
  { href: "/", label: "Services" },
  { href: "/", label: "Offers" },
  { href: "/", label: "For business" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-bg px-11 py-5">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="font-serif text-[25px] font-bold text-ink">
          Ceylon<span className="text-champagne">.lk</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} href={link.href} className="text-[15px] text-taupe hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-6">
          <Link href="/join" className="hidden text-[15px] text-taupe hover:text-ink sm:inline">
            List your salon
          </Link>
          <Link
            href="/admin/login"
            className="rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90"
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Create `Footer.tsx`**

Create `frontend/components/Footer.tsx`:

```tsx
import Link from "next/link";

const FOOTER_COLUMNS = [
  { heading: "Discover", links: ["Browse salons", "Popular services", "Gift cards"] },
  { heading: "For salons", links: ["List your salon", "Owner login", "Pricing"] },
  { heading: "Company", links: ["About us", "Careers", "Contact"] },
];

export default function Footer() {
  return (
    <footer className="bg-charcoal px-11 py-14 text-white sm:px-24 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="font-serif text-2xl font-bold">
            Ceylon<span className="text-champagne">.lk</span>
          </p>
          <p className="mt-3 max-w-xs text-sm text-white/70">
            Curated hair, beauty &amp; grooming across Sri Lanka.
          </p>
          <div className="mt-5 flex gap-2">
            <span className="rounded-pill bg-white/10 px-3 py-1 text-xs">English</span>
            <span className="rounded-pill bg-white/10 px-3 py-1 text-xs opacity-50">සිංහල</span>
            <span className="rounded-pill bg-white/10 px-3 py-1 text-xs opacity-50">தமிழ்</span>
          </div>
        </div>
        {FOOTER_COLUMNS.map((column) => (
          <div key={column.heading}>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-champagne">{column.heading}</p>
            <ul className="mt-4 flex flex-col gap-3">
              {column.links.map((label) => (
                <li key={label}>
                  <Link href="/" className="text-sm text-white/60 hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-14 max-w-6xl border-t border-white/10 pt-6 text-xs text-white/50">
        <p>© {new Date().getFullYear()} Ceylon Bellezza. Payments by PayHere · Visa · Mastercard · eZ Cash</p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/format.ts frontend/components/Header.tsx frontend/components/Footer.tsx
git commit -m "feat: add formatCurrency helper and Header/Footer components"
```

---

### Task 4: Restyle `Hero.tsx`

**Files:**
- Modify: `frontend/components/Hero.tsx`

**Interfaces:**
- Consumes: `fadeInUp` from `frontend/lib/motion.ts` (unchanged, already imported today); new tokens from Task 2.

- [ ] **Step 1: Replace the full contents of `Hero.tsx`**

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/motion";

const HERO_IMAGE = "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&q=80";

export default function Hero() {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="relative mx-4 mt-4 h-[300px] overflow-hidden rounded-xl bg-cover bg-center sm:mx-11 sm:mt-6 sm:h-[520px]"
      style={{ backgroundImage: `url('${HERO_IMAGE}')` }}
    >
      <div
        className="absolute inset-0 sm:[background:linear-gradient(102deg,rgba(14,59,50,.92)_0%,rgba(14,59,50,.72)_44%,rgba(14,59,50,.12)_78%)]"
        style={{ background: "linear-gradient(180deg, rgba(14,59,50,.55) 0%, rgba(14,59,50,.9) 100%)" }}
      />
      <div className="relative flex h-full max-w-[600px] flex-col justify-end p-6 sm:justify-center sm:p-16">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-champagne">
          Colombo · Kandy · Galle · Negombo
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.04] text-white sm:text-[62px]">
          Find your next favourite salon
        </h1>
        <p className="mt-3 max-w-[470px] text-base text-white/82 sm:text-lg">
          Curated hair, beauty &amp; grooming across Sri Lanka
        </p>
        <Link
          href="/join"
          className="mt-4 w-fit text-sm text-white underline underline-offset-4 hover:text-champagne"
        >
          List Your Salon
        </Link>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/Hero.tsx
git commit -m "feat: restyle Hero to the new design tokens"
```

---

### Task 5: `SearchBarCard` + `SalonDirectory` update

**Files:**
- Create: `frontend/components/SearchBarCard.tsx`
- Modify: `frontend/components/SalonDirectory.tsx`

**Interfaces:**
- Consumes: new tokens from Task 2; `staggerContainer` from `frontend/lib/motion.ts` (already used today, unchanged).
- Produces: `SearchBarCard({ value, onChange }: { value: string; onChange: (value: string) => void })`, default export — same prop contract as the `SearchBar` it replaces, so `SalonDirectory`'s existing `query`/`setQuery` state wiring is unchanged.

- [ ] **Step 1: Create `SearchBarCard.tsx`**

```tsx
"use client";

import { Search, MapPin, Calendar } from "lucide-react";

interface SearchBarCardProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBarCard({ value, onChange }: SearchBarCardProps) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-floating sm:grid sm:grid-cols-[1.3fr_1fr_1fr_auto] sm:items-center sm:gap-3.5 sm:p-[18px]">
      <div className="border-hairline py-2 sm:border-r sm:pr-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-taupe">Service</p>
        <div className="mt-1 flex items-center gap-2">
          <Search size={18} className="text-champagne" strokeWidth={2.75} />
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Search by salon name or city..."
            className="min-h-[44px] w-full bg-transparent text-sm text-ink placeholder:text-taupe focus:outline-none"
          />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-hairline py-2 sm:col-span-2 sm:mt-0 sm:grid sm:grid-cols-2 sm:gap-0 sm:border-r sm:px-3.5">
        <div className="border-hairline sm:border-r sm:pr-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-taupe">Location</p>
          <div className="mt-1 flex min-h-[44px] items-center gap-2 opacity-60">
            <MapPin size={18} className="text-champagne" strokeWidth={2.75} />
            <span className="text-sm text-ink">Anywhere</span>
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
        type="button"
        className="mt-3 min-h-[44px] w-full rounded-pill bg-champagne px-6 text-sm font-bold text-ink sm:mt-0 sm:h-14 sm:w-auto sm:min-h-0"
      >
        Search salons
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `SalonDirectory.tsx` and add the Featured heading**

Replace the full contents of `frontend/components/SalonDirectory.tsx` with:

```tsx
"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SalonSummary } from "@/lib/types";
import SalonCard from "./SalonCard";
import SearchBarCard from "./SearchBarCard";
import { staggerContainer } from "@/lib/motion";

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
      <div className="relative z-10 mx-4 -mt-[26px] sm:mx-11 sm:-mt-[58px]">
        <SearchBarCard value={query} onChange={setQuery} />
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

        {filtered.length === 0 ? (
          <p className="py-16 text-center text-taupe">
            {initialSalons.length === 0 ? "No salons yet — check back soon." : "No salons match your search."}
          </p>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="mt-6 grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-4"
          >
            {filtered.map((salon) => (
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

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/SearchBarCard.tsx frontend/components/SalonDirectory.tsx
git commit -m "feat: add SearchBarCard and Featured heading to SalonDirectory"
```

---

### Task 6: Restyle `SalonCard.tsx`

**Files:**
- Modify: `frontend/components/SalonCard.tsx`
- Modify: `frontend/lib/types.ts`

**Interfaces:**
- Consumes: `formatCurrency` from `frontend/lib/format.ts` (Task 3); `SalonSummary.starting_price` (new field this task adds to the type, matching Task 1's backend field).

- [ ] **Step 1: Add `starting_price` to the `SalonSummary` type**

In `frontend/lib/types.ts`, add `starting_price: number | null;` to the `SalonSummary` interface, right after `template_settings: Record<string, unknown>;`.

- [ ] **Step 2: Replace the full contents of `SalonCard.tsx`**

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, MapPin } from "lucide-react";
import { SalonSummary } from "@/lib/types";
import Card from "@/components/ui/Card";
import { formatCurrency } from "@/lib/format";
import { staggerItem, scaleTap, usePrefersReducedMotion } from "@/lib/motion";

const DEFAULT_COVER_IMAGE = "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80";

function coverImage(salon: SalonSummary): string {
  const settings = salon.template_settings as { hero_image?: string };
  return settings.hero_image ?? DEFAULT_COVER_IMAGE;
}

export default function SalonCard({ salon }: { salon: SalonSummary }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <Card
      as={motion.div}
      variants={staggerItem}
      {...scaleTap}
      {...(prefersReducedMotion ? { transition: { duration: 0.01 } } : {})}
      padding={false}
      className="group overflow-hidden transition-shadow duration-300 hover:shadow-md"
    >
      <Link href={`/salons/${salon.slug}`}>
        <div className="relative h-[172px] w-full overflow-hidden">
          <img
            src={coverImage(salon)}
            alt={salon.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <button
            type="button"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-pill bg-white/80 text-charcoal"
            aria-label="Save salon"
            onClick={(event) => event.preventDefault()}
          >
            <Heart size={16} strokeWidth={2.75} />
          </button>
        </div>
        <div className="p-4">
          <span className="inline-block rounded-pill bg-accent-light px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-accent">
            {salon.category}
          </span>
          <h3 className="mt-2 font-serif text-2xl font-semibold text-ink">{salon.name}</h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-taupe">
            <MapPin size={14} strokeWidth={2.75} />
            {salon.city}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-taupe">From</p>
              <p className="text-sm font-semibold text-ink">
                {salon.starting_price !== null ? formatCurrency(salon.starting_price) : "Price on request"}
              </p>
            </div>
          </div>
        </div>
      </Link>
    </Card>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/SalonCard.tsx frontend/lib/types.ts
git commit -m "feat: restyle SalonCard with starting price and new tokens"
```

---

### Task 7: Wire `Header`/`Footer` into `page.tsx`

**Files:**
- Modify: `frontend/app/page.tsx`

**Interfaces:**
- Consumes: `Header` and `Footer` from Task 3.

- [ ] **Step 1: Replace the full contents of `page.tsx`**

```tsx
import { getSalons } from "@/lib/api";
import SalonDirectory from "@/components/SalonDirectory";
import Hero from "@/components/Hero";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default async function HomePage() {
  const salons = await getSalons();

  return (
    <main>
      <Header />
      <Hero />
      <SalonDirectory initialSalons={salons} />
      <Footer />
    </main>
  );
}
```

- [ ] **Step 2: Verify it compiles and builds**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && rm -rf .next && npm run build 2>&1 | tail -30`
Expected: clean build, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat: wire Header and Footer into the landing page"
```

---

### Task 8: Full-project verification pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Backend full suite**

Run: `cd backend && source .venv/bin/activate && pytest -v`
Expected: all tests pass, including Task 1's two new tests.

- [ ] **Step 2: Frontend typecheck and build**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && rm -rf .next && npm run build`
Expected: clean build, exit code 0.

- [ ] **Step 3: Manual browser walkthrough**

Start both dev servers (per `.claude/launch.json`). In the browser, at desktop width (≥1024px):
1. Load `/`. Confirm the cream background, forest/champagne accent colors, Cormorant Garamond headings, and DM Sans body text render (not the old teal/Playfair look).
2. Confirm the sticky header shows the brand mark, nav links, "List your salon", and "Sign in" pill.
3. Confirm the hero renders with the gradient scrim and headline.
4. Confirm the search card overlaps the hero, has three fields with Lucide icons, and the champagne "Search salons" button.
5. Type into the Service field and confirm it still filters the salon grid by name/city (existing behavior preserved).
6. Confirm salon cards show the category tag, name, city, and either a formatted "Rs. X" price or "Price on request".
7. Confirm the footer renders with the charcoal background, brand column, language pills, three link columns, and the bottom bar copy.

Resize to mobile width (390px) and confirm: the hero shrinks to ~300px, the search card stacks (full-width Service field, 2-up Location/Date), and the layout doesn't overflow horizontally anywhere.

No commit for this task — verification only. If any issue is found, fix it in the relevant earlier task's files with a small fixup commit, then re-run this task's steps.
