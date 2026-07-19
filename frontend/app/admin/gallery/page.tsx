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
