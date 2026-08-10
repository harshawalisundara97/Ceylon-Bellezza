"use client";

import { DashboardBooking, StaffMember } from "./page";

const WINDOW_START_HOUR = 8;
const WINDOW_END_HOUR = 20;
const WINDOW_MINUTES = (WINDOW_END_HOUR - WINDOW_START_HOUR) * 60;
const BLOCK_MINUTES = 30;
const PX_PER_HOUR = 60;
const GRID_HEIGHT_PX = (WINDOW_END_HOUR - WINDOW_START_HOUR) * PX_PER_HOUR;

const STATUS_BAR_CLASS: Record<DashboardBooking["status"], string> = {
  pending: "bg-amber-100 border-amber-400 text-amber-800",
  confirmed: "bg-accent-light border-accent text-accent",
  completed: "bg-hairline border-taupe text-ink",
  cancelled: "bg-red-100 border-danger text-danger",
};

function minutesSinceWindowStart(isoDateTime: string): number {
  const d = new Date(isoDateTime);
  return (d.getHours() - WINDOW_START_HOUR) * 60 + d.getMinutes();
}

function formatTime(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

interface DayCalendarProps {
  bookings: DashboardBooking[];
  staff: StaffMember[];
  onSelectBooking: (booking: DashboardBooking) => void;
}

export default function DayCalendar({ bookings, staff, onSelectBooking }: DayCalendarProps) {
  const hourLabels = Array.from(
    { length: WINDOW_END_HOUR - WINDOW_START_HOUR + 1 },
    (_, i) => WINDOW_START_HOUR + i
  );

  const bookingsByStaff = new Map<string, DashboardBooking[]>();
  const unassigned: DashboardBooking[] = [];
  for (const booking of bookings) {
    if (!booking.staff_id) {
      unassigned.push(booking);
      continue;
    }
    const list = bookingsByStaff.get(booking.staff_id) ?? [];
    list.push(booking);
    bookingsByStaff.set(booking.staff_id, list);
  }

  const columns = [...staff.map((s) => ({ id: s.id, name: s.name })), { id: "__unassigned__", name: "Unassigned" }];

  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-hairline">
      <div className="flex min-w-max">
        <div className="w-16 shrink-0 border-r border-hairline">
          <div className="h-10 border-b border-hairline" />
          <div style={{ height: GRID_HEIGHT_PX }} className="relative">
            {hourLabels.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 -translate-y-1/2 px-1 text-xs text-taupe"
                style={{ top: `${((hour - WINDOW_START_HOUR) / (WINDOW_END_HOUR - WINDOW_START_HOUR)) * 100}%` }}
              >
                {hour}:00
              </div>
            ))}
          </div>
        </div>
        {columns.map((column) => {
          const columnBookings = column.id === "__unassigned__" ? unassigned : bookingsByStaff.get(column.id) ?? [];
          return (
            <div key={column.id} className="w-48 shrink-0 border-r border-hairline last:border-r-0">
              <div className="flex h-10 items-center justify-center border-b border-hairline px-2 text-sm font-medium text-ink">
                {column.name}
              </div>
              <div style={{ height: GRID_HEIGHT_PX }} className="relative overflow-hidden bg-bg">
                {hourLabels.slice(0, -1).map((hour) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-hairline/60"
                    style={{ top: `${((hour - WINDOW_START_HOUR) / (WINDOW_END_HOUR - WINDOW_START_HOUR)) * 100}%` }}
                  />
                ))}
                {columnBookings.map((booking) => {
                  const offset = minutesSinceWindowStart(booking.scheduled_at);
                  if (offset < 0 || offset >= WINDOW_MINUTES) return null;
                  const top = (offset / WINDOW_MINUTES) * 100;
                  const height = (BLOCK_MINUTES / WINDOW_MINUTES) * 100;
                  return (
                    <button
                      key={booking.id}
                      onClick={() => onSelectBooking(booking)}
                      className={`absolute left-1 right-1 overflow-hidden rounded border px-1 text-left text-xs ${STATUS_BAR_CLASS[booking.status]}`}
                      style={{ top: `${top}%`, height: `${height}%` }}
                    >
                      <span className="block truncate font-medium">{formatTime(booking.scheduled_at)}</span>
                      <span className="block truncate">{booking.customer_name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
