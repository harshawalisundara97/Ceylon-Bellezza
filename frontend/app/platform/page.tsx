"use client";

import { useEffect, useState } from "react";
import { platformFetch, PlatformApiError } from "@/lib/platformApi";
import PageHeading from "@/components/ui/PageHeading";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

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

export default function PlatformSalonsPage() {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div>
      <PageHeading>Salons</PageHeading>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

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
