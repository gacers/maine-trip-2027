"use client";

import { useState, type FormEvent } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/Dialog";
import Button from "@/components/Button";
import PlacePicker from "@/components/AddEntryForm/components/PlacePicker";
import { searchPlacesByText } from "@/lib/googlePlaces";
import StopScheduleFields, { type StopScheduleValues } from "./StopScheduleFields";
import type { ItineraryEntryMatch, ItineraryStop, PlaceResult } from "@/lib/types";
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

  // Link-an-entry mode
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<ItineraryEntryMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ItineraryEntryMatch | null>(null);

  // Custom-stop mode
  const [title, setTitle] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [places, setPlaces] = useState<PlaceResult[] | null>(null);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [place, setPlace] = useState<PlaceResult | null>(null);

  function reset() {
    setMode("link");
    setSchedule(DEFAULT_SCHEDULE);
    setError("");
    setQuery("");
    setMatches([]);
    setSelected(null);
    setTitle("");
    setLocationQuery("");
    setPlaces(null);
    setPlace(null);
  }

  async function handleSearch(q: string) {
    setQuery(q);
    setSelected(null);
    if (q.trim().length < 2) {
      setMatches([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/trips/${tripSlug}/itinerary/search-entries?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setMatches(data.matches || []);
    } catch {
      // A failed search just shows no results — not worth its own error banner.
    } finally {
      setSearching(false);
    }
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
      setError("Search for and pick an entry first.");
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
            <input
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search this trip's entries by name..."
              className={styles["search-input"]}
            />
            {searching && <p className={styles["hint"]}>Searching...</p>}
            {selected ? (
              <div className={styles["selected-row"]}>
                <span>
                  {selected.title} <span className={styles["selected-meta"]}>— {selected.navGroupLabel} / {selected.sectionLabel}</span>
                </span>
                <button type="button" onClick={() => setSelected(null)} className={styles["clear-button"]}>
                  Change
                </button>
              </div>
            ) : (
              matches.length > 0 && (
                <div className={styles["match-list"]}>
                  {matches.map((m) => (
                    <button key={m.id} type="button" onClick={() => setSelected(m)} className={styles["match-button"]}>
                      <span className={styles["match-title"]}>{m.title}</span>
                      <span className={styles["match-meta"]}>
                        {m.navGroupLabel} / {m.sectionLabel}
                      </span>
                    </button>
                  ))}
                </div>
              )
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

        <StopScheduleFields values={schedule} onChange={setSchedule} showTravelMode={mode === "link" || !!place} />

        {error && <p className={styles["error"]}>{error}</p>}

        <Button type="button" variant="primary" size="sm" disabled={saving} onClick={handleSubmit} className={styles["submit-button"]}>
          {saving ? "Adding..." : "Add stop"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
