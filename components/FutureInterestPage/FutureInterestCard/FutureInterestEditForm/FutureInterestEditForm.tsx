"use client";

import FieldInput from "@/components/FieldInput";
import type { FieldDef } from "@/lib/types";
import styles from "@/components/EntryCard/EntryEditForm/EntryEditForm.module.css";

export interface FutureInterestDraft {
  title: string;
  url: string;
  posterImage: string;
  description: string;
  lat: string | number;
  lng: string | number;
  data: Record<string, string | boolean>;
}

export interface FutureInterestEditFormProps {
  draft: FutureInterestDraft;
  onChange: (draft: FutureInterestDraft) => void;
  typeFieldDefs: FieldDef[];
}

// FI-only edit form — same chrome as EntryEditForm for the fields
// Future Interest actually stores (no pairing / extra map markers).
export default function FutureInterestEditForm({ draft, onChange, typeFieldDefs }: FutureInterestEditFormProps) {
  return (
    <div className={styles["grid"]}>
      <label className={styles["field"]}>
        Title
        <input
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
          className={styles["input"]}
          required
        />
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

      {typeFieldDefs.length > 0 && (
        <div className={styles["field-defs-grid"]}>
          {typeFieldDefs.map((f) => (
            <FieldInput
              key={f.key}
              fieldDef={f}
              value={draft.data[f.key]}
              onChange={(v) => onChange({ ...draft, data: { ...draft.data, [f.key]: v } })}
              tripNights={null}
            />
          ))}
        </div>
      )}

      <label className={styles["field"]}>
        Latitude
        <input
          value={draft.lat}
          onChange={(e) => onChange({ ...draft, lat: e.target.value })}
          className={styles["input"]}
        />
      </label>
      <label className={styles["field"]}>
        Longitude
        <input
          value={draft.lng}
          onChange={(e) => onChange({ ...draft, lng: e.target.value })}
          className={styles["input"]}
        />
      </label>
    </div>
  );
}
