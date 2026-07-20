"use client";

import { useEffect, useState } from "react";
import { adminFetch, AdminApiError } from "@/lib/adminApi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import PageHeading from "@/components/ui/PageHeading";

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
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <div>
      <PageHeading>Staff</PageHeading>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <Card as="form" onSubmit={handleSubmit} className="mt-6">
        <p className="font-medium text-ink">{editingId ? "Edit staff member" : "Add staff member"}</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            placeholder="Photo URL"
            value={form.photo_url}
            onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
          />
          <Textarea
            placeholder="Bio"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="col-span-2"
          />
        </div>
        <div className="mt-4 flex gap-3">
          <Button type="submit">{editingId ? "Save changes" : "Add staff member"}</Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={cancelEdit}>
              Cancel
            </Button>
          )}
        </div>
      </Card>

      {loading ? (
        <p className="mt-6 text-taupe">Loading...</p>
      ) : staff.length === 0 ? (
        <p className="mt-6 text-taupe">No staff yet — add your first team member above.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {staff.map((member) => (
            <Card key={member.id} className="p-4 text-center">
              <img
                src={member.photo_url ?? "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80"}
                alt={member.name}
                className="mx-auto h-20 w-20 rounded-full border border-hairline object-cover"
              />
              <p className="mt-3 font-medium text-ink">{member.name}</p>
              <p className="mt-1 text-sm text-taupe">{member.bio}</p>
              <div className="mt-3 flex justify-center gap-3">
                {confirmingId === member.id ? (
                  <>
                    <span className="text-sm text-ink">Delete?</span>
                    <Button variant="danger" onClick={() => handleDelete(member.id)}>
                      Confirm
                    </Button>
                    <button onClick={() => setConfirmingId(null)} className="text-sm text-taupe">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(member)} className="text-sm text-terracotta">
                      Edit
                    </button>
                    <Button variant="danger" onClick={() => setConfirmingId(member.id)}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
