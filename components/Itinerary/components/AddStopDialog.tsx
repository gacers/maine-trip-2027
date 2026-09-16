"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/Dialog";
import Button from "@/components/Button";
import PlacePicker from "@/components/AddEntryForm/components/PlacePicker";
import { searchPlacesByText } from "@/lib/googlePlaces";
import StopScheduleFields, { type StopScheduleValues } from "./StopScheduleFields";
import type { ItineraryEntryOption, ItineraryStop, PlaceResult } from "@/lib/types";
import styles from "./AddStopDialog.module.css";

export interface AddStopDialogProps {
  tripSlug: string;
  authToken: string | null;
  onAdded: (stop: ItineraryStop) => void;
}

const DEFAULT_SCHEDULE: StopScheduleValues = {
  kind: "activity",
  status: "tentative",
  date: "",
  time: "",
  durationMinutes: "",
  travelMode: "driving",
  notes: "",
};

type Mode = "link" | "custom";

// "+ Add stop" — two ways in: link something already documented
// elsewhere in this trip (reuses its title/url/lat/lng), or a
// standalone stop for something that isn't a real trip entry (a
// flight, a ferry, "Depart home"). Either way, the same scheduling
// fields (kind/status/date/time/duration/travel mode/notes) get filled
// in right here rather than a separate follow-up step.
export default function AddStopDialog({ tripSlug, authToken, onAdded }: AddStopDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("link");
  const [schedule, setSchedule] = useState<StopScheduleValues>(DEFAULT_SCHEDULE);
  const [saving, setSaving] = useState(false);
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
    fetch(`/api/trips/${tripSlug}/itinerary/entries`)
      .then((res) => res.json())
      .then((data) => setEntries(data.entries || []))
      .catch(() => setEntries([]))
      .finally(() => setEntriesLoading(false));
  }, [open, entries, tripSlug]);

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
    setSchedule(DEFAULT_SCHEDULE);
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
        <Button variant="primary" size="sm">
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

        <Button type="button" variant="primary" size="sm" disabled={saving} onClick={handleSubmit} className={styles["submit-button"]}>
          {saving ? "Adding..." : "Add stop"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
