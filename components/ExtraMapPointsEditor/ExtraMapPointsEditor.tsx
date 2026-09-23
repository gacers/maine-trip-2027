"use client";

import Button from "@/components/Button";
import { MARKER_COLORS } from "@/lib/mapColors";
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

  return (
    <div>
      <div className={styles["header"]}>
        <h4 className={styles["title"]}>Extra map points</h4>
        <Button variant="link" size="sm" onClick={addPoint}>
          + Add point
        </Button>
      </div>
      <p className={styles["hint"]}>
        Shown as extra pins on this item&apos;s own map alongside its main location — a kayak trip&apos;s
        put-in/take-out, a trailhead, a nearby restaurant, etc. Add as many as you need, each with its own label.
      </p>
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
