"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { adminFetch, AdminApiError } from "@/lib/adminApi";
import { useToast } from "@/components/ui/Toast";
import { DashboardBooking } from "./page";

const STATUS_BADGE_VARIANT: Record<DashboardBooking["status"], "success" | "warning" | "danger" | "neutral"> = {
  pending: "warning",
  confirmed: "neutral",
  completed: "success",
  cancelled: "danger",
};

const ALL_STATUSES: DashboardBooking["status"][] = ["pending", "confirmed", "completed", "cancelled"];

interface BookingDetailModalProps {
  booking: DashboardBooking | null;
  onClose: () => void;
  onStatusChanged: (updated: DashboardBooking) => void;
}

export default function BookingDetailModal({ booking, onClose, onStatusChanged }: BookingDetailModalProps) {
  const [updating, setUpdating] = useState(false);
  const { showToast } = useToast();

  async function handleStatusChange(newStatus: DashboardBooking["status"]) {
    if (!booking) return;
    setUpdating(true);
    try {
      const updated = await adminFetch<{ status: DashboardBooking["status"] }>(`/dashboard/bookings/${booking.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      onStatusChanged({ ...booking, status: updated.status });
      showToast("Booking updated", "success");
      onClose();
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : "Failed to update booking";
      showToast(message, "error");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <Modal open={booking !== null} onClose={onClose}>
      {booking && (
        <div>
          <div className="flex items-center justify-between">
            <p className="font-serif text-xl text-ink">{booking.customer_name}</p>
            <Badge variant={STATUS_BADGE_VARIANT[booking.status]}>{booking.status}</Badge>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-taupe">Service</dt>
              <dd className="text-ink">{booking.service_name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-taupe">Staff</dt>
              <dd className="text-ink">{booking.staff_name ?? "Unassigned"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-taupe">Time</dt>
              <dd className="text-ink">{new Date(booking.scheduled_at).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-taupe">Phone</dt>
              <dd className="text-ink">{booking.customer_phone}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-taupe">Email</dt>
              <dd className="text-ink">{booking.customer_email}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            {ALL_STATUSES.filter((s) => s !== booking.status).map((s) => (
              <Button key={s} variant="secondary" disabled={updating} onClick={() => handleStatusChange(s)}>
                Mark {s}
              </Button>
            ))}
          </div>
          <button onClick={onClose} className="mt-4 text-sm text-taupe hover:text-ink">
            Close
          </button>
        </div>
      )}
    </Modal>
  );
}
