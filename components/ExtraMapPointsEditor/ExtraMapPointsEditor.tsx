"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/Button";
import PlacePicker from "@/components/PlacePicker";
import { searchPlacesByText } from "@/lib/googlePlaces";
import { MARKER_COLORS } from "@/lib/mapColors";
import type { PlaceResult } from "@/lib/types";
import styles from "./ExtraMapPointsEditor.module.css";

export interface DraftMarker {
  label: string;
  color: string;
  lat: string | number;
  lng: string | number;
}

export interface ExtraMapPointsEditorProps {
  points: DraftMarker[];
  onChange: (points: DraftMarker[]) => void;
}

// Shared by EntryEditForm (editing an existing item) and AddEntryForm's
// CoreFieldsGrid (creating a new one) — a kayak trip's put-in/take-out,
// a trailhead, a nearby restaurant, etc, each shown as an extra pin on
// this item's own map alongside its main location (see SimplePlaceMap/
// ListingMap's own destinations). Local to this trip even for an entry
// synced from elsewhere — EntryEditForm never disables this even when
// its own `locked` prop is set.
export default function ExtraMapPointsEditor({ points, onChange }: ExtraMapPointsEditorProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [error, setError] = useState("");

  function updatePoint(i: number, field: keyof DraftMarker, value: string) {
    onChange(points.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));
  }

  function addPoint() {
    const color = MARKER_COLORS[points.length % MARKER_COLORS.length];
    onChange([...points, { label: "", color, lat: "", lng: "" }]);
  }

  function removePoint(i: number) {
    onChange(points.filter((_, idx) => idx !== i));
  }

  function openSearch() {
    setSearchOpen(true);
    setError("");
  }

  function closeSearch() {
    setSearchOpen(false);
    setQuery("");
    setResults([]);
    setError("");
  }

  async function runSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    try {
      const found = await searchPlacesByText(query);
      if (found.length === 0) {
        setError("No matching places found — try a more specific search.");
      }
      setResults(found);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  function choosePlace(place: PlaceResult) {
    if (place.lat == null || place.lng == null) {
      setError("That place has no coordinates on file — try a different result.");
      return;
    }
    const color = MARKER_COLORS[points.length % MARKER_COLORS.length];
    onChange([...points, { label: place.title, color, lat: place.lat, lng: place.lng }]);
    closeSearch();
  }

  return (
    <div>
      <div className={styles["header"]}>
        <h4 className={styles["title"]}>Extra map points</h4>
        <div className={styles["header-actions"]}>
          <Button variant="link" size="sm" onClick={openSearch}>
            + Search a place
          </Button>
          <Button variant="link" size="sm" onClick={addPoint}>
            + Add point
          </Button>
        </div>
      </div>
      <p className={styles["hint"]}>
        Shown as extra pins on this item&apos;s own map alongside its main location — a kayak trip&apos;s
        put-in/take-out, a trailhead, a nearby restaurant, etc. Add as many as you need, each with its own label.
      </p>

      {searchOpen && (
        <div className={styles["search-box"]}>
          {results.length > 0 ? (
            <PlacePicker places={results} onChoose={choosePlace} onCancel={() => setResults([])} />
          ) : (
            <div className={styles["search-row"]}>
              <input
                placeholder="Search a place, e.g. trailhead parking"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={styles["search-input"]}
                autoFocus
              />
              <Button variant="secondary" size="sm" onClick={runSearch} disabled={searching || !query.trim()}>
                {searching ? "Searching..." : "Search"}
              </Button>
              <Button variant="link" size="sm" onClick={closeSearch}>
                Cancel
              </Button>
            </div>
          )}
          {error && <p className={styles["error"]}>{error}</p>}
        </div>
      )}

      <div className={styles["row-list"]}>
        {points.map((m, i) => (
          <div key={i} className={styles["row"]}>
            <input
              placeholder="Label"
              value={m.label}
              onChange={(e) => updatePoint(i, "label", e.target.value)}
              className={styles["label-input"]}
            />
            <input
              placeholder="Latitude"
              value={m.lat}
              onChange={(e) => updatePoint(i, "lat", e.target.value)}
              className={styles["input"]}
            />
            <input
              placeholder="Longitude"
              value={m.lng}
              onChange={(e) => updatePoint(i, "lng", e.target.value)}
              className={styles["input"]}
            />
            <input
              type="color"
              value={m.color}
              onChange={(e) => updatePoint(i, "color", e.target.value)}
              className={styles["color-input"]}
            />
            <Button variant="danger" size="sm" onClick={() => removePoint(i)}>
              Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
