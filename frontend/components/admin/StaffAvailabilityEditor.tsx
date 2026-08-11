"use client";

import { useEffect, useState } from "react";
import Dropdown from "@/components/ui/Dropdown";
import Button from "@/components/ui/Button";
import { adminFetch, AdminApiError } from "@/lib/adminApi";
import { useToast } from "@/components/ui/Toast";

interface StaffOption {
  id: string;
  name: string;
}

interface Availability {
  id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface DayRow {
  dayOfWeek: number;
  available: boolean;
  startTime: string;
  endTime: string;
  existingId: string | null;
}

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function buildRows(existing: Availability[]): DayRow[] {
  return DAY_LABELS.map((_, dayOfWeek) => {
    const match = existing.find((a) => a.day_of_week === dayOfWeek);
    return match
      ? { dayOfWeek, available: true, startTime: match.start_time, endTime: match.end_time, existingId: match.id }
      : { dayOfWeek, available: false, startTime: "09:00", endTime: "17:00", existingId: null };
  });
}

interface StaffAvailabilityEditorProps {
  staff: StaffOption[];
}

export default function StaffAvailabilityEditor({ staff }: StaffAvailabilityEditorProps) {
  const [selectedStaffId, setSelectedStaffId] = useState(staff[0]?.id ?? "");
  const [rows, setRows] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!selectedStaffId) return;
    setLoading(true);
    adminFetch<Availability[]>(`/dashboard/staff/${selectedStaffId}/availability`)
      .then((data) => setRows(buildRows(data)))
      .catch((err) => {
        const message = err instanceof AdminApiError ? err.message : "Failed to load availability";
        showToast(message, "error");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStaffId]);

  function updateRow(dayOfWeek: number, patch: Partial<DayRow>) {
    setRows((prev) => prev.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row)));
  }

  async function handleSave() {
    if (!selectedStaffId) return;
    setSaving(true);
    try {
      for (const row of rows) {
        if (row.available && !row.existingId) {
          await adminFetch(`/dashboard/staff/${selectedStaffId}/availability`, {
            method: "POST",
            body: JSON.stringify({ day_of_week: row.dayOfWeek, start_time: row.startTime, end_time: row.endTime }),
          });
        } else if (row.available && row.existingId) {
          await adminFetch(`/dashboard/staff/${selectedStaffId}/availability/${row.existingId}`, {
            method: "PUT",
            body: JSON.stringify({ day_of_week: row.dayOfWeek, start_time: row.startTime, end_time: row.endTime }),
          });
        } else if (!row.available && row.existingId) {
          await adminFetch(`/dashboard/staff/${selectedStaffId}/availability/${row.existingId}`, {
            method: "DELETE",
          });
        }
      }
      const refreshed = await adminFetch<Availability[]>(`/dashboard/staff/${selectedStaffId}/availability`);
      setRows(buildRows(refreshed));
      showToast("Working hours saved", "success");
    } catch (err) {
      const message = err instanceof AdminApiError ? err.message : "Failed to save working hours";
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  if (staff.length === 0) {
    return <p className="mt-6 text-sm text-taupe">Add a staff member first to set their working hours.</p>;
  }

  return (
    <div className="mt-6">
      <Dropdown value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)}>
        {staff.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </Dropdown>

      {loading ? (
        <p className="mt-4 text-sm text-taupe">Loading...</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {rows.map((row) => (
            <div key={row.dayOfWeek} className="flex items-center gap-4 rounded-md border border-hairline p-3">
              <label className="flex w-32 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={row.available}
                  onChange={(e) => updateRow(row.dayOfWeek, { available: e.target.checked })}
                />
                {DAY_LABELS[row.dayOfWeek]}
              </label>
              {row.available && (
                <>
                  <input
                    type="time"
                    value={row.startTime}
                    onChange={(e) => updateRow(row.dayOfWeek, { startTime: e.target.value })}
                    className="rounded border border-hairline px-2 py-1 text-sm"
                  />
                  <span className="text-taupe">to</span>
                  <input
                    type="time"
                    value={row.endTime}
                    onChange={(e) => updateRow(row.dayOfWeek, { endTime: e.target.value })}
                    className="rounded border border-hairline px-2 py-1 text-sm"
                  />
                </>
              )}
            </div>
          ))}
          <Button onClick={handleSave} disabled={saving} className="self-start">
            {saving ? "Saving..." : "Save working hours"}
          </Button>
        </div>
      )}
    </div>
  );
}
