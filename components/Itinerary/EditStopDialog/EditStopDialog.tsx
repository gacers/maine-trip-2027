"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/Dialog";
import Button from "@/components/Button";
import StopScheduleFields, { type StopScheduleValues } from "../StopScheduleFields";
import { findTimingConflict } from "../lib/validateStopTiming";
import type { ItineraryStop } from "@/lib/types";
import styles from "./EditStopDialog.module.css";

export interface EditStopDialogProps {
  tripSlug: string;
  authToken: string | null;
  stop: ItineraryStop;
  /** Whichever stop currently sits right before this one in the list —
   * used to sanity-check that the entered date/time is even reachable
   * from there given the drive/transit time between them. Null for the
   * first stop, or if there's nothing before it worth checking against. */
  previousStop: ItineraryStop | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (stop: ItineraryStop) => void;
  onDeleted: (stopId: string) => void;
}

// Editing a stop's own schedule (kind/status/date/time/duration/travel
// mode/notes) — and, for a standalone stop (no linked entry), its name
// too. A linked stop's title/location come from the entry it points
// at and aren't re-editable here; delete + re-add to point it
// somewhere else instead.
export default function EditStopDialog({
  tripSlug,
  authToken,
  stop,
  previousStop,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
}: EditStopDialogProps) {
  const [title, setTitle] = useState(stop.title || "");
  const [schedule, setSchedule] = useState<StopScheduleValues>({
    kind: stop.kind,
    status: stop.status,
    date: stop.date || "",
    time: stop.time ? stop.time.slice(0, 5) : "",
    durationMinutes: stop.duration_minutes != null ? String(stop.duration_minutes) : "",
    travelMode: stop.travel_mode,
    notes: stop.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [checkingTiming, setCheckingTiming] = useState(false);

  const authHeaders: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};

  async function handleSave() {
    setError("");
    setCheckingTiming(true);
    const conflict = await findTimingConflict(tripSlug, previousStop, {
      date: schedule.date,
      time: schedule.time,
      lat: stop.lat,
      lng: stop.lng,
      travelMode: schedule.travelMode,
    });
    setCheckingTiming(false);
    if (conflict) {
      setError(conflict);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/trips/${tripSlug}/itinerary/stops/${stop.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          ...(stop.entry_id ? {} : { title }),
          kind: schedule.kind,
          status: schedule.status,
          date: schedule.date || null,
          time: schedule.time || null,
          durationMinutes: schedule.durationMinutes ? Number(schedule.durationMinutes) : null,
          travelMode: schedule.travelMode,
          notes: schedule.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      // data.stop is now already fully resolved (title/lat/lng/nav
      // slugs) via the same join getStopsForTrip uses — no need to
      // patch it back together from the previous `stop` prop.
      onUpdated(data.stop);
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Remove "${stop.title}" from the itinerary?`)) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/trips/${tripSlug}/itinerary/stops/${stop.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error("Delete failed");
      onDeleted(stop.id);
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles["content"]}>
        <DialogTitle>Edit stop</DialogTitle>
        {stop.entry_id ? (
          <DialogDescription>Linked to “{stop.title}” — its name and location come from that entry.</DialogDescription>
        ) : (
          <label className={styles["field"]}>
            Name
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={styles["input"]} />
          </label>
        )}

        <div className={styles["schedule-wrap"]}>
          <StopScheduleFields values={schedule} onChange={setSchedule} showTravelMode={!!stop.lat && !!stop.lng} />
        </div>

        {error && <p className={styles["error"]}>{error}</p>}

        <div className={styles["actions"]}>
          <Button type="button" variant="primary" size="sm" disabled={saving || checkingTiming} onClick={handleSave}>
            {checkingTiming ? "Checking..." : saving ? "Saving..." : "Save"}
          </Button>
          <Button type="button" variant="danger" size="sm" disabled={deleting} onClick={handleDelete}>
            {deleting ? "Removing..." : "Remove"}
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
