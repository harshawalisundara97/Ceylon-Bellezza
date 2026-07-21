"use client";

import { useState } from "react";
import { createBooking } from "@/lib/api";
import { SalonDetail } from "@/lib/types";

const EMPTY_FORM = {
  service_id: "",
  staff_id: "",
  scheduled_at: "",
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  gender: "" as "" | "male" | "female" | "other",
};

const FIELD_CLASS = "rounded border border-hairline px-3 py-2 focus:border-terracotta focus:outline-none";

export default function BookingForm({ salon }: { salon: SalonDetail }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createBooking(salon.slug, {
        service_id: form.service_id,
        staff_id: form.staff_id || null,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: form.customer_email,
        gender: form.gender as "male" | "female" | "other",
      });
      setSuccess(true);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <section id="book" className="mx-auto max-w-lg px-6 py-12">
        <p className="text-ink">Thanks — your booking request has been received. The salon will confirm shortly.</p>
      </section>
    );
  }

  return (
    <section id="book" className="mx-auto max-w-lg px-6 py-12">
      <h2 className="font-serif text-2xl text-ink">Book Appointment</h2>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="mt-6 rounded-lg border border-hairline bg-white p-5">
        <div className="grid gap-4">
          <select
            required
            className={FIELD_CLASS}
            value={form.service_id}
            onChange={(e) => setForm({ ...form, service_id: e.target.value })}
          >
            <option value="">Select a service</option>
            {salon.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — Rs. {s.price}
              </option>
            ))}
          </select>

          {salon.staff.length > 0 && (
            <select
              className={FIELD_CLASS}
              value={form.staff_id}
              onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
            >
              <option value="">No preference</option>
              {salon.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <input
            required
            type="datetime-local"
            className={FIELD_CLASS}
            value={form.scheduled_at}
            onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
          />
          <input
            required
            placeholder="Name"
            className={FIELD_CLASS}
            value={form.customer_name}
            onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
          />
          <input
            required
            type="tel"
            placeholder="Phone"
            className={FIELD_CLASS}
            value={form.customer_phone}
            onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
          />
          <input
            required
            type="email"
            placeholder="Email"
            className={FIELD_CLASS}
            value={form.customer_email}
            onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
          />
          <select
            required
            className={FIELD_CLASS}
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value as typeof form.gender })}
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="mt-4">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-terracotta px-4 py-2 text-white disabled:opacity-50"
          >
            {submitting ? "Booking..." : "Confirm Booking"}
          </button>
        </div>
      </form>
    </section>
  );
}
