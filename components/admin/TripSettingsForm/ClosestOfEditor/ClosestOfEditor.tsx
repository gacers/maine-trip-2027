"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/Button";
import PlacePicker from "@/components/PlacePicker";
import { searchPlacesByText } from "@/lib/googlePlaces";
import { POI_COLORS } from "@/lib/mapColors";
import type { MapReferencePoint, PlaceResult } from "@/lib/types";
import styles from "./ClosestOfEditor.module.css";

export interface DraftClosestPoint extends MapReferencePoint {
  _key: string;
}

export function toDraftClosestPoints(points: MapReferencePoint[] | undefined): DraftClosestPoint[] {
  return (points || []).map((p, i) => ({ ...p, _key: `${i}-${p.label}` }));
}

export interface ClosestOfEditorProps {
  points: DraftClosestPoint[];
  onChange: (points: DraftClosestPoint[]) => void;
}

// A candidate-search version of the alwaysShown POI editor right above
// it in TripSettingsForm: instead of geocoding one address straight to
// a point, search Google Places for something like "puffin tour" and
// pick from real results — each Stay Option's Driving Times section
// then shows only whichever of these ends up closest to that house
// (map_config.closestOf), rather than showing every one of them like
// alwaysShown does. joinClosestOf/closestLabel (letting one point serve
// double duty — always shown, but relabeled when it also wins the
// closest-of comparison) aren't exposed here; add those by hand in the
// database if a real case for them comes up.
export default function ClosestOfEditor({ points, onChange }: ClosestOfEditorProps) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [error, setError] = useState("");

  function updatePoint(key: string, field: "label" | "lat" | "lng" | "color", value: string) {
    onChange(
      points.map((p) =>
        p._key === key ? { ...p, [field]: field === "lat" || field === "lng" ? Number(value) || 0 : value } : p
      )
    );
  }

  function removePoint(key: string) {
    onChange(points.filter((p) => p._key !== key));
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
    const color = POI_COLORS[points.length % POI_COLORS.length];
    onChange([
      ...points,
      { _key: `${Date.now()}`, label: place.title, lat: place.lat, lng: place.lng, color },
    ]);
    setResults([]);
    setQuery("");
  }

  function cancelSearch() {
    setResults([]);
  }

  return (
    <div className={styles["root"]}>
      <h2 className={styles["heading"]}>Closest of</h2>
      <p className={styles["hint"]}>
        Candidate points where only the one nearest each Stay Option is shown — e.g. a handful of puffin tour
        departure towns, so each house only gets driving time to whichever one it&apos;s actually closest to.
      </p>

      {points.length > 0 && (
        <div className={styles["point-row-list"]}>
          {points.map((p) => (
            <div key={p._key} className={styles["point-row"]}>
              <input
                placeholder="Label"
                value={p.label}
                onChange={(e) => updatePoint(p._key, "label", e.target.value)}
                className={styles["point-input"]}
              />
              <input
                placeholder="Latitude"
                value={p.lat}
                onChange={(e) => updatePoint(p._key, "lat", e.target.value)}
                className={styles["point-input"]}
              />
              <input
                placeholder="Longitude"
                value={p.lng}
                onChange={(e) => updatePoint(p._key, "lng", e.target.value)}
                className={styles["point-input"]}
              />
              <input
                type="color"
                value={p.color}
                onChange={(e) => updatePoint(p._key, "color", e.target.value)}
                className={styles["point-color-input"]}
              />
              <Button variant="danger" size="sm" onClick={() => removePoint(p._key)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && <PlacePicker places={results} onChoose={choosePlace} onCancel={cancelSearch} />}

      <div className={styles["search-row"]}>
        <input
          placeholder="Search a place, e.g. puffin tour"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={styles["input"]}
        />
        <Button variant="secondary" size="sm" onClick={runSearch} disabled={searching || !query.trim()}>
          {searching ? "Searching..." : "Search"}
        </Button>
      </div>

      {error && <p className={styles["error"]}>{error}</p>}
    </div>
  );
}
