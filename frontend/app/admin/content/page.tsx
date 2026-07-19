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
            onChange={(e) => {
              setValues({ ...values, [field.key]: e.target.value });
              setSavedKey(null);
            }}
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
