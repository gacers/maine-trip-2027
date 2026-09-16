import Button from "@/components/Button";
import FieldInput from "@/components/FieldInput";
import { MARKER_COLORS } from "../helpers";
import type { FieldDef } from "@/lib/types";
import styles from "./EntryEditForm.module.css";

export interface DraftMarker {
  label: string;
  color: string;
  lat: string | number;
  lng: string | number;
}

export interface EntryDraft {
  title: string;
  url: string;
  posterImage: string;
  description: string;
  lat: string | number;
  lng: string | number;
  groupLabel: string;
  extraMarkers: DraftMarker[];
  data: Record<string, string>;
}

export interface EntryEditFormProps {
  draft: EntryDraft;
  onChange: (draft: EntryDraft) => void;
  fieldDefs: FieldDef[];
  nightsEstimate: number | null;
  supportsPairing: boolean;
  address: string;
  onAddressChange: (v: string) => void;
  geocoding: boolean;
  geocodeMsg: string;
  onFindCoords: () => void;
}

// The full manual-edit form (every field EntryCard's own "Edit
// details" opens into) — a single draft object in, a single onChange
// out, so the parent just needs to hold that one piece of state and
// hand it straight through.
export default function EntryEditForm({
  draft,
  onChange,
  fieldDefs,
  nightsEstimate,
  supportsPairing,
  address,
  onAddressChange,
  geocoding,
  geocodeMsg,
  onFindCoords,
}: EntryEditFormProps) {
  const countFields = fieldDefs.filter((f) => f.field_type === "count");

  function updateMarker(i: number, field: keyof DraftMarker, value: string) {
    onChange({ ...draft, extraMarkers: draft.extraMarkers.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)) });
  }

  function addMarker() {
    const color = MARKER_COLORS[draft.extraMarkers.length % MARKER_COLORS.length];
    onChange({ ...draft, extraMarkers: [...draft.extraMarkers, { label: "", color, lat: "", lng: "" }] });
  }

  function removeMarker(i: number) {
    onChange({ ...draft, extraMarkers: draft.extraMarkers.filter((_, idx) => idx !== i) });
  }

  return (
    <>
      <div className={styles["grid"]}>
        <label className={styles["field"]}>
          Title
          <input value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} className={styles["input"]} />
        </label>
        <label className={styles["field"]}>
          Link (optional)
          <input
            value={draft.url}
            onChange={(e) => onChange({ ...draft, url: e.target.value })}
            placeholder="https://..."
            className={styles["input"]}
          />
        </label>
        <label className={styles["field"]}>
          Photo URL
          <input
            value={draft.posterImage}
            onChange={(e) => onChange({ ...draft, posterImage: e.target.value })}
            className={styles["input"]}
          />
        </label>
        <label className={styles["wide-field"]}>
          Description (one bullet per line)
          <textarea
            value={draft.description}
            onChange={(e) => onChange({ ...draft, description: e.target.value })}
            rows={4}
            className={styles["input"]}
          />
        </label>

        {fieldDefs.length > 0 && (
          <div className={styles["field-defs-grid"]}>
            {fieldDefs.map((f) => (
              <FieldInput
                key={f.key}
                fieldDef={f}
                value={draft.data[f.key]}
                onChange={(v) => onChange({ ...draft, data: { ...draft.data, [f.key]: String(v) } })}
                tripNights={nightsEstimate}
              />
            ))}
            {countFields.length > 0 && <p className={styles["count-hint"]}>Count fields auto-fill from the description when left blank.</p>}
          </div>
        )}

        <label className={styles["field"]}>
          Latitude
          <input value={draft.lat} onChange={(e) => onChange({ ...draft, lat: e.target.value })} className={styles["input"]} />
        </label>
        <label className={styles["field"]}>
          Longitude
          <input value={draft.lng} onChange={(e) => onChange({ ...draft, lng: e.target.value })} className={styles["input"]} />
        </label>
        <div className={styles["wide-field"]}>
          <label>Or find lat/lng from an address</label>
          <div className={styles["geocode-row"]}>
            <input
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
              placeholder="e.g. 45 Ocean Ave, Jonesport, ME"
              className={styles["geocode-input"]}
            />
            <Button variant="secondary" size="sm" onClick={onFindCoords} disabled={geocoding || !address.trim()}>
              {geocoding ? "Finding..." : "Find"}
            </Button>
          </div>
          {geocodeMsg && <p className={styles["geocode-msg"]}>{geocodeMsg}</p>}
        </div>
        {/* Pairing (2-item options) is a Houses/Stays-only concept —
            showing this on a section that doesn't support it at all
            would just be a confusing field with no visible effect. */}
        {supportsPairing && (
          <label className={styles["wide-field"]}>
            Group label (optional — only if this is a 2-item option)
            <input
              value={draft.groupLabel}
              onChange={(e) => onChange({ ...draft, groupLabel: e.target.value })}
              placeholder='e.g. "Jonesport - 2 House Option" (use the exact same text on both)'
              className={styles["input"]}
            />
          </label>
        )}
      </div>

      <div>
        <div className={styles["markers-header"]}>
          <h4 className={styles["markers-title"]}>Extra map points (restaurants, hikes, puffin tour, nearest town, etc.)</h4>
          <Button variant="link" size="sm" onClick={addMarker}>
            + Add point
          </Button>
        </div>
        <div className={styles["marker-row-list"]}>
          {draft.extraMarkers.map((m, i) => (
            <div key={i} className={styles["marker-row"]}>
              <input
                placeholder="Label"
                value={m.label}
                onChange={(e) => updateMarker(i, "label", e.target.value)}
                className={styles["marker-input"]}
              />
              <input
                placeholder="Latitude"
                value={m.lat}
                onChange={(e) => updateMarker(i, "lat", e.target.value)}
                className={styles["marker-input"]}
              />
              <input
                placeholder="Longitude"
                value={m.lng}
                onChange={(e) => updateMarker(i, "lng", e.target.value)}
                className={styles["marker-input"]}
              />
              <input type="color" value={m.color} onChange={(e) => updateMarker(i, "color", e.target.value)} className={styles["marker-color-input"]} />
              <Button variant="danger" size="sm" onClick={() => removeMarker(i)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
