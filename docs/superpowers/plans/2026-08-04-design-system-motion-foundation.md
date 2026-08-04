# Design System & Motion Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a token-based design system (clean neutral base + teal/mint accent), a shared Framer Motion conventions library, and seven new UI primitives, then retrofit all four existing page groups (public site, salon detail, salon-admin dashboard, platform-admin dashboard) onto them — no backend changes, no layout/structure changes.

**Architecture:** CSS custom properties in `globals.css` consumed by `tailwind.config.ts` (colors/radii/shadows); a new `frontend/lib/motion.ts` exporting typed Framer Motion variants/constants (JS values, since Framer Motion can't consume CSS vars directly); seven new hand-rolled primitives in `frontend/components/ui/` with no new dependency; then a mechanical retrofit pass per page group.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Framer Motion (already a dependency — no version change).

## Global Constraints

- No new npm dependencies (no Radix/Headless UI/MUI) — every new primitive is hand-rolled in the existing `components/ui/` style.
- No backend changes.
- No frontend automated tests exist in this repo (established convention, confirmed across every prior frontend feature) — verification per task is `tsc --noEmit` (must stay clean) plus a manual browser check described in the task. Do not add a test framework.
- Typography unchanged — Playfair Display serif headings stay exactly as configured today.
- Exact hex/token values are specified below — do not invent alternates.
- `prefers-reduced-motion` must be respected by every spring/stagger animation added (via the `usePrefersReducedMotion` hook from Task 2), not just a subset.

---

### Task 1: Design tokens (`globals.css` + `tailwind.config.ts`)

**Files:**
- Modify: `frontend/app/globals.css`
- Modify: `frontend/tailwind.config.ts`

**Interfaces:**
- Produces: Tailwind color keys `bg`, `surface`, `ink`, `taupe`, `hairline`, `accent`, `accent-light`, `danger` (all resolving to CSS custom properties); Tailwind `borderRadius` keys `sm`/`md`/`lg`/`xl`; Tailwind `boxShadow` keys `sm`/`md`/`lg`. The `ivory` and `terracotta` Tailwind color keys are **removed** — Task 6–9 replace every usage.

- [ ] **Step 1: Add CSS custom properties to `globals.css`**

Replace the full contents of `frontend/app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Colors — clean neutral base + teal/mint accent */
  --color-bg: #ffffff;
  --color-surface: #f7f8f7;
  --color-ink: #1f2422;
  --color-taupe: #6b7570;
  --color-hairline: #e2e6e4;
  --color-accent: #0f9b8e;
  --color-accent-light: #cdeee9;
  --color-danger: #dc2626;

  /* Spacing/radii/shadows */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.12);
}
```

- [ ] **Step 2: Point Tailwind config at the new tokens**

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
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
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

- [ ] **Step 3: Verify the build picks up the new config**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors (this step only changes CSS/config, not TS, so this confirms nothing else broke).

Run: `cd frontend && npm run build 2>&1 | tail -30`
Expected: build fails or produces warnings ONLY about missing `terracotta`/`ivory` classes in files not yet touched by this task — that's expected until Tasks 6–9 retrofit those files. Confirm the failure is specifically about unresolved `bg-terracotta`/`text-ivory`-style classes and not a syntax error in `globals.css` or `tailwind.config.ts`.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/globals.css frontend/tailwind.config.ts
git commit -m "feat: add design tokens (clean palette + teal accent, radii, shadows)"
```

---

### Task 2: Motion conventions library

**Files:**
- Create: `frontend/lib/motion.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces (all imported by name in later tasks): `duration: { fast: number; base: number; slow: number }`, `spring: Transition`, `fadeInUp: Variants`, `staggerContainer: Variants`, `staggerItem: Variants`, `scaleTap: { whileHover: object; whileTap: object; transition: Transition }`, `modalOverlay: Variants`, `modalContent: Variants`, `drawerSlide: Variants`, `scrollReveal: { initial: string; whileInView: string; viewport: object }`, `usePrefersReducedMotion(): boolean`.

- [ ] **Step 1: Write the motion library**

Create `frontend/lib/motion.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import type { Transition, Variants } from "framer-motion";

export const duration = { fast: 0.15, base: 0.3, slow: 0.5 };

export const spring: Transition = { type: "spring", stiffness: 300, damping: 20 };

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.base } },
};

export const staggerContainer: Variants = {
  visible: { transition: { staggerChildren: 0.08 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export const scaleTap = {
  whileHover: { scale: 1.03 },
  whileTap: { scale: 0.97 },
  transition: spring,
};

export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: spring },
};

export const drawerSlide: Variants = {
  hidden: { x: "100%" },
  visible: { x: 0, transition: spring },
};

export const scrollReveal = {
  initial: "hidden",
  whileInView: "visible",
  viewport: { once: true, margin: "-80px" },
};

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);

  return reduced;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/motion.ts
git commit -m "feat: add shared Framer Motion conventions library"
```

---

### Task 3: Simple primitives — Skeleton, EmptyState, Badge, Dropdown, Tabs

**Files:**
- Create: `frontend/components/ui/Skeleton.tsx`
- Create: `frontend/components/ui/EmptyState.tsx`
- Create: `frontend/components/ui/Badge.tsx`
- Create: `frontend/components/ui/Dropdown.tsx`
- Create: `frontend/components/ui/Tabs.tsx`

**Interfaces:**
- Consumes: nothing (these are stateless/simple-state, no motion.ts dependency needed).
- Produces: `Skeleton({ className? })`, `EmptyState({ title, description?, action? }: { title: string; description?: string; action?: ReactNode })`, `Badge({ variant, children }: { variant: "success" | "warning" | "danger" | "neutral"; children: ReactNode })`, `Dropdown` (forwards all native `<select>` props, styled), `Tabs({ tabs, activeKey, onChange }: { tabs: { key: string; label: string }[]; activeKey: string; onChange: (key: string) => void })`.

- [ ] **Step 1: Create `Skeleton.tsx`**

```tsx
import { HTMLAttributes } from "react";

export default function Skeleton({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`animate-pulse rounded-md bg-surface ${className}`.trim()} {...props} />;
}
```

- [ ] **Step 2: Create `EmptyState.tsx`**

```tsx
import { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-hairline bg-surface p-10 text-center">
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="text-sm text-taupe">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Create `Badge.tsx`**

```tsx
import { ReactNode } from "react";

const VARIANT_CLASS: Record<string, string> = {
  success: "bg-accent-light text-accent",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-danger",
  neutral: "bg-hairline text-ink",
};

interface BadgeProps {
  variant: "success" | "warning" | "danger" | "neutral";
  children: ReactNode;
}

export default function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${VARIANT_CLASS[variant]}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Create `Dropdown.tsx`**

```tsx
import { SelectHTMLAttributes } from "react";

export default function Dropdown({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`rounded-md border border-hairline bg-bg px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none ${className}`.trim()}
      {...props}
    />
  );
}
```

- [ ] **Step 5: Create `Tabs.tsx`**

```tsx
interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
}

export default function Tabs({ tabs, activeKey, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 border-b border-hairline">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab.key === activeKey
              ? "border-b-2 border-accent text-accent"
              : "text-taupe hover:text-ink"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/ui/Skeleton.tsx frontend/components/ui/EmptyState.tsx frontend/components/ui/Badge.tsx frontend/components/ui/Dropdown.tsx frontend/components/ui/Tabs.tsx
git commit -m "feat: add Skeleton, EmptyState, Badge, Dropdown, Tabs primitives"
```

---

### Task 4: Toast primitive + provider

**Files:**
- Create: `frontend/components/ui/Toast.tsx`
- Modify: `frontend/app/layout.tsx`

**Interfaces:**
- Consumes: nothing new from motion.ts is required for a minimal fade (uses plain CSS transition to avoid a hard Framer Motion dependency in a context provider that wraps the whole app).
- Produces: `ToastProvider` (wraps `children`), `useToast(): { showToast: (message: string, variant?: "success" | "error") => void }`. `useToast` must be called only within a `ToastProvider` subtree — throws if not.

- [ ] **Step 1: Create `Toast.tsx`**

```tsx
"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";

interface ToastItem {
  id: number;
  message: string;
  variant: "success" | "error";
}

interface ToastContextValue {
  showToast: (message: string, variant?: "success" | "error") => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, variant: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-[fadeIn_0.2s_ease-out] rounded-md px-4 py-3 text-sm text-white shadow-lg ${
              toast.variant === "success" ? "bg-accent" : "bg-danger"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

- [ ] **Step 2: Wrap the app in `ToastProvider`**

Read `frontend/app/layout.tsx` first to find the exact `<body>` structure, then wrap the existing children with `<ToastProvider>...</ToastProvider>` inside `<body>`, adding `import { ToastProvider } from "@/components/ui/Toast";` at the top. Do not change any other existing content in this file.

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ui/Toast.tsx frontend/app/layout.tsx
git commit -m "feat: add Toast primitive and app-level ToastProvider"
```

---

### Task 5: Modal primitive

**Files:**
- Create: `frontend/components/ui/Modal.tsx`

**Interfaces:**
- Consumes: `modalOverlay`, `modalContent` from `frontend/lib/motion.ts` (Task 2); `usePrefersReducedMotion` from `frontend/lib/motion.ts` (Task 2).
- Produces: `Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode })` — renders nothing when `open` is false; portals to `document.body`; closes on Escape key or overlay click; traps Tab focus within the dialog while open.

- [ ] **Step 1: Create `Modal.tsx`**

```tsx
"use client";

import { useEffect, useRef, ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { modalOverlay, modalContent, usePrefersReducedMotion } from "@/lib/motion";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ open, onClose, children }: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !contentRef.current) return;
      const focusable = contentRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={modalOverlay}
          transition={reducedMotion ? { duration: 0.01 } : undefined}
          onClick={onClose}
        >
          <motion.div
            ref={contentRef}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-bg p-6 shadow-lg"
            variants={modalContent}
            transition={reducedMotion ? { duration: 0.01 } : undefined}
            onClick={(event) => event.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/ui/Modal.tsx
git commit -m "feat: add Modal primitive with focus trap and motion variants"
```

---

### Task 6: Retrofit public homepage & salon directory

**Files:**
- Modify: `frontend/app/page.tsx`
- Modify: `frontend/components/SalonCard.tsx`
- Modify: `frontend/components/SalonDirectory.tsx`
- Modify: `frontend/components/SearchBar.tsx`
- Modify: `frontend/app/layout.tsx` (color class rename only, if any `terracotta`/`ivory` usage exists there beyond Task 4's edit)

**Interfaces:**
- Consumes: `staggerContainer`, `staggerItem`, `scaleTap`, `fadeInUp`, `scrollReveal`, `usePrefersReducedMotion` from `frontend/lib/motion.ts` (Task 2); `Skeleton` from Task 3.

- [ ] **Step 1: Rename color classes in all five files**

In each file listed above, replace every Tailwind class using the removed tokens:
- `bg-terracotta` / `text-terracotta` / `border-terracotta` → `bg-accent` / `text-accent` / `border-accent` (and `terracotta-light` → `accent-light`)
- `bg-ivory` / `text-ivory` → `bg-bg` (page/section backgrounds) — read each usage to confirm `bg` is the right replacement (it is, for all current `ivory` usages, since they're all background colors, not text).

Do this as a plain find-and-replace per file; do not change any other class or structure.

- [ ] **Step 2: Move `SalonCard` and `SalonDirectory` onto the shared motion variants**

Read `frontend/components/SalonCard.tsx` and `frontend/components/SalonDirectory.tsx` first to see their current one-off Framer Motion usage. Replace their existing inline `motion.div` `initial`/`animate`/`whileHover`/`whileTap` props with:
- `SalonDirectory`'s grid wrapper: add `variants={staggerContainer}` `initial="hidden"` `animate="visible"` on the container `motion.div`.
- `SalonCard`'s root `motion.div`: use `variants={staggerItem}` (no own `initial`/`animate`, inherits from the parent's stagger) and spread `{...scaleTap}` for hover/tap, replacing whatever hover/tap props exist today.
- If `usePrefersReducedMotion()` returns `true`, pass `transition={{ duration: 0.01 }}` to override `scaleTap`'s spring — check this inside `SalonCard` and conditionally spread the override after `{...scaleTap}` so it takes precedence.

Import `staggerContainer, staggerItem, scaleTap, usePrefersReducedMotion` from `@/lib/motion` in both files.

- [ ] **Step 3: Add hero entrance and search-loading skeleton**

In `frontend/app/page.tsx`, wrap the hero section's root element in a `motion.div` with `variants={fadeInUp}` `initial="hidden"` `animate="visible"` (import `fadeInUp` from `@/lib/motion`). Read the file first to find how salon list loading is currently handled; if there's a loading state with no visual placeholder, add three `<Skeleton className="h-64 rounded-lg" />` elements in a grid matching the salon card grid's layout classes while loading (import `Skeleton` from `@/components/ui/Skeleton`).

- [ ] **Step 4: Verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && npm run build 2>&1 | tail -30`
Expected: no more `terracotta`/`ivory` class warnings for these five files (other page groups still pending in later tasks).

- [ ] **Step 5: Commit**

```bash
git add frontend/app/page.tsx frontend/components/SalonCard.tsx frontend/components/SalonDirectory.tsx frontend/components/SearchBar.tsx frontend/app/layout.tsx
git commit -m "feat: retrofit homepage and salon directory onto design tokens and shared motion"
```

---

### Task 7: Retrofit salon detail page

**Files:**
- Modify: `frontend/app/salons/[slug]/page.tsx`
- Modify: `frontend/app/salons/[slug]/not-found.tsx`
- Modify: `frontend/components/ServiceList.tsx`
- Modify: `frontend/components/StaffList.tsx`
- Modify: `frontend/components/GalleryGrid.tsx`
- Modify: `frontend/components/AboutContact.tsx`
- Modify: `frontend/components/BookingForm.tsx`
- Modify: `frontend/components/SalonHero.tsx` (color rename only, if applicable — check for `terracotta`/`ivory` usage)

**Interfaces:**
- Consumes: `scrollReveal`, `fadeInUp` from `frontend/lib/motion.ts` (Task 2); `useToast` from `frontend/components/ui/Toast.tsx` (Task 4).

- [ ] **Step 1: Rename color classes in all eight files**

Same mechanical rename as Task 6 Step 1 (`terracotta`→`accent`/`accent-light`, `ivory`→`bg`) applied to every file listed above. Read each file first; some (e.g. `GalleryGrid.tsx`) may have no `terracotta`/`ivory` usage at all — skip files with none.

- [ ] **Step 2: Add scroll-reveal to each section**

In `frontend/app/salons/[slug]/page.tsx`, wrap each of `<ServiceList>`, `<StaffList>`, `<GalleryGrid>`, `<AboutContact>` in a `motion.div` using `{...scrollReveal}` and `variants={fadeInUp}` (import both from `@/lib/motion`). Read the file first to see the exact current JSX structure before wrapping — do not change component prop-passing, only add the wrapping `motion.div`.

- [ ] **Step 3: Add Toast feedback to `BookingForm`**

Read `frontend/components/BookingForm.tsx` first to find its existing submit handler and success/error state. Add `import { useToast } from "@/components/ui/Toast";` and call `const { showToast } = useToast();` inside the component. On successful booking submission, call `showToast("Booking request sent!", "success")` alongside the existing inline success UI (do not remove the existing inline success message — this is additive per the spec's Error Handling section). On failure, call `showToast(errorMessage, "error")` alongside the existing inline error text.

- [ ] **Step 4: Verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && npm run build 2>&1 | tail -30`
Expected: no more `terracotta`/`ivory` class warnings for these eight files.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/salons frontend/components/ServiceList.tsx frontend/components/StaffList.tsx frontend/components/GalleryGrid.tsx frontend/components/AboutContact.tsx frontend/components/BookingForm.tsx frontend/components/SalonHero.tsx
git commit -m "feat: retrofit salon detail page onto design tokens, scroll-reveal, and toast feedback"
```

---

### Task 8: Retrofit salon-admin dashboard

**Files:**
- Modify: `frontend/app/admin/layout.tsx`
- Modify: `frontend/app/admin/login/page.tsx`
- Modify: `frontend/app/admin/page.tsx`
- Modify: `frontend/app/admin/services/page.tsx`
- Modify: `frontend/app/admin/staff/page.tsx`
- Modify: `frontend/app/admin/gallery/page.tsx`
- Modify: `frontend/app/admin/content/page.tsx`

**Interfaces:**
- Consumes: `Skeleton` (Task 3), `EmptyState` (Task 3), `useToast` (Task 4).

- [ ] **Step 1: Rename color classes in all seven files**

Same mechanical rename as Task 6 Step 1, applied to every file listed above. Read each file first; skip any with no `terracotta`/`ivory` usage.

- [ ] **Step 2: Add Skeleton loading and EmptyState to CRUD list pages**

For each of `services/page.tsx`, `staff/page.tsx`, `gallery/page.tsx`, `content/page.tsx`: read the file first to find its existing loading boolean and list-rendering logic. Where the list is loading, render 3 `<Skeleton className="h-16 rounded-md" />` elements stacked with `gap-3` in place of the current loading treatment (if any). Where the list has loaded and is empty, render `<EmptyState title="No [services/staff/gallery items/content blocks] yet" description="Add your first [service/staff member/gallery item/content block] to get started." />` (substitute the bracketed nouns per page) instead of the current empty-list rendering (or lack thereof). Import `Skeleton` from `@/components/ui/Skeleton` and `EmptyState` from `@/components/ui/EmptyState`.

- [ ] **Step 3: Add Toast confirmations to form saves**

For each of the same four pages, read the existing create/update/delete handlers. Add `import { useToast } from "@/components/ui/Toast";` and `const { showToast } = useToast();`. After a successful create/update, call `showToast("Saved", "success")`; after a successful delete, call `showToast("Deleted", "success")`; on any error path that currently sets inline error state, also call `showToast(errorMessage, "error")` — additive, do not remove existing inline error handling.

- [ ] **Step 4: Verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && npm run build 2>&1 | tail -30`
Expected: no more `terracotta`/`ivory` class warnings for these seven files.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/admin
git commit -m "feat: retrofit salon-admin dashboard onto design tokens, skeleton/empty states, and toast confirmations"
```

---

### Task 9: Retrofit platform-admin dashboard

**Files:**
- Modify: `frontend/app/platform/layout.tsx`
- Modify: `frontend/app/platform/login/page.tsx`
- Modify: `frontend/app/platform/page.tsx`
- Modify: `frontend/app/platform/leads/page.tsx`

**Interfaces:**
- Consumes: `Skeleton` (Task 3), `EmptyState` (Task 3), `Badge` (Task 3), `useToast` (Task 4).

- [ ] **Step 1: Rename color classes in all four files**

Same mechanical rename as Task 6 Step 1.

- [ ] **Step 2: Add Skeleton, EmptyState, and Badge to the salons list**

Read `frontend/app/platform/page.tsx` first. Add `Skeleton` rows while loading (3× `<Skeleton className="h-12 rounded-md" />`), `EmptyState` when the salon list is empty (`title="No salons yet"`), and replace the existing hand-styled salon-status `<span>` with `<Badge variant={salon.status === "active" ? "success" : "neutral"}>{salon.status}</Badge>`. Import all three from `@/components/ui/{Skeleton,EmptyState,Badge}`.

- [ ] **Step 3: Add Skeleton, EmptyState, and Badge to the leads list**

Read `frontend/app/platform/leads/page.tsx` first. Same treatment: `Skeleton` rows while loading, `EmptyState` (`title="No leads yet"`) when empty — this page already has a "No leads yet." text per prior work, replace it with the `EmptyState` primitive instead of the bare paragraph. Replace the existing hand-styled lead-status `<span>` with `<Badge variant={lead.status === "pending" ? "warning" : lead.status === "approved" ? "success" : "neutral"}>{lead.status}</Badge>`.

- [ ] **Step 4: Add Toast confirmations to lead approve/reject actions**

Read the existing `handleApprove`/`handleReject` handlers in `frontend/app/platform/leads/page.tsx`. Add `import { useToast } from "@/components/ui/Toast";` and `const { showToast } = useToast();`. On successful approve, call `showToast("Salon created", "success")` alongside the existing inline result panel (additive, do not remove it). On successful reject, call `showToast("Lead rejected", "success")`. On any error, call `showToast(errorMessage, "error")`.

- [ ] **Step 5: Verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && npm run build 2>&1 | tail -30`
Expected: build succeeds with zero `terracotta`/`ivory` class warnings anywhere in the project — this confirms the full retrofit is complete across all four page groups.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/platform
git commit -m "feat: retrofit platform-admin dashboard onto design tokens, skeleton/empty states, badges, and toast confirmations"
```

---

### Task 10: Manual verification pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Start the backend and frontend dev servers**

Follow the existing `.claude/launch.json` configurations (`backend-api` on port 8000, `frontend` on port 3000) to start both.

- [ ] **Step 2: Walk through all four page groups in a browser**

For each of: homepage/directory, a salon detail page, the salon-admin dashboard (login through to services/staff/gallery/content pages), the platform-admin dashboard (login through to salons/leads pages) — confirm:
- Background is clean white/near-white, primary actions/links/active nav use the teal accent color (not the old terracotta).
- Card/list entrances animate with a noticeable spring/stagger feel (not instant, not sluggish).
- At least one loading state shows `Skeleton` placeholders (e.g. reload a dashboard list page and observe the brief loading flash).
- At least one empty list shows the `EmptyState` primitive with title/description.
- At least one form save shows a `Toast` notification.
- The `BookingForm` on a salon detail page shows a `Toast` on submit.
- Salon status and lead status render as `Badge` pills, not plain text.

- [ ] **Step 3: Verify `prefers-reduced-motion` is respected**

In the browser devtools, emulate `prefers-reduced-motion: reduce` (Chrome DevTools: Rendering tab → "Emulate CSS media feature prefers-reduced-motion"). Reload the homepage and a salon detail page. Confirm card/section entrances no longer show a visible spring/stagger animation (near-instant instead).

- [ ] **Step 4: Final full-project check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && npm run build`
Expected: clean build, exit code 0, no warnings about unresolved Tailwind classes.

No commit for this task — it's verification only. If any issue is found, fix it in the relevant earlier task's files and amend that task's commit or add a small fixup commit, then re-run this task's steps.

## Post-Implementation Notes

Two client components were added during implementation/review that aren't in the task list above, because they exist to fix a bug the plan didn't anticipate: Framer Motion (`motion.*`) cannot be rendered directly inside a Server Component (Next.js App Router pages are Server Components by default) — doing so compiles and builds successfully but fails at runtime with "Could not find the module ... in the React Client Manifest". Neither `tsc --noEmit` nor `npm run build` catches this; it only surfaces in the browser.

- `frontend/components/Hero.tsx` — extracts the homepage hero's `fadeInUp` entrance into its own `"use client"` component, since `app/page.tsx` is an async Server Component.
- `frontend/components/ui/Reveal.tsx` — a reusable `"use client"` wrapper applying `scrollReveal`/`fadeInUp` to any children, used by the salon detail page (also a Server Component) for its four scroll-reveal sections.

**For future phases:** any new Server Component page that wants a Framer Motion entrance/scroll-reveal should use `Reveal` (or a similar dedicated client wrapper) rather than importing `motion` directly into the page file. Any component using `framer-motion` or a hook from `frontend/lib/motion.ts` needs its own `"use client"` directive unless it's exclusively rendered from within an already-client parent (e.g. `SalonCard` inside `SalonDirectory`) — verify this per component, since it's easy to add motion to a component that later gets reused from a Server Component context.
