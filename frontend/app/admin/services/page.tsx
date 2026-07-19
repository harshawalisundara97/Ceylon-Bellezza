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
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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
    if (Number.isNaN(Number(form.price)) || Number.isNaN(Number(form.duration_minutes))) {
      setError("Price and duration must be numbers");
      return;
    }
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
    } finally {
      setConfirmingId(null);
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
            min="0"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="rounded border border-hairline px-3 py-2"
          />
          <input
            required
            type="number"
            placeholder="Duration (minutes)"
            min="0"
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
      ) : services.length === 0 ? (
        <p className="mt-6 text-taupe">No services yet — add your first one above.</p>
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
                  {confirmingId === service.id ? (
                    <>
                      <span className="mr-3 text-sm text-ink">Delete?</span>
                      <button onClick={() => handleDelete(service.id)} className="mr-3 text-sm text-red-600">
                        Confirm
                      </button>
                      <button onClick={() => setConfirmingId(null)} className="text-sm text-taupe">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(service)} className="mr-3 text-sm text-terracotta">
                        Edit
                      </button>
                      <button onClick={() => setConfirmingId(service.id)} className="text-sm text-red-600">
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
