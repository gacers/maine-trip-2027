"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/Dialog";
import Button from "@/components/Button";
import PlacePicker from "@/components/AddEntryForm/PlacePicker";
import { searchPlacesByText } from "@/lib/googlePlaces";
import StopScheduleFields, { type StopScheduleValues } from "../StopScheduleFields";
import { findTimingConflict } from "../lib/validateStopTiming";
import type { ItineraryEntryOption, ItineraryStop, ItineraryStopKind, PlaceResult } from "@/lib/types";
import styles from "./AddStopDialog.module.css";

// A best-effort default, not a hard mapping — picking a type just
// pre-selects Kind to whatever's most likely (confirmed live: it
// defaulted to "Activity" no matter what you linked, which was wrong
// often enough to be annoying for Stays/Food & Drink); the Kind
// dropdown right below still lets you correct it either way.
function guessKindFromNavGroupLabel(navGroupLabel: string): ItineraryStopKind {
  const l = navGroupLabel.toLowerCase();
  if (l.includes("stay") || l.includes("house") || l.includes("lodging") || l.includes("hotel")) return "lodging";
  if (l.includes("food") || l.includes("drink") || l.includes("dining") || l.includes("restaurant") || l.includes("tasting")) {
    return "meal";
  }
  if (l.includes("transport") || l.includes("car") || l.includes("ferry") || l.includes("flight") || l.includes("transit")) {
    return "transport";
  }
  return "activity";
}

export interface AddStopDialogProps {
  tripSlug: string;
  authToken: string | null;
  /** The current last stop in the list — a new stop's date/time
   * defaults off of it (see buildDefaultSchedule) rather than starting
   * blank every time, since stops are added roughly in visiting order.
   * WeekView passes the LAST stop in the specific lane this was opened
   * from instead of the globally-last one, so the time-of-day default
   * still makes sense there. */
  lastStop: ItineraryStop | null;
  /** Forces the date field to this regardless of what lastStop's own
   * date computes to — WeekView's own per-lane "+ Add stop" passes the
   * lane's date explicitly, since that's unambiguous the moment you've
   * clicked a specific lane's own button (an empty lane has no
   * lastStop to infer it from at all). Omitted by the header's
   * trip-wide "+ Add stop", which has no specific lane in mind. */
  presetDate?: string | null;
  /** The lane-footer button (WeekView) is a lighter-weight, secondary
   * action next to the header's own primary one — same dialog either
   * way, just a less prominent trigger. */
  triggerVariant?: "primary" | "ghost";
  onAdded: (stop: ItineraryStop) => void;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// A new stop's suggested date/time: the previous stop's own date/time,
// pushed forward by its duration if one was set (e.g. previous stop
// was 3:00 PM for 60 min -> this one defaults to 4:00 PM, rolling into
// the next day if that crosses midnight); if no duration was given,
// just reuse the previous stop's date/time as-is rather than guessing
// how long you're there. Blank when there's nothing to build from yet
// (no previous stop, or it has no date at all).
function computeDefaultDateTime(lastStop: ItineraryStop | null): { date: string; time: string } {
  if (!lastStop?.date) return { date: "", time: "" };
  const timeStr = lastStop.time ? lastStop.time.slice(0, 5) : "";
  if (!timeStr) return { date: lastStop.date, time: "" };
  if (!lastStop.duration_minutes) return { date: lastStop.date, time: timeStr };

  const start = new Date(`${lastStop.date}T${timeStr}:00`);
  start.setMinutes(start.getMinutes() + lastStop.duration_minutes);
  return {
    date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
  };
}

function buildDefaultSchedule(lastStop: ItineraryStop | null, presetDate?: string | null): StopScheduleValues {
  const computed = computeDefaultDateTime(lastStop);
  return {
    kind: "activity",
    status: "tentative",
    ...computed,
    date: presetDate != null ? presetDate : computed.date,
    durationMinutes: "",
    travelMode: "driving",
    notes: "",
  };
}

type Mode = "link" | "custom";

// "+ Add stop" — two ways in: link something already documented
// elsewhere in this trip (reuses its title/url/lat/lng), or a
// standalone stop for something that isn't a real trip entry (a
// flight, a ferry, "Depart home"). Either way, the same scheduling
// fields (kind/status/date/time/duration/travel mode/notes) get filled
// in right here rather than a separate follow-up step.
export default function AddStopDialog({
  tripSlug,
  authToken,
  lastStop,
  presetDate,
  triggerVariant = "primary",
  onAdded,
}: AddStopDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("link");
  const [schedule, setSchedule] = useState<StopScheduleValues>(() => buildDefaultSchedule(lastStop, presetDate));
  const [saving, setSaving] = useState(false);
  const [checkingTiming, setCheckingTiming] = useState(false);
  const [error, setError] = useState("");

  // Link-an-entry mode — every entry in the trip, fetched once when the
  // dialog opens, then narrowed by two dropdowns (which section, then
  // which entry in it) rather than a name search: you often remember
  // which list something's on before you remember its exact name.
  const [entries, setEntries] = useState<ItineraryEntryOption[] | null>(null);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [sectionId, setSectionId] = useState("");
  const [entryId, setEntryId] = useState("");

  // Custom-stop mode
  const [title, setTitle] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [places, setPlaces] = useState<PlaceResult[] | null>(null);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [place, setPlace] = useState<PlaceResult | null>(null);

  useEffect(() => {
    if (!open || entries !== null) return;
    setEntriesLoading(true);
    fetch(`/api/trips/${tripSlug}/itinerary/entries`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    })
      .then((res) => res.json())
      .then((data) => setEntries(data.entries || []))
      .catch(() => setEntries([]))
      .finally(() => setEntriesLoading(false));
  }, [open, entries, tripSlug, authToken]);

  // Re-derives the default date/time from the *current* last stop each
  // time the dialog opens — not just at first mount — so adding
  // several stops in a row keeps defaulting off the one just added,
  // not whatever the last stop was when this component first rendered.
  // Deliberately omits `lastStop` from the deps: it should only
  // recompute when the dialog is opened, not overwrite an in-progress
  // edit if the last stop happens to change while this is still open.
  useEffect(() => {
    if (open) setSchedule(buildDefaultSchedule(lastStop, presetDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // { sectionId, sectionLabel, navGroupLabel } for every section that
  // actually has at least one entry — the "type" dropdown's options.
  const sectionOptions = useMemo(() => {
    const bySectionId = new Map<string, { sectionId: string; sectionLabel: string; navGroupLabel: string }>();
    for (const e of entries || []) {
      if (!bySectionId.has(e.sectionId)) {
        bySectionId.set(e.sectionId, { sectionId: e.sectionId, sectionLabel: e.sectionLabel, navGroupLabel: e.navGroupLabel });
      }
    }
    return [...bySectionId.values()].sort(
      (a, b) => a.navGroupLabel.localeCompare(b.navGroupLabel) || a.sectionLabel.localeCompare(b.sectionLabel)
    );
  }, [entries]);

  const entryOptions = useMemo(
    () => (entries || []).filter((e) => e.sectionId === sectionId).sort((a, b) => (a.title || "").localeCompare(b.title || "")),
    [entries, sectionId]
  );

  const selected = entries?.find((e) => e.id === entryId) || null;

  function reset() {
    setMode("link");
    setSchedule(buildDefaultSchedule(lastStop, presetDate));
    setError("");
    setSectionId("");
    setEntryId("");
    setTitle("");
    setLocationQuery("");
    setPlaces(null);
    setPlace(null);
  }

  async function handleSearchPlaces(e: FormEvent) {
    e.preventDefault();
    if (!locationQuery.trim()) return;
    setSearchingPlaces(true);
    setError("");
    try {
      const results = await searchPlacesByText(locationQuery);
      setPlaces(results);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSearchingPlaces(false);
    }
  }

  function handleChoosePlace(p: PlaceResult) {
    setPlace(p);
    setPlaces(null);
    if (!title.trim()) setTitle(p.title);
  }

  async function handleSubmit() {
    setError("");
    if (mode === "link" && !selected) {
      setError("Pick a type and an entry first.");
      return;
    }
    if (mode === "custom" && !title.trim()) {
      setError("Give this stop a name.");
      return;
    }

    const candidateLat = mode === "link" ? (selected?.lat ?? null) : (place?.lat ?? null);
    const candidateLng = mode === "link" ? (selected?.lng ?? null) : (place?.lng ?? null);
    setCheckingTiming(true);
    const conflict = await findTimingConflict(tripSlug, lastStop, {
      date: schedule.date,
      time: schedule.time,
      lat: candidateLat,
      lng: candidateLng,
      travelMode: schedule.travelMode,
    });
    setCheckingTiming(false);
    if (conflict) {
      setError(conflict);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/trips/${tripSlug}/itinerary/stops`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          entryId: mode === "link" ? selected!.id : undefined,
          title: mode === "custom" ? title : undefined,
          url: mode === "custom" ? place?.mapsUrl || place?.website || undefined : undefined,
          lat: mode === "custom" ? place?.lat : undefined,
          lng: mode === "custom" ? place?.lng : undefined,
          kind: schedule.kind,
          status: schedule.status,
          date: schedule.date || undefined,
          time: schedule.time || undefined,
          durationMinutes: schedule.durationMinutes ? Number(schedule.durationMinutes) : undefined,
          travelMode: schedule.travelMode,
          notes: schedule.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't add that stop");
      onAdded(data.stop);
      setOpen(false);
      reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm">
          + Add stop
        </Button>
      </DialogTrigger>
      <DialogContent className={styles["content"]}>
        <DialogTitle>Add a stop</DialogTitle>
        <DialogDescription>Link something you&apos;ve already documented, or add a standalone stop.</DialogDescription>

        <div className={styles["mode-row"]}>
          <button
            type="button"
            onClick={() => setMode("link")}
            className={mode === "link" ? styles["mode-button-active"] : styles["mode-button"]}
          >
            Link an existing entry
          </button>
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={mode === "custom" ? styles["mode-button-active"] : styles["mode-button"]}
          >
            Custom stop
          </button>
        </div>

        {mode === "link" ? (
          <div className={styles["section"]}>
            {entriesLoading ? (
              <p className={styles["hint"]}>Loading this trip&apos;s entries...</p>
            ) : sectionOptions.length === 0 ? (
              <p className={styles["hint"]}>Nothing documented in this trip yet — use Custom stop instead.</p>
            ) : (
              <>
                <label className={styles["field"]}>
                  Type
                  <select
                    value={sectionId}
                    onChange={(e) => {
                      setSectionId(e.target.value);
                      setEntryId("");
                      const picked = sectionOptions.find((s) => s.sectionId === e.target.value);
                      if (picked) setSchedule((s) => ({ ...s, kind: guessKindFromNavGroupLabel(picked.navGroupLabel) }));
                    }}
                    className={styles["search-input"]}
                  >
                    <option value="">— Pick a type —</option>
                    {sectionOptions.map((s) => (
                      <option key={s.sectionId} value={s.sectionId}>
                        {s.navGroupLabel} — {s.sectionLabel}
                      </option>
                    ))}
                  </select>
                </label>
                {sectionId && (
                  <label className={styles["field"]}>
                    Which one
                    <select value={entryId} onChange={(e) => setEntryId(e.target.value)} className={styles["search-input"]}>
                      <option value="">— Pick one —</option>
                      {entryOptions.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
          </div>
        ) : (
          <div className={styles["section"]}>
            <label className={styles["field"]}>
              Name
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={styles["search-input"]} />
            </label>
            {place ? (
              <div className={styles["selected-row"]}>
                <span>📍 {place.address}</span>
                <button type="button" onClick={() => setPlace(null)} className={styles["clear-button"]}>
                  Change
                </button>
              </div>
            ) : places ? (
              <PlacePicker places={places} onChoose={handleChoosePlace} onCancel={() => setPlaces(null)} />
            ) : (
              <form onSubmit={handleSearchPlaces} className={styles["location-search-row"]}>
                <input
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="Search for a location (optional)"
                  className={styles["search-input"]}
                />
                <Button type="submit" variant="secondary" size="sm" disabled={searchingPlaces || !locationQuery.trim()}>
                  {searchingPlaces ? "Searching..." : "Search"}
                </Button>
              </form>
            )}
          </div>
        )}

        <StopScheduleFields
          values={schedule}
          onChange={setSchedule}
          showTravelMode={mode === "link" ? selected?.lat != null && selected?.lng != null : !!place}
        />

        {error && <p className={styles["error"]}>{error}</p>}

        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={saving || checkingTiming}
          onClick={handleSubmit}
          className={styles["submit-button"]}
        >
          {checkingTiming ? "Checking..." : saving ? "Adding..." : "Add stop"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
