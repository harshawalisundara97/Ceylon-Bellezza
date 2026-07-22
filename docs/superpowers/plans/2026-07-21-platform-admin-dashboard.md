# Platform Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/platform/*` section in the existing `frontend/` Next.js app so the platform operator can log in, see all salons, add a new salon (which also creates its owner's login), and toggle each salon's status/enabled modules — all backend endpoints already exist and are untouched by this plan.

**Architecture:** Mirrors the already-built Salon Admin Dashboard (`frontend/app/admin/*`) exactly, but as a structurally separate token/route namespace (`/platform/*`, `cb_platform_token`) so a platform-admin session and a salon-admin session can coexist safely in the same browser. Built directly against the shared UI primitives at `frontend/components/ui/{Button,Card,Input,PageHeading}.tsx` (these didn't exist yet when the design spec was written, but the project's design-unification effort established them as the standard — this plan uses them from the start rather than retrofitting later).

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS (existing `ivory`/`ink`/`taupe`/`terracotta`/`hairline` tokens). No new npm dependencies.

## Global Constraints

- No backend changes. Every endpoint below already exists and is covered by `backend/tests/test_salons.py` and `test_auth.py`.
- No new npm dependencies — plain `useState`/`fetch`, matching every other frontend plan in this repo.
- No automated frontend test suite by design — verification is manual (curl + browser).
- Token storage key must be exactly `cb_platform_token` — distinct from the salon dashboard's `cb_admin_token` — via a separate `frontend/lib/platformAuth.ts` module (not reusing `adminAuth.ts`), so the two sessions never collide.
- API base URL: `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"` (same convention as `frontend/lib/adminApi.ts`).
- Reuse the shared UI primitives (`Button`, `Card`, `Input`, `PageHeading`) from `frontend/components/ui/` — do not recreate their styling inline.
- Seeded platform admin credentials for verification: `admin@ceylonbellezza.com` / `admin123` (`backend/scripts/seed_demo_data.py`).
- Exact backend contracts this plan depends on (from `backend/app/routers/salons.py` and `backend/app/schemas/salon.py`, prefix `/admin/salons`, all requiring a `platform_admin`-role JWT except login):
  - `POST /auth/platform-admin/login` — `{email, password}` → `{access_token, token_type}` (200), 401 on bad credentials.
  - `POST /admin/salons` — `SalonCreateRequest {slug, name, category, address, city, latitude?, longitude?, admin_email, admin_password}` → `SalonRead` (201), 409 on duplicate slug/email.
  - `GET /admin/salons` → `list[SalonRead]` (200).
  - `PATCH /admin/salons/{id}/modules` — `{gallery: bool, booking: bool, contact_form: bool}` (all three required every time) → `SalonRead` (200), 404 if salon doesn't exist.
  - `PATCH /admin/salons/{id}/status` — `{status: "active" | "suspended"}` → `SalonRead` (200), 404 if salon doesn't exist.
  - `SalonRead` shape: `{id, slug, name, category, address, city, latitude: number|null, longitude: number|null, status, enabled_modules: {gallery, booking, contact_form}, template_settings}`.

---

## File Structure

```
frontend/
  lib/
    platformAuth.ts        # saveToken/getToken/clearToken (localStorage key "cb_platform_token")
    platformApi.ts           # platformFetch<T>() wrapper + PlatformApiError, mirrors adminApi.ts
                               # exactly (401 redirects to /platform/login instead of /admin/login)
  app/
    platform/
      layout.tsx                # auth guard (redirects to /platform/login if no token) + simple nav
      login/
        page.tsx                    # email/password -> POST /auth/platform-admin/login
      page.tsx                        # salon list (Task 1) + add-salon form (Task 2) +
                                        # status/module toggles per row (Task 3)
```

---

### Task 1: Platform auth foundation + read-only salon list

**Files:**
- Create: `frontend/lib/platformAuth.ts`
- Create: `frontend/lib/platformApi.ts`
- Create: `frontend/app/platform/login/page.tsx`
- Create: `frontend/app/platform/layout.tsx`
- Create: `frontend/app/platform/page.tsx`

**Interfaces:**
- Consumes: nothing (foundational task).
- Produces: `platformAuth.saveToken(token: string): void`, `getToken(): string | null`, `clearToken(): void`; `platformApi.platformFetch<T>(path: string, options?: RequestInit): Promise<T>` and `PlatformApiError` (with `.status: number`), and `loginPlatformAdmin(email: string, password: string): Promise<string>`. Tasks 2-3 extend `frontend/app/platform/page.tsx` and import `platformFetch`/`PlatformApiError` from `@/lib/platformApi`.

- [ ] **Step 1: Create `frontend/lib/platformAuth.ts`**

```ts
const TOKEN_KEY = "cb_platform_token";

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
```

- [ ] **Step 2: Create `frontend/lib/platformApi.ts`**

```ts
import { getToken, clearToken } from "./platformAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class PlatformApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function platformFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/platform/login";
    }
    throw new PlatformApiError(401, "Not authenticated");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    let message: string;
    if (Array.isArray(body.detail)) {
      message = body.detail.map((entry: any) => (entry && entry.msg ? entry.msg : String(entry))).join("; ");
    } else if (typeof body.detail === "string") {
      message = body.detail;
    } else {
      message = "Request failed";
    }
    throw new PlatformApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function loginPlatformAdmin(email: string, password: string): Promise<string> {
  const response = await fetch(`${API_URL}/auth/platform-admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new PlatformApiError(response.status, "Invalid email or password");
  }
  const data = await response.json();
  return data.access_token;
}
```

- [ ] **Step 3: Create `frontend/app/platform/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginPlatformAdmin, PlatformApiError } from "@/lib/platformApi";
import { saveToken } from "@/lib/platformAuth";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import PageHeading from "@/components/ui/PageHeading";

export default function PlatformLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const token = await loginPlatformAdmin(email, password);
      saveToken(token);
      router.push("/platform");
    } catch (err) {
      setError(err instanceof PlatformApiError ? err.message : "Something went wrong — try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ivory px-6">
      <Card as="form" className="w-full max-w-sm p-8" onSubmit={handleSubmit}>
        <PageHeading className="text-xl">Platform Admin Login</PageHeading>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <label className="mt-6 block text-sm text-taupe">
          Email
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full"
          />
        </label>
        <label className="mt-4 block text-sm text-taupe">
          Password
          <Input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full"
          />
        </label>
        <Button type="submit" disabled={submitting} className="mt-6 w-full">
          {submitting ? "Logging in..." : "Log In"}
        </Button>
      </Card>
    </main>
  );
}
```

- [ ] **Step 4: Create `frontend/app/platform/layout.tsx`**

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getToken, clearToken } from "@/lib/platformAuth";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (pathname === "/platform/login") {
      setChecked(true);
      return;
    }
    if (!getToken()) {
      router.replace("/platform/login");
      return;
    }
    setChecked(true);
  }, [pathname, router]);

  if (pathname === "/platform/login") {
    return <>{children}</>;
  }

  if (!checked) {
    return null;
  }

  function handleLogout() {
    clearToken();
    router.push("/platform/login");
  }

  return (
    <div className="min-h-screen bg-ivory">
      <header className="flex items-center justify-between border-b border-hairline bg-white px-8 py-4">
        <p className="font-serif text-sm uppercase tracking-wide text-terracotta">Ceylon Bellezza — Platform Admin</p>
        <button onClick={handleLogout} className="text-sm text-taupe hover:text-terracotta">
          Log Out
        </button>
      </header>
      <main className="p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 5: Create `frontend/app/platform/page.tsx` (read-only list for this task)**

```tsx
"use client";

import { useEffect, useState } from "react";
import { platformFetch, PlatformApiError } from "@/lib/platformApi";
import PageHeading from "@/components/ui/PageHeading";

interface Salon {
  id: string;
  slug: string;
  name: string;
  category: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  enabled_modules: { gallery: boolean; booking: boolean; contact_form: boolean };
  template_settings: Record<string, unknown>;
}

export default function PlatformSalonsPage() {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadSalons() {
    setLoading(true);
    try {
      const data = await platformFetch<Salon[]>("/admin/salons");
      setSalons(data);
    } catch (err) {
      setError(err instanceof PlatformApiError ? err.message : "Failed to load salons");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSalons();
  }, []);

  return (
    <div>
      <PageHeading>Salons</PageHeading>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="mt-6 text-taupe">Loading...</p>
      ) : salons.length === 0 ? (
        <p className="mt-6 text-taupe">No salons yet.</p>
      ) : (
        <table className="mt-6 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-hairline text-sm text-taupe">
              <th className="py-2">Name</th>
              <th className="py-2">Slug</th>
              <th className="py-2">City</th>
              <th className="py-2">Category</th>
              <th className="py-2">Status</th>
              <th className="py-2">Modules</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {salons.map((salon) => (
              <tr key={salon.id}>
                <td className="py-3 text-ink">{salon.name}</td>
                <td className="py-3 text-taupe">{salon.slug}</td>
                <td className="py-3 text-taupe">{salon.city}</td>
                <td className="py-3 text-taupe">{salon.category}</td>
                <td className="py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${
                      salon.status === "active" ? "bg-terracotta/10 text-terracotta" : "bg-hairline text-taupe"
                    }`}
                  >
                    {salon.status}
                  </span>
                </td>
                <td className="py-3 text-sm text-taupe">
                  {[
                    salon.enabled_modules.gallery && "gallery",
                    salon.enabled_modules.booking && "booking",
                    salon.enabled_modules.contact_form && "contact",
                  ]
                    .filter(Boolean)
                    .join(", ") || "none"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Verify the login and list flow manually**

```bash
pg_isready -h localhost -p 5433 || brew services start postgresql@15
cd backend && .venv/bin/uvicorn app.main:app --port 8000 &
cd ../frontend && npm run dev &
sleep 6
curl -s http://localhost:3000/platform/login | grep -o "Platform Admin Login"
kill %1 %2
```

Expected: the grep finds a match. Follow up in the browser: visiting `/platform` unauthenticated redirects to `/platform/login`; logging in as `admin@ceylonbellezza.com` / `admin123` redirects to `/platform` and lists the seeded salons with correct slug/city/category/status/modules columns.

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/platformAuth.ts frontend/lib/platformApi.ts frontend/app/platform/login/page.tsx frontend/app/platform/layout.tsx frontend/app/platform/page.tsx
git commit -m "feat: add platform admin auth foundation and read-only salon list"
```

---

### Task 2: Add Salon form

**Files:**
- Modify: `frontend/app/platform/page.tsx`

**Interfaces:**
- Consumes: `platformFetch`, `PlatformApiError` from `@/lib/platformApi` (Task 1); the `Salon` interface defined in Task 1's `page.tsx`.
- Produces: nothing new consumed by Task 3 beyond what Task 1 already established (Task 3 adds controls to the same table rows Task 1 renders).

- [ ] **Step 1: Add form state and submit handler to `frontend/app/platform/page.tsx`**

Add these imports at the top (alongside the existing ones):

```tsx
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
```

Add this state inside `PlatformSalonsPage`, alongside the existing `salons`/`loading`/`error` state:

```tsx
const EMPTY_FORM = {
  slug: "",
  name: "",
  category: "",
  address: "",
  city: "",
  latitude: "",
  longitude: "",
  admin_email: "",
  admin_password: "",
};

const [form, setForm] = useState(EMPTY_FORM);
const [submitting, setSubmitting] = useState(false);
```

Add this handler function, above the `return`:

```tsx
async function handleSubmit(event: React.FormEvent) {
  event.preventDefault();
  setError(null);
  setSubmitting(true);
  try {
    const payload = {
      slug: form.slug,
      name: form.name,
      category: form.category,
      address: form.address,
      city: form.city,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      admin_email: form.admin_email,
      admin_password: form.admin_password,
    };
    const created = await platformFetch<Salon>("/admin/salons", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setSalons([created, ...salons]);
    setForm(EMPTY_FORM);
  } catch (err) {
    setError(err instanceof PlatformApiError ? err.message : "Failed to create salon");
  } finally {
    setSubmitting(false);
  }
}
```

- [ ] **Step 2: Render the form above the table**

Insert this JSX immediately after the `{error && ...}` line and before the `{loading ? (` block:

```tsx
<Card as="form" onSubmit={handleSubmit} className="mt-6">
  <p className="font-medium text-ink">Add salon</p>
  <div className="mt-4 grid grid-cols-2 gap-4">
    <Input
      required
      placeholder="Slug (e.g. glamour-lk)"
      value={form.slug}
      onChange={(e) => setForm({ ...form, slug: e.target.value })}
    />
    <Input
      required
      placeholder="Name"
      value={form.name}
      onChange={(e) => setForm({ ...form, name: e.target.value })}
    />
    <Input
      required
      placeholder="Category (mens/womens/unisex)"
      value={form.category}
      onChange={(e) => setForm({ ...form, category: e.target.value })}
    />
    <Input
      required
      placeholder="City"
      value={form.city}
      onChange={(e) => setForm({ ...form, city: e.target.value })}
    />
    <Input
      required
      placeholder="Address"
      value={form.address}
      onChange={(e) => setForm({ ...form, address: e.target.value })}
      className="col-span-2"
    />
    <Input
      type="number"
      step="0.0001"
      placeholder="Latitude (optional)"
      value={form.latitude}
      onChange={(e) => setForm({ ...form, latitude: e.target.value })}
    />
    <Input
      type="number"
      step="0.0001"
      placeholder="Longitude (optional)"
      value={form.longitude}
      onChange={(e) => setForm({ ...form, longitude: e.target.value })}
    />
    <Input
      required
      type="email"
      placeholder="Owner email"
      value={form.admin_email}
      onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
    />
    <Input
      required
      type="password"
      placeholder="Owner password"
      value={form.admin_password}
      onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
    />
  </div>
  <Button type="submit" disabled={submitting} className="mt-4">
    {submitting ? "Creating..." : "Add salon"}
  </Button>
</Card>
```

- [ ] **Step 3: Verify against the backend**

```bash
pg_isready -h localhost -p 5433 || brew services start postgresql@15
cd backend && .venv/bin/uvicorn app.main:app --port 8000 &
cd ../frontend && npm run dev &
sleep 6
TOKEN=$(curl -s -X POST http://localhost:8000/auth/platform-admin/login -H "Content-Type: application/json" -d '{"email":"admin@ceylonbellezza.com","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s http://localhost:8000/admin/salons -H "Authorization: Bearer $TOKEN" | grep -o "glamour-lk"
kill %1 %2
```

Expected: the grep finds a match (existing seeded salon reachable). Follow up in the browser: log in at `/platform/login`, fill the Add Salon form with a new slug/city/category/owner email+password, submit, confirm the new salon appears at the top of the table immediately (no reload needed), then separately log in at `/admin/login` with the owner email/password just entered and confirm it works (proves the created `SalonAdmin` credentials are real). Also submit with a slug that already exists and confirm the inline error reads "A salon with this slug or an admin with this email already exists" (the exact 409 message from the backend).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/platform/page.tsx
git commit -m "feat: add salon creation form to platform admin dashboard"
```

---

### Task 3: Status and module toggle controls

**Files:**
- Modify: `frontend/app/platform/page.tsx`

**Interfaces:**
- Consumes: `platformFetch`, `PlatformApiError` (Task 1); `Salon` interface and `salons`/`setSalons` state (Task 1); renders inside the same table rows Task 1 created.
- Produces: nothing consumed by later tasks (final task in this plan).

- [ ] **Step 1: Add expand/toggle state and handlers**

Add this state alongside the existing state in `PlatformSalonsPage`:

```tsx
const [expandedId, setExpandedId] = useState<string | null>(null);
```

Add these handlers above the `return`:

```tsx
async function handleStatusChange(salon: Salon, status: string) {
  setError(null);
  try {
    const updated = await platformFetch<Salon>(`/admin/salons/${salon.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setSalons(salons.map((s) => (s.id === updated.id ? updated : s)));
  } catch (err) {
    setError(err instanceof PlatformApiError ? err.message : "Failed to update status");
  }
}

async function handleModuleToggle(salon: Salon, moduleKey: "gallery" | "booking" | "contact_form") {
  setError(null);
  const nextModules = { ...salon.enabled_modules, [moduleKey]: !salon.enabled_modules[moduleKey] };
  try {
    const updated = await platformFetch<Salon>(`/admin/salons/${salon.id}/modules`, {
      method: "PATCH",
      body: JSON.stringify(nextModules),
    });
    setSalons(salons.map((s) => (s.id === updated.id ? updated : s)));
  } catch (err) {
    setError(err instanceof PlatformApiError ? err.message : "Failed to update modules");
  }
}
```

- [ ] **Step 2: Make each row clickable to expand, and add an inline control panel row**

Replace the existing `<tr key={salon.id}>...</tr>` block (from Task 1's Step 5) with:

```tsx
<>
  <tr key={salon.id} onClick={() => setExpandedId(expandedId === salon.id ? null : salon.id)} className="cursor-pointer hover:bg-ivory">
    <td className="py-3 text-ink">{salon.name}</td>
    <td className="py-3 text-taupe">{salon.slug}</td>
    <td className="py-3 text-taupe">{salon.city}</td>
    <td className="py-3 text-taupe">{salon.category}</td>
    <td className="py-3">
      <span
        className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${
          salon.status === "active" ? "bg-terracotta/10 text-terracotta" : "bg-hairline text-taupe"
        }`}
      >
        {salon.status}
      </span>
    </td>
    <td className="py-3 text-sm text-taupe">
      {[
        salon.enabled_modules.gallery && "gallery",
        salon.enabled_modules.booking && "booking",
        salon.enabled_modules.contact_form && "contact",
      ]
        .filter(Boolean)
        .join(", ") || "none"}
    </td>
  </tr>
  {expandedId === salon.id && (
    <tr key={`${salon.id}-panel`}>
      <td colSpan={6} className="bg-ivory px-4 py-4">
        <div className="flex flex-wrap items-center gap-6">
          <label className="text-sm text-ink">
            Status:
            <select
              value={salon.status}
              onChange={(e) => handleStatusChange(salon, e.target.value)}
              className="ml-2 rounded border border-hairline px-2 py-1"
            >
              <option value="active">active</option>
              <option value="suspended">suspended</option>
            </select>
          </label>
          {(["gallery", "booking", "contact_form"] as const).map((moduleKey) => (
            <label key={moduleKey} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={salon.enabled_modules[moduleKey]}
                onChange={() => handleModuleToggle(salon, moduleKey)}
              />
              {moduleKey}
            </label>
          ))}
        </div>
      </td>
    </tr>
  )}
</>
```

Note: `Salon.enabled_modules[moduleKey]` requires `moduleKey` typed as `keyof Salon["enabled_modules"]`, which the `as const` tuple already satisfies.

- [ ] **Step 3: Verify against the backend**

```bash
pg_isready -h localhost -p 5433 || brew services start postgresql@15
cd backend && .venv/bin/uvicorn app.main:app --port 8000 &
cd ../frontend && npm run dev &
sleep 6
TOKEN=$(curl -s -X POST http://localhost:8000/auth/platform-admin/login -H "Content-Type: application/json" -d '{"email":"admin@ceylonbellezza.com","password":"admin123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
SALON_ID=$(curl -s http://localhost:8000/admin/salons -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")
curl -s -X PATCH "http://localhost:8000/admin/salons/$SALON_ID/status" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"status":"suspended"}' | grep -o "suspended"
curl -s -X PATCH "http://localhost:8000/admin/salons/$SALON_ID/status" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"status":"active"}' | grep -o "active"
kill %1 %2
```

Expected: both greps match (status round-trips). Follow up in the browser: click a salon row to expand the panel, toggle the status dropdown to `suspended`, confirm the row's status badge updates immediately; reload the page and confirm the change persisted (re-fetch shows `suspended`, not just local state). Toggle a module checkbox off, confirm the row's modules cell updates; reload and confirm it persisted. Set the status back to `active` and re-check module state afterward so the salon is left in a normal state. Finally, visit the public homepage (`http://localhost:3000`) while a salon is suspended and confirm it's absent from the public directory (the public `/salons` endpoint filters by active status), then confirm it reappears once reactivated.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/platform/page.tsx
git commit -m "feat: add status and module toggle controls to platform admin dashboard"
```

---

## Self-Review Notes

- **Spec coverage**: all four platform-admin endpoints (`create_salon`, `list_salons`, `toggle_modules`, `update_status`) and `platform-admin/login` have a corresponding UI control — Task 1 covers list+login, Task 2 covers create, Task 3 covers status+modules. Matches the spec's Self-Review Notes exactly.
- **Placeholder scan**: no TBD/TODO; every step has complete, runnable code including exact endpoint paths and payload shapes pulled from `backend/app/schemas/salon.py` and `backend/tests/test_salons.py`.
- **Type consistency**: `Salon` interface (Task 1) is reused verbatim by Tasks 2-3; `platformFetch<T>`/`PlatformApiError` (Task 1) match the exact names used in every later import. Module toggle always sends the full three-field payload, matching `ModuleToggleRequest`'s all-required-fields contract (not a partial patch) — same pattern the spec calls out explicitly.
- **Scope check**: three tasks, each independently testable and committable, building up one page (`frontend/app/platform/page.tsx`) in read → create → mutate order — appropriately sized, consistent with how the Salon Admin Dashboard plan was structured.
