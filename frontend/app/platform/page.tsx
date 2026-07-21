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
