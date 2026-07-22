"use client";

import { useState } from "react";
import { createLead } from "@/lib/api";

const EMPTY_FORM = { contact_name: "", contact_phone: "", contact_email: "", message: "" };

const FIELD_CLASS = "rounded border border-hairline px-3 py-2 focus:border-terracotta focus:outline-none";

export default function JoinPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createLead(form);
      setSuccess(true);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="font-serif text-3xl text-ink">Thanks for reaching out</h1>
        <p className="mt-3 text-taupe">We'll review your details and get back to you soon.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-24">
      <h1 className="font-serif text-3xl text-ink">List Your Salon</h1>
      <p className="mt-2 text-taupe">Tell us about your salon and we'll be in touch.</p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="mt-6 rounded-lg border border-hairline bg-white p-5">
        <div className="grid gap-4">
          <input
            required
            placeholder="Your name"
            className={FIELD_CLASS}
            value={form.contact_name}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
          />
          <input
            required
            type="tel"
            placeholder="Phone"
            className={FIELD_CLASS}
            value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
          />
          <input
            required
            type="email"
            placeholder="Email"
            className={FIELD_CLASS}
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
          />
          <textarea
            placeholder="Tell us about your salon"
            rows={4}
            className={FIELD_CLASS}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="mt-4 rounded bg-terracotta px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? "Sending..." : "Submit"}
        </button>
      </form>
    </main>
  );
}
