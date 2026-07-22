"use client";

import { useEffect, useState } from "react";
import { platformFetch, PlatformApiError } from "@/lib/platformApi";

interface Lead {
  id: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  message: string;
  status: string;
  created_at: string;
}

const EMPTY_APPROVE_FORM = { slug: "", name: "", category: "", address: "", city: "", latitude: "", longitude: "" };

const FIELD_CLASS = "rounded border border-hairline px-3 py-2 focus:border-terracotta focus:outline-none";

export default function PlatformLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [approveForm, setApproveForm] = useState(EMPTY_APPROVE_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ leadId: string; email: string; password: string; emailSent: boolean } | null>(
    null
  );

  async function loadLeads() {
    setLoading(true);
    try {
      const data = await platformFetch<Lead[]>("/admin/leads");
      setLeads(data);
    } catch (err) {
      setError(err instanceof PlatformApiError ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

  function startReview(lead: Lead) {
    setReviewingId(lead.id);
    setApproveForm(EMPTY_APPROVE_FORM);
    setResult(null);
  }

  async function handleReject(leadId: string) {
    setError(null);
    try {
      const updated = await platformFetch<Lead>(`/admin/leads/${leadId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "rejected" }),
      });
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setReviewingId(null);
    } catch (err) {
      setError(err instanceof PlatformApiError ? err.message : "Failed to reject lead");
    }
  }

  async function handleApprove(event: React.FormEvent, leadId: string, contactEmail: string) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        slug: approveForm.slug,
        name: approveForm.name,
        category: approveForm.category,
        address: approveForm.address,
        city: approveForm.city,
        latitude: approveForm.latitude ? Number(approveForm.latitude) : null,
        longitude: approveForm.longitude ? Number(approveForm.longitude) : null,
      };
      const response = await platformFetch<{ email_sent: boolean; temporary_password: string }>(
        `/admin/leads/${leadId}/approve`,
        { method: "POST", body: JSON.stringify(payload) }
      );
      setResult({
        leadId,
        email: contactEmail,
        password: response.temporary_password,
        emailSent: response.email_sent,
      });
      await loadLeads();
      setReviewingId(null);
    } catch (err) {
      setError(err instanceof PlatformApiError ? err.message : "Failed to approve lead");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="font-serif text-2xl text-ink">Leads</h1>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {result && (
        <div className="mt-4 rounded-lg border border-hairline bg-white p-4 text-sm">
          <p className="text-ink">
            Salon created for <strong>{result.email}</strong>.{" "}
            {result.emailSent ? "Invite email sent." : "Invite email failed to send — share these manually:"}
          </p>
          {!result.emailSent && (
            <p className="mt-1 text-taupe">
              Email: {result.email} — Temporary password: <strong>{result.password}</strong>
            </p>
          )}
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-taupe">Loading...</p>
      ) : leads.length === 0 ? (
        <p className="mt-6 text-taupe">No leads yet.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {leads.map((lead) => (
            <div key={lead.id} className="rounded-lg border border-hairline bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{lead.contact_name}</p>
                  <p className="text-sm text-taupe">
                    {lead.contact_phone} · {lead.contact_email}
                  </p>
                  <p className="text-xs text-taupe">
                    {new Date(lead.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${
                    lead.status === "pending"
                      ? "bg-terracotta/10 text-terracotta"
                      : lead.status === "approved"
                        ? "bg-hairline text-ink"
                        : "bg-hairline text-taupe"
                  }`}
                >
                  {lead.status}
                </span>
              </div>
              {lead.message && <p className="mt-2 text-sm text-taupe">{lead.message}</p>}

              {lead.status === "pending" && reviewingId !== lead.id && (
                <div className="mt-3 flex gap-3">
                  <button onClick={() => startReview(lead)} className="text-sm text-terracotta">
                    Review
                  </button>
                  <button onClick={() => handleReject(lead.id)} className="text-sm text-red-600">
                    Reject
                  </button>
                </div>
              )}

              {reviewingId === lead.id && (
                <form onSubmit={(e) => handleApprove(e, lead.id, lead.contact_email)} className="mt-4 border-t border-hairline pt-4">
                  <p className="text-sm font-medium text-ink">Approve — enter salon details</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <input
                      required
                      placeholder="Slug"
                      className={FIELD_CLASS}
                      value={approveForm.slug}
                      onChange={(e) => setApproveForm({ ...approveForm, slug: e.target.value })}
                    />
                    <input
                      required
                      placeholder="Name"
                      className={FIELD_CLASS}
                      value={approveForm.name}
                      onChange={(e) => setApproveForm({ ...approveForm, name: e.target.value })}
                    />
                    <input
                      required
                      placeholder="Category (mens/womens/unisex)"
                      className={FIELD_CLASS}
                      value={approveForm.category}
                      onChange={(e) => setApproveForm({ ...approveForm, category: e.target.value })}
                    />
                    <input
                      required
                      placeholder="City"
                      className={FIELD_CLASS}
                      value={approveForm.city}
                      onChange={(e) => setApproveForm({ ...approveForm, city: e.target.value })}
                    />
                    <input
                      required
                      placeholder="Address"
                      className={`${FIELD_CLASS} col-span-2`}
                      value={approveForm.address}
                      onChange={(e) => setApproveForm({ ...approveForm, address: e.target.value })}
                    />
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="Latitude (optional)"
                      className={FIELD_CLASS}
                      value={approveForm.latitude}
                      onChange={(e) => setApproveForm({ ...approveForm, latitude: e.target.value })}
                    />
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="Longitude (optional)"
                      className={FIELD_CLASS}
                      value={approveForm.longitude}
                      onChange={(e) => setApproveForm({ ...approveForm, longitude: e.target.value })}
                    />
                  </div>
                  <div className="mt-3 flex gap-3">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded bg-terracotta px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      {submitting ? "Approving..." : "Approve & Create Salon"}
                    </button>
                    <button type="button" onClick={() => setReviewingId(null)} className="text-sm text-taupe">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
