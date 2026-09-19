import FieldInput from "@/components/FieldInput";
import type { FieldDef } from "@/lib/types";
import styles from "./CoreFieldsGrid.module.css";

export interface CoreFields {
  title: string;
  posterImage: string;
  description: string;
  lat: string | number;
  lng: string | number;
  notes: string;
  concerns: string;
  groupLabel: string;
}

export interface CoreFieldsGridProps {
  fields: CoreFields;
  onFieldsChange: (fields: CoreFields) => void;
  fieldDefs: FieldDef[];
  tripNights: number | null;
  data: Record<string, unknown>;
  onDataChange: (data: Record<string, unknown>) => void;
  address: string;
  onAddressChange: (v: string) => void;
  geocoding: boolean;
  geocodeMsg: string;
  onFindCoords: () => void;
  /** True once this new entry is linked to an already-documented place
   * elsewhere (see AddEntryForm's reusedEntryId) — every shared field
   * here is about to be overridden by that row's own current values
   * regardless of whatever's typed in, so they're locked read-only
   * instead of inviting an edit that gets silently discarded. Notes/
   * Concerns stay editable either way — genuinely local to this trip,
   * never part of the sync. */
  disabled?: boolean;
}

// Title/photo/description/section-specific fields/coordinates/notes/
// concerns — every field a new entry has regardless of pairing. Just
// the individual field elements (grid items) — the parent owns the
// actual grid container, since PairFieldsBox needs to be a sibling
// item in that same grid, not nested inside this one.
export default function CoreFieldsGrid({
  fields,
  onFieldsChange,
  fieldDefs,
  tripNights,
  data,
  onDataChange,
  address,
  onAddressChange,
  geocoding,
  geocodeMsg,
  onFindCoords,
  disabled = false,
}: CoreFieldsGridProps) {
  return (
    <>
      <label className={styles["field"]}>
        Title
        <input
          required
          disabled={disabled}
          value={fields.title}
          onChange={(e) => onFieldsChange({ ...fields, title: e.target.value })}
          className={styles["input"]}
        />
      </label>
      <label className={styles["wide-field"]}>
        Photo URL
        <input
          disabled={disabled}
          value={fields.posterImage}
          onChange={(e) => onFieldsChange({ ...fields, posterImage: e.target.value })}
          className={styles["input"]}
        />
      </label>
      <label className={styles["wide-field"]}>
        Description (one bullet per line, optional)
        <textarea
          disabled={disabled}
          value={fields.description}
          onChange={(e) => onFieldsChange({ ...fields, description: e.target.value })}
          rows={3}
          className={styles["input"]}
        />
      </label>

      {fieldDefs.length > 0 && (
        <div className={styles["field-defs-grid"]}>
          {fieldDefs.map((f) => (
            <FieldInput
              key={f.key}
              fieldDef={f}
              value={data[f.key]}
              onChange={(v) => onDataChange({ ...data, [f.key]: v })}
              tripNights={tripNights}
              disabled={disabled}
            />
          ))}
          {fieldDefs.some((f) => f.field_type === "count") && !disabled && (
            <p className={styles["count-hint"]}>Leave count fields blank to auto-fill from the description.</p>
          )}
        </div>
      )}

      <label className={styles["field"]}>
        Latitude
        <input
          disabled={disabled}
          value={fields.lat}
          onChange={(e) => onFieldsChange({ ...fields, lat: e.target.value })}
          className={styles["input"]}
        />
      </label>
      <label className={styles["field"]}>
        Longitude
        <input
          disabled={disabled}
          value={fields.lng}
          onChange={(e) => onFieldsChange({ ...fields, lng: e.target.value })}
          className={styles["input"]}
        />
      </label>
      {!disabled && (
        <div className={styles["wide-field"]}>
          <label>Or find lat/lng from an address</label>
          <div className={styles["geocode-row"]}>
            <input
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
              placeholder="e.g. 129 State Route 32, New Harbor, ME"
              className={styles["geocode-input"]}
            />
            <button type="button" onClick={onFindCoords} disabled={geocoding || !address.trim()} className={styles["find-button"]}>
              {geocoding ? "Finding..." : "Find"}
            </button>
          </div>
          {geocodeMsg && <p className={styles["geocode-msg"]}>{geocodeMsg}</p>}
        </div>
      )}
      <label className={styles["wide-field"]}>
        Notes
        <textarea
          value={fields.notes}
          onChange={(e) => onFieldsChange({ ...fields, notes: e.target.value })}
          rows={2}
          className={styles["input"]}
        />
      </label>
      <label className={styles["wide-field"]}>
        Concerns (optional)
        <textarea
          value={fields.concerns}
          onChange={(e) => onFieldsChange({ ...fields, concerns: e.target.value })}
          rows={2}
          className={styles["input"]}
        />
      </label>
    </>
  );
}
