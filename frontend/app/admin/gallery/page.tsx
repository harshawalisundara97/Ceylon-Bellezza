"use client";

import { useEffect, useState } from "react";
import { adminFetch, AdminApiError } from "@/lib/adminApi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import PageHeading from "@/components/ui/PageHeading";

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
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <div>
      <PageHeading>Gallery</PageHeading>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <Card as="form" onSubmit={handleSubmit} className="mt-6">
        <p className="font-medium text-ink">Add photo</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Input
            required
            placeholder="Image URL"
            value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
          />
          <Input
            placeholder="Caption"
            value={form.caption}
            onChange={(e) => setForm({ ...form, caption: e.target.value })}
          />
        </div>
        <Button type="submit" className="mt-4">
          Add photo
        </Button>
      </Card>

      {loading ? (
        <p className="mt-6 text-taupe">Loading...</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-taupe">No photos yet — add your first one above.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <Card key={item.id} padding={false} className="overflow-hidden">
              <img src={item.image_url} alt={item.caption || "Gallery photo"} className="aspect-square w-full object-cover" />
              <div className="p-3">
                <p className="text-sm text-taupe">{item.caption}</p>
                {confirmingId === item.id ? (
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-sm text-ink">Delete?</span>
                    <Button variant="danger" onClick={() => handleDelete(item.id)}>
                      Confirm
                    </Button>
                    <button onClick={() => setConfirmingId(null)} className="text-sm text-taupe">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <Button variant="danger" onClick={() => setConfirmingId(item.id)} className="mt-2">
                    Delete
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
