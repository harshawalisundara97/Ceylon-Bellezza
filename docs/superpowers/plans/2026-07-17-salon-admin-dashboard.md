# Salon Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/admin/*` section in the existing `frontend/` Next.js app so salon owners can log in and manage their own services, staff, gallery, and about/contact content — all backend endpoints already exist and are untouched by this plan.

**Architecture:** All new code is Client Components under `frontend/app/admin/` and two new `frontend/lib/` modules (`adminAuth.ts` for localStorage token storage, `adminApi.ts` for an authenticated fetch wrapper). Task 1 builds the shared login/auth-guard shell; Tasks 2-5 each add one independent resource page (Services, Staff, Gallery, Content) that consumes Task 1's `adminApi`.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS (existing `ivory`/`ink`/`taupe`/`terracotta`/`hairline` tokens from `frontend/tailwind.config.ts` — no new tokens needed). No new npm dependencies.

## Global Constraints

- No backend changes. Every endpoint used below already exists and is covered by `backend/tests/` (`test_services.py`, `test_staff.py`, `test_gallery.py`, `test_content.py`, `test_auth.py`).
- No new npm dependencies — plain `useState`/`fetch`, matching `frontend/package.json` (`next`, `react`, `framer-motion` only).
- This frontend has no automated test suite by design (established in the original marketplace frontend spec). Every task's verification step is manual: run backend + frontend dev servers against already-seeded demo data and confirm via `curl` and/or browser.
- Postgres for local verification runs on port 5433 (`backend/.env`, already configured). Demo data (salons `glamour-lk`, `the-gents-room`, seeded via `backend/scripts/seed_demo_data.py`) is already seeded — do not re-run the seed script.
- Seeded salon-admin credentials for verification: `owner@glamour.lk` / `glamour123` (salon `glamour-lk`) and `owner@gentsroom.lk` / `gents123` (salon `the-gents-room`).
- Utilitarian dashboard visual style: `font-sans` (not `font-serif`), sidebar nav, table/grid layouts — not the public site's full-bleed hero treatment.
- Color tokens (already defined, do not redefine): `bg-ivory`, `text-ink`, `text-taupe`, `text-terracotta`/`bg-terracotta`/`border-terracotta` (+ `terracotta-light`), `border-hairline`/`divide-hairline`.

## File Structure

```
frontend/
  lib/
    adminAuth.ts          # saveToken/getToken/clearToken (localStorage key "cb_admin_token")
    adminApi.ts             # adminFetch<T>() wrapper: attaches Authorization header, throws AdminApiError,
                              # clears token + signals 401 via a thrown error with `status`
  app/
    admin/
      layout.tsx               # auth guard (redirects to /admin/login if no token) + sidebar nav
      login/
        page.tsx                   # email/password form -> POST /auth/salon-admin/login
      page.tsx                       # dashboard home: static welcome + 4 links
      services/
        page.tsx                       # list + inline add/edit/delete
      staff/
        page.tsx                       # list + inline add/edit/delete
      gallery/
        page.tsx                       # grid + add/delete (no edit)
      content/
        page.tsx                       # fixed two-field form: about_us, contact_info
```

---

### Task 1: Admin auth foundation — token storage, API wrapper, login page, route guard

**Files:**
- Create: `frontend/lib/adminAuth.ts`
- Create: `frontend/lib/adminApi.ts`
- Create: `frontend/app/admin/login/page.tsx`
- Create: `frontend/app/admin/layout.tsx`
- Create: `frontend/app/admin/page.tsx`

**Interfaces:**
- Consumes: nothing (foundational task).
- Produces: `adminAuth.saveToken(token: string): void`, `adminAuth.getToken(): string | null`, `adminAuth.clearToken(): void`; `adminApi.adminFetch<T>(path: string, options?: RequestInit): Promise<T>` — throws `AdminApiError` (with `.status: number` and `.message: string`) on any non-2xx response, and on `status === 401` also calls `adminAuth.clearToken()` before throwing. Tasks 2-5 all import `adminFetch` and `AdminApiError` from `@/lib/adminApi`.

- [ ] **Step 1: Create `frontend/lib/adminAuth.ts`**

```ts
const TOKEN_KEY = "cb_admin_token";

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

- [ ] **Step 2: Create `frontend/lib/adminApi.ts`**

```ts
import { getToken, clearToken } from "./adminAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class AdminApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    clearToken();
    throw new AdminApiError(401, "Not authenticated");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    throw new AdminApiError(response.status, body.detail ?? "Request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function loginSalonAdmin(email: string, password: string): Promise<string> {
  const response = await fetch(`${API_URL}/auth/salon-admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new AdminApiError(response.status, "Invalid email or password");
  }
  const data = await response.json();
  return data.access_token;
}
```

- [ ] **Step 3: Create `frontend/app/admin/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginSalonAdmin, AdminApiError } from "@/lib/adminApi";
import { saveToken } from "@/lib/adminAuth";

export default function AdminLoginPage() {
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
      const token = await loginSalonAdmin(email, password);
      saveToken(token);
      router.push("/admin");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Something went wrong — try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ivory px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-hairline bg-white p-8">
        <h1 className="text-xl font-semibold text-ink">Salon Admin Login</h1>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <label className="mt-6 block text-sm text-taupe">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-hairline px-3 py-2 text-ink focus:border-terracotta focus:outline-none"
          />
        </label>
        <label className="mt-4 block text-sm text-taupe">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-hairline px-3 py-2 text-ink focus:border-terracotta focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded bg-terracotta py-2 text-white disabled:opacity-50"
        >
          {submitting ? "Logging in..." : "Log In"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Create `frontend/app/admin/layout.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getToken, clearToken } from "@/lib/adminAuth";

const NAV_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/gallery", label: "Gallery" },
  { href: "/admin/content", label: "Content" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") {
      setChecked(true);
      return;
    }
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    setChecked(true);
  }, [pathname, router]);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (!checked) {
    return null;
  }

  function handleLogout() {
    clearToken();
    router.push("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-ivory">
      <aside className="w-56 shrink-0 border-r border-hairline bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-terracotta">Salon Admin</p>
        <nav className="mt-6 flex flex-col gap-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded px-3 py-2 text-sm ${
                pathname === link.href ? "bg-terracotta/10 text-terracotta" : "text-ink hover:bg-ivory"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button onClick={handleLogout} className="mt-8 text-sm text-taupe hover:text-terracotta">
          Log Out
        </button>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 5: Create `frontend/app/admin/page.tsx`**

```tsx
import Link from "next/link";

const SECTIONS = [
  { href: "/admin/services", label: "Services", description: "Manage the services your salon offers." },
  { href: "/admin/staff", label: "Staff", description: "Manage your team's profiles." },
  { href: "/admin/gallery", label: "Gallery", description: "Manage photos shown on your public page." },
  { href: "/admin/content", label: "Content", description: "Edit your About Us and Contact info." },
];

export default function AdminHomePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Welcome back</h1>
      <p className="mt-1 text-taupe">Manage your salon's public listing from here.</p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-lg border border-hairline bg-white p-5 hover:border-terracotta"
          >
            <p className="font-semibold text-ink">{section.label}</p>
            <p className="mt-1 text-sm text-taupe">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify the login and guard flow manually**

```bash
pg_isready -h localhost -p 5433 || brew services start postgresql@15
cd backend && .venv/bin/uvicorn app.main:app --port 8000 &
cd ../frontend && npm run dev &
sleep 6
# Unauthenticated visit redirects to login (check final URL via curl -L is unreliable for client-side redirects,
# so this step is verified in the browser, not curl):
curl -s http://localhost:3000/admin/login | grep -o "Salon Admin Login"
kill %1 %2
```

Expected: the grep finds a match (login page renders). Follow up with a browser check: visit `http://localhost:3000/admin` directly — it should redirect to `/admin/login` (client-side redirect, confirm via screenshot showing the login form). Then log in with `owner@glamour.lk` / `glamour123` and confirm it redirects to `/admin` and shows the four section links with a sidebar.

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/adminAuth.ts frontend/lib/adminApi.ts frontend/app/admin/login/page.tsx frontend/app/admin/layout.tsx frontend/app/admin/page.tsx
git commit -m "feat: add salon admin auth foundation and dashboard shell"
```

---

### Task 2: Services management page

**Files:**
- Create: `frontend/app/admin/services/page.tsx`

**Interfaces:**
- Consumes: `adminFetch<T>` and `AdminApiError` from `@/lib/adminApi` (Task 1).
- Produces: nothing consumed by later tasks — Tasks 3-5 are independent siblings.

- [ ] **Step 1: Create `frontend/app/admin/services/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { adminFetch, AdminApiError } from "@/lib/adminApi";

interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration_minutes: number;
}

const EMPTY_FORM = { name: "", description: "", category: "", price: "", duration_minutes: "" };

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadServices() {
    setLoading(true);
    try {
      const data = await adminFetch<Service[]>("/dashboard/services");
      setServices(data);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to load services");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadServices();
  }, []);

  function startEdit(service: Service) {
    setEditingId(service.id);
    setForm({
      name: service.name,
      description: service.description,
      category: service.category,
      price: String(service.price),
      duration_minutes: String(service.duration_minutes),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const payload = {
      name: form.name,
      description: form.description,
      category: form.category,
      price: Number(form.price),
      duration_minutes: Number(form.duration_minutes),
    };
    try {
      if (editingId) {
        await adminFetch<Service>(`/dashboard/services/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await adminFetch<Service>("/dashboard/services", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      cancelEdit();
      await loadServices();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to save service");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await adminFetch<void>(`/dashboard/services/${id}`, { method: "DELETE" });
      await loadServices();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to delete service");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Services</h1>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="mt-6 rounded-lg border border-hairline bg-white p-5">
        <p className="font-medium text-ink">{editingId ? "Edit service" : "Add service"}</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded border border-hairline px-3 py-2"
          />
          <input
            required
            placeholder="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="rounded border border-hairline px-3 py-2"
          />
          <input
            required
            type="number"
            step="0.01"
            placeholder="Price"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="rounded border border-hairline px-3 py-2"
          />
          <input
            required
            type="number"
            placeholder="Duration (minutes)"
            value={form.duration_minutes}
            onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
            className="rounded border border-hairline px-3 py-2"
          />
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="col-span-2 rounded border border-hairline px-3 py-2"
          />
        </div>
        <div className="mt-4 flex gap-3">
          <button type="submit" className="rounded bg-terracotta px-4 py-2 text-white">
            {editingId ? "Save changes" : "Add service"}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="rounded border border-hairline px-4 py-2 text-ink">
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="mt-6 text-taupe">Loading...</p>
      ) : (
        <table className="mt-6 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-hairline text-sm text-taupe">
              <th className="py-2">Name</th>
              <th className="py-2">Category</th>
              <th className="py-2">Price</th>
              <th className="py-2">Duration</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {services.map((service) => (
              <tr key={service.id}>
                <td className="py-3 text-ink">{service.name}</td>
                <td className="py-3 text-taupe">{service.category}</td>
                <td className="py-3 text-ink">Rs. {service.price.toLocaleString()}</td>
                <td className="py-3 text-taupe">{service.duration_minutes} min</td>
                <td className="py-3 text-right">
                  <button onClick={() => startEdit(service)} className="mr-3 text-sm text-terracotta">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(service.id)} className="text-sm text-red-600">
                    Delete
                  </button>
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

- [ ] **Step 2: Verify against the seeded data**

```bash
pg_isready -h localhost -p 5433 || brew services start postgresql@15
cd backend && .venv/bin/uvicorn app.main:app --port 8000 &
cd ../frontend && npm run dev &
sleep 6
TOKEN=$(curl -s -X POST http://localhost:8000/auth/salon-admin/login -H "Content-Type: application/json" -d '{"email":"owner@glamour.lk","password":"glamour123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s http://localhost:8000/dashboard/services -H "Authorization: Bearer $TOKEN" | grep -o "Women's Haircut"
kill %1 %2
```

Expected: the grep finds a match, confirming the seeded service data is reachable via the same endpoint the page calls. Follow up in the browser: log in as `owner@glamour.lk` / `glamour123`, visit `/admin/services`, confirm the three seeded services list, then add a new service, edit it, and delete it — confirming each round-trips against the real API. Take a screenshot of the populated table.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/admin/services/page.tsx
git commit -m "feat: add salon admin services management page"
```

---

### Task 3: Staff management page

**Files:**
- Create: `frontend/app/admin/staff/page.tsx`

**Interfaces:**
- Consumes: `adminFetch<T>` and `AdminApiError` from `@/lib/adminApi` (Task 1).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Create `frontend/app/admin/staff/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { adminFetch, AdminApiError } from "@/lib/adminApi";

interface Staff {
  id: string;
  name: string;
  photo_url: string | null;
  bio: string;
}

const EMPTY_FORM = { name: "", photo_url: "", bio: "" };

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadStaff() {
    setLoading(true);
    try {
      const data = await adminFetch<Staff[]>("/dashboard/staff");
      setStaff(data);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStaff();
  }, []);

  function startEdit(member: Staff) {
    setEditingId(member.id);
    setForm({ name: member.name, photo_url: member.photo_url ?? "", bio: member.bio });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const payload = { name: form.name, photo_url: form.photo_url || null, bio: form.bio };
    try {
      if (editingId) {
        await adminFetch<Staff>(`/dashboard/staff/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await adminFetch<Staff>("/dashboard/staff", { method: "POST", body: JSON.stringify(payload) });
      }
      cancelEdit();
      await loadStaff();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to save staff member");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await adminFetch<void>(`/dashboard/staff/${id}`, { method: "DELETE" });
      await loadStaff();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to delete staff member");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Staff</h1>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="mt-6 rounded-lg border border-hairline bg-white p-5">
        <p className="font-medium text-ink">{editingId ? "Edit staff member" : "Add staff member"}</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded border border-hairline px-3 py-2"
          />
          <input
            placeholder="Photo URL"
            value={form.photo_url}
            onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
            className="rounded border border-hairline px-3 py-2"
          />
          <textarea
            placeholder="Bio"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="col-span-2 rounded border border-hairline px-3 py-2"
          />
        </div>
        <div className="mt-4 flex gap-3">
          <button type="submit" className="rounded bg-terracotta px-4 py-2 text-white">
            {editingId ? "Save changes" : "Add staff member"}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="rounded border border-hairline px-4 py-2 text-ink">
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="mt-6 text-taupe">Loading...</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {staff.map((member) => (
            <div key={member.id} className="rounded-lg border border-hairline bg-white p-4 text-center">
              <img
                src={member.photo_url ?? "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80"}
                alt={member.name}
                className="mx-auto h-20 w-20 rounded-full border border-hairline object-cover"
              />
              <p className="mt-3 font-medium text-ink">{member.name}</p>
              <p className="mt-1 text-sm text-taupe">{member.bio}</p>
              <div className="mt-3 flex justify-center gap-3">
                <button onClick={() => startEdit(member)} className="text-sm text-terracotta">
                  Edit
                </button>
                <button onClick={() => handleDelete(member.id)} className="text-sm text-red-600">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify against the seeded data**

```bash
pg_isready -h localhost -p 5433 || brew services start postgresql@15
cd backend && .venv/bin/uvicorn app.main:app --port 8000 &
cd ../frontend && npm run dev &
sleep 6
TOKEN=$(curl -s -X POST http://localhost:8000/auth/salon-admin/login -H "Content-Type: application/json" -d '{"email":"owner@glamour.lk","password":"glamour123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s http://localhost:8000/dashboard/staff -H "Authorization: Bearer $TOKEN" | grep -o "Nadeesha Perera"
kill %1 %2
```

Expected: the grep finds a match. Follow up in the browser: visit `/admin/staff`, confirm the two seeded staff cards render, add/edit/delete a staff member, and screenshot the result.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/admin/staff/page.tsx
git commit -m "feat: add salon admin staff management page"
```

---

### Task 4: Gallery management page

**Files:**
- Create: `frontend/app/admin/gallery/page.tsx`

**Interfaces:**
- Consumes: `adminFetch<T>` and `AdminApiError` from `@/lib/adminApi` (Task 1).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Create `frontend/app/admin/gallery/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { adminFetch, AdminApiError } from "@/lib/adminApi";

interface GalleryItem {
  id: string;
  image_url: string;
  caption: string;
}

const EMPTY_FORM = { image_url: "", caption: "" };

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadItems() {
    setLoading(true);
    try {
      const data = await adminFetch<GalleryItem[]>("/dashboard/gallery");
      setItems(data);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to load gallery");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await adminFetch<GalleryItem>("/dashboard/gallery", { method: "POST", body: JSON.stringify(form) });
      setForm(EMPTY_FORM);
      await loadItems();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to add photo");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await adminFetch<void>(`/dashboard/gallery/${id}`, { method: "DELETE" });
      await loadItems();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to delete photo");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Gallery</h1>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="mt-6 rounded-lg border border-hairline bg-white p-5">
        <p className="font-medium text-ink">Add photo</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <input
            required
            placeholder="Image URL"
            value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            className="rounded border border-hairline px-3 py-2"
          />
          <input
            placeholder="Caption"
            value={form.caption}
            onChange={(e) => setForm({ ...form, caption: e.target.value })}
            className="rounded border border-hairline px-3 py-2"
          />
        </div>
        <button type="submit" className="mt-4 rounded bg-terracotta px-4 py-2 text-white">
          Add photo
        </button>
      </form>

      {loading ? (
        <p className="mt-6 text-taupe">Loading...</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-lg border border-hairline bg-white">
              <img src={item.image_url} alt={item.caption || "Gallery photo"} className="aspect-square w-full object-cover" />
              <div className="p-3">
                <p className="text-sm text-taupe">{item.caption}</p>
                <button onClick={() => handleDelete(item.id)} className="mt-2 text-sm text-red-600">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify against the seeded data**

```bash
pg_isready -h localhost -p 5433 || brew services start postgresql@15
cd backend && .venv/bin/uvicorn app.main:app --port 8000 &
cd ../frontend && npm run dev &
sleep 6
TOKEN=$(curl -s -X POST http://localhost:8000/auth/salon-admin/login -H "Content-Type: application/json" -d '{"email":"owner@glamour.lk","password":"glamour123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s http://localhost:8000/dashboard/gallery -H "Authorization: Bearer $TOKEN" | grep -o "Salon interior"
kill %1 %2
```

Expected: the grep finds a match. Follow up in the browser: visit `/admin/gallery`, confirm the two seeded photos render, add a new photo, delete it, and screenshot the result.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/admin/gallery/page.tsx
git commit -m "feat: add salon admin gallery management page"
```

---

### Task 5: Content management page

**Files:**
- Create: `frontend/app/admin/content/page.tsx`

**Interfaces:**
- Consumes: `adminFetch<T>` and `AdminApiError` from `@/lib/adminApi` (Task 1).
- Produces: nothing consumed by later tasks (final task in this plan).

- [ ] **Step 1: Create `frontend/app/admin/content/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { adminFetch, AdminApiError } from "@/lib/adminApi";

interface ContentBlock {
  id: string;
  key: string;
  value: string;
}

const FIELDS = [
  { key: "about_us", label: "About Us" },
  { key: "contact_info", label: "Contact Info" },
];

export default function ContentPage() {
  const [values, setValues] = useState<Record<string, string>>({ about_us: "", contact_info: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  useEffect(() => {
    async function loadContent() {
      setLoading(true);
      try {
        const blocks = await adminFetch<ContentBlock[]>("/dashboard/content");
        const next: Record<string, string> = { about_us: "", contact_info: "" };
        for (const block of blocks) {
          next[block.key] = block.value;
        }
        setValues(next);
      } catch (err) {
        setError(err instanceof AdminApiError ? err.message : "Failed to load content");
      } finally {
        setLoading(false);
      }
    }
    loadContent();
  }, []);

  async function handleSave(key: string) {
    setError(null);
    setSavingKey(key);
    setSavedKey(null);
    try {
      await adminFetch<ContentBlock>(`/dashboard/content/${key}`, {
        method: "PUT",
        body: JSON.stringify({ value: values[key] }),
      });
      setSavedKey(key);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to save content");
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return <p className="text-taupe">Loading...</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Content</h1>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {FIELDS.map((field) => (
        <div key={field.key} className="mt-6 rounded-lg border border-hairline bg-white p-5">
          <label className="block font-medium text-ink" htmlFor={field.key}>
            {field.label}
          </label>
          <textarea
            id={field.key}
            rows={4}
            value={values[field.key]}
            onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
            className="mt-2 w-full rounded border border-hairline px-3 py-2"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => handleSave(field.key)}
              disabled={savingKey === field.key}
              className="rounded bg-terracotta px-4 py-2 text-white disabled:opacity-50"
            >
              {savingKey === field.key ? "Saving..." : "Save"}
            </button>
            {savedKey === field.key && <span className="text-sm text-taupe">Saved</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify against the seeded data**

```bash
pg_isready -h localhost -p 5433 || brew services start postgresql@15
cd backend && .venv/bin/uvicorn app.main:app --port 8000 &
cd ../frontend && npm run dev &
sleep 6
TOKEN=$(curl -s -X POST http://localhost:8000/auth/salon-admin/login -H "Content-Type: application/json" -d '{"email":"owner@glamour.lk","password":"glamour123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s http://localhost:8000/dashboard/content -H "Authorization: Bearer $TOKEN" | grep -o "Colombo's go-to destination"
kill %1 %2
```

Expected: the grep finds a match. Follow up in the browser: visit `/admin/content`, confirm both fields are pre-filled with the seeded text, edit and save one field, reload the page, and confirm the edit persisted.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/admin/content/page.tsx
git commit -m "feat: add salon admin content management page"
```

---

## Self-Review Notes

- **Spec coverage**: auth foundation + route guard (Task 1), Services CRUD (Task 2), Staff CRUD (Task 3), Gallery create/list/delete (Task 4, no edit — matches backend's lack of an update endpoint), Content upsert for both fixed keys (Task 5). Every salon-admin backend endpoint from the spec has a corresponding task.
- **Placeholder scan**: no TBD/TODO; every step has complete, runnable code including exact endpoint paths and status-code expectations pulled from `backend/tests/`.
- **Type consistency**: `adminFetch<T>` and `AdminApiError` (defined in Task 1) are imported with identical names and signatures in Tasks 2-5. Each page's local interface (`Service`, `Staff`, `GalleryItem`, `ContentBlock`) matches the corresponding backend `*Read` schema's fields exactly (verified against `backend/app/schemas/`).
- **Scope check**: five tasks, each independently testable and committable; Tasks 2-5 have no interdependencies and could be reordered or parallelized by different subagents since none produces an interface another consumes.
