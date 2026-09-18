"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/Button";
import { fetchForwardGeocode } from "@/lib/geocodeClient";
import ArchiveUnvisitedButton from "@/components/ArchiveUnvisitedButton";
import ResetAllRatingsButton from "@/components/ResetAllRatingsButton";
import DangerZone from "./DangerZone";
import type { Trip, NavGroup, MapReferencePoint } from "@/lib/types";
import styles from "./TripSettingsForm.module.css";

export interface TripSettingsFormProps {
  trip: Trip;
  nav: NavGroup[];
}

const POI_COLORS = ["#2E7D32", "#8E24AA", "#F57C00", "#1976D2", "#C2185B", "#00897B"];

interface DraftPoi extends MapReferencePoint {
  _key: string;
}

function toDraftPois(points: MapReferencePoint[] | undefined): DraftPoi[] {
  return (points || []).map((p, i) => ({ ...p, _key: `${i}-${p.label}` }));
}

// Trip-level settings that previously had no editing UI at all: the
// name/subtitle/date-range set at creation could never be changed
// afterward, and Points of Interest (map_config.alwaysShown — Acadia
// National Park, a puffin tour dock, ... every Stay Option's Driving
// Times section computes its distance to each of these) could only
// ever be set by hand directly in the database. One PATCH
// (/api/trips/[tripSlug]) backs all of it.
export default function TripSettingsForm({ trip, nav }: TripSettingsFormProps) {
  const [name, setName] = useState(trip.name);
  const [subtitle, setSubtitle] = useState(trip.subtitle || "");
  const [startDate, setStartDate] = useState(trip.start_date || "");
  const [endDate, setEndDate] = useState(trip.end_date || "");
  const [nightsEstimate, setNightsEstimate] = useState(trip.nights_estimate ? String(trip.nights_estimate) : "");
  const [coverImage, setCoverImage] = useState(trip.cover_image || "");
  const [completed, setCompleted] = useState(trip.completed);
  const [archived, setArchived] = useState(trip.archived);
  const [pois, setPois] = useState<DraftPoi[]>(toDraftPois(trip.map_config?.alwaysShown));
  const [poiQuery, setPoiQuery] = useState("");
  const [findingPoi, setFindingPoi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function updatePoi(key: string, field: "label" | "lat" | "lng" | "color", value: string) {
    setPois((prev) =>
      prev.map((p) =>
        p._key === key ? { ...p, [field]: field === "lat" || field === "lng" ? Number(value) || 0 : value } : p
      )
    );
  }

  function removePoi(key: string) {
    setPois((prev) => prev.filter((p) => p._key !== key));
  }

  // Geocodes whatever's typed and adds it as a new point, pre-filled —
  // still fully editable afterward (label, or the coordinates
  // themselves, in case the geocoded result isn't quite right).
  async function findAndAddPoi(e: FormEvent) {
    e.preventDefault();
    if (!poiQuery.trim()) return;
    setFindingPoi(true);
    setError("");
    try {
      const { lat, lng, formattedAddress } = await fetchForwardGeocode(trip.slug, poiQuery);
      const color = POI_COLORS[pois.length % POI_COLORS.length];
      setPois((prev) => [
        ...prev,
        { _key: `${Date.now()}`, label: poiQuery.trim() || formattedAddress, lat, lng, color },
      ]);
      setPoiQuery("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFindingPoi(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const alwaysShown: MapReferencePoint[] = pois.map((p) => ({
        label: p.label,
        lat: p.lat,
        lng: p.lng,
        color: p.color,
      }));
      const res = await fetch(`/api/trips/${trip.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subtitle,
          startDate: startDate || null,
          endDate: endDate || null,
          nightsEstimate: nightsEstimate ? Number(nightsEstimate) : null,
          coverImage: coverImage || null,
          completed,
          archived,
          mapConfig: { ...trip.map_config, alwaysShown },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles["root"]}>
      <label className={styles["field"]}>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required className={styles["input"]} />
      </label>
      <label className={styles["field"]}>
        Subtitle (optional)
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={styles["input"]} />
      </label>
      <label className={styles["field"]}>
        Cover image (optional — shown on the trips list)
        <input
          value={coverImage}
          onChange={(e) => setCoverImage(e.target.value)}
          placeholder="https://..."
          className={styles["input"]}
        />
      </label>
      <div className={styles["date-row"]}>
        <label className={styles["field"]}>
          Start date
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={styles["input"]}
          />
        </label>
        <label className={styles["field"]}>
          End date
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={styles["input"]}
          />
        </label>
      </div>
      <label className={styles["field"]}>
        Estimated length in nights (for a price/night estimate — ignored once real dates are set above)
        <input
          type="number"
          min="1"
          value={nightsEstimate}
          onChange={(e) => setNightsEstimate(e.target.value)}
          placeholder="e.g. 7"
          className={styles["input"]}
        />
      </label>
      <label className={styles["checkbox-field"]}>
        <input
          type="checkbox"
          checked={completed}
          onChange={(e) => setCompleted(e.target.checked)}
          className={styles["checkbox"]}
        />
        Completed — the trip already happened. Moves it to Past Trips, and new entries come in already checked off
        Visited. Reversible — no Visited data is lost either way.
      </label>
      {/* Right by the Completed checkbox that gates it, not the nav bar
          (see TripNavHeader's own comment on why) — wrapped in a plain
          block div, not left bare, since a bare Button here would get
          stretched to this form's full width by the flex column's
          default align-items and end up with its own label centered
          instead of left-aligned like every field around it. */}
      {trip.completed && (
        <div>
          <ArchiveUnvisitedButton trip={trip} nav={nav} />
        </div>
      )}
      <div className={styles["ratings-reset"]}>
        <p className={styles["ratings-reset-hint"]}>
          Clears every rater&apos;s stars on Stay Options (and any other ratings-enabled section).
        </p>
        <ResetAllRatingsButton trip={trip} nav={nav} />
      </div>
      <label className={styles["checkbox-field"]}>
        <input
          type="checkbox"
          checked={archived}
          onChange={(e) => setArchived(e.target.checked)}
          className={styles["checkbox"]}
        />
        Archived — hides this trip from the list without deleting anything. Reversible, but you&apos;ll need the
        direct URL to find it again.
      </label>

      <div className={styles["poi-section"]}>
        <h2 className={styles["poi-heading"]}>Points of interest</h2>
        <p className={styles["poi-hint"]}>
          Shown in every Stay Option&apos;s Driving Times section.
        </p>

        {pois.length > 0 && (
          <div className={styles["poi-row-list"]}>
            {pois.map((p) => (
              <div key={p._key} className={styles["poi-row"]}>
                <input
                  placeholder="Label"
                  value={p.label}
                  onChange={(e) => updatePoi(p._key, "label", e.target.value)}
                  className={styles["poi-input"]}
                />
                <input
                  placeholder="Latitude"
                  value={p.lat}
                  onChange={(e) => updatePoi(p._key, "lat", e.target.value)}
                  className={styles["poi-input"]}
                />
                <input
                  placeholder="Longitude"
                  value={p.lng}
                  onChange={(e) => updatePoi(p._key, "lng", e.target.value)}
                  className={styles["poi-input"]}
                />
                <input
                  type="color"
                  value={p.color}
                  onChange={(e) => updatePoi(p._key, "color", e.target.value)}
                  className={styles["poi-color-input"]}
                />
                <Button variant="danger" size="sm" onClick={() => removePoi(p._key)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className={styles["poi-find-row"]}>
          <input
            placeholder="Search a place or address..."
            value={poiQuery}
            onChange={(e) => setPoiQuery(e.target.value)}
            className={styles["input"]}
          />
          <Button variant="secondary" size="sm" onClick={findAndAddPoi} disabled={findingPoi || !poiQuery.trim()}>
            {findingPoi ? "Finding..." : "Find & add"}
          </Button>
        </div>
      </div>

      {error && <p className={styles["error"]}>{error}</p>}
      {saved && <p className={styles["saved"]}>Saved.</p>}
      <Button type="submit" variant="primary" size="sm" disabled={saving} className={styles["submit-button"]}>
        {saving ? "Saving..." : "Save changes"}
      </Button>

      <DangerZone trip={trip} />
    </form>
  );
}
