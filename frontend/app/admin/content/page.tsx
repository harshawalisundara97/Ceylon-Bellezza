"use client";

import { useEffect, useState } from "react";
import { adminFetch, AdminApiError } from "@/lib/adminApi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Textarea from "@/components/ui/Textarea";
import PageHeading from "@/components/ui/PageHeading";

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
      <PageHeading>Content</PageHeading>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {FIELDS.map((field) => (
        <Card key={field.key} className="mt-6">
          <label className="block font-medium text-ink" htmlFor={field.key}>
            {field.label}
          </label>
          <Textarea
            id={field.key}
            rows={4}
            value={values[field.key]}
            onChange={(e) => {
              setValues({ ...values, [field.key]: e.target.value });
              setSavedKey(null);
            }}
            className="mt-2 w-full"
          />
          <div className="mt-3 flex items-center gap-3">
            <Button onClick={() => handleSave(field.key)} disabled={savingKey === field.key}>
              {savingKey === field.key ? "Saving..." : "Save"}
            </Button>
            {savedKey === field.key && <span className="text-sm text-taupe">Saved</span>}
          </div>
        </Card>
      ))}
    </div>
  );
}
