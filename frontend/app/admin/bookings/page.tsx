"use client";

import { useEffect, useState } from "react";
import { adminFetch, AdminApiError } from "@/lib/adminApi";
import PageHeading from "@/components/ui/PageHeading";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import DayCalendar from "./DayCalendar";

export interface DashboardBooking {
  id: string;
  salon_id: string;
  service_id: string;
  staff_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  gender: string;
  scheduled_at: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  service_name: string;
  staff_name: string | null;
}

export interface StaffMember {
  id: string;
  name: string;
  photo_url: string | null;
  bio: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

export default function BookingsPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [statusFilter, setStatusFilter] = useState("");
  const [bookings, setBookings] = useState<DashboardBooking[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const from = toIsoDate(selectedDate);
      const to = toIsoDate(addDays(selectedDate, 1));
      const params = new URLSearchParams({ from_date: from, to_date: to });
      if (statusFilter) params.set("status", statusFilter);
      const [bookingsData, staffData] = await Promise.all([
        adminFetch<DashboardBooking[]>(`/dashboard/bookings?${params.toString()}`),
        adminFetch<StaffMember[]>("/dashboard/staff"),
      ]);
      setBookings(bookingsData);
      setStaff(staffData);
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : "Failed to load bookings";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, statusFilter]);

  function updateBookingInPlace(updated: DashboardBooking) {
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? { ...b, status: updated.status } : b)));
  }

  return (
    <div>
      <PageHeading>Bookings</PageHeading>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => setSelectedDate((d) => addDays(d, -1))}>
          Previous
        </Button>
        <Button variant="secondary" onClick={() => setSelectedDate(new Date())}>
          Today
        </Button>
        <Button variant="secondary" onClick={() => setSelectedDate((d) => addDays(d, 1))}>
          Next
        </Button>
        <span className="text-sm font-medium text-ink">
          {selectedDate.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </span>
        <Dropdown value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Dropdown>
      </div>

      {loading ? (
        <div className="mt-6 flex flex-col gap-3">
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-16 rounded-md" />
        </div>
      ) : staff.length === 0 ? (
        <EmptyState title="No staff yet" description="Add staff members to start scheduling bookings." />
      ) : bookings.length === 0 ? (
        <EmptyState title="No bookings for this day" description="Try a different date or status filter." />
      ) : (
        <DayCalendar bookings={bookings} staff={staff} onSelectBooking={() => {}} />
      )}
    </div>
  );
}
