"use client";

import { useState, type FormEvent } from "react";
import type { FieldDef } from "@/lib/types";
import styles from "@/components/AddFieldSelect/AddFieldSelect.module.css";

export interface AddTypeFieldProps {
  existingKeys: string[];
  onAdd: (field: FieldDef) => void;
}

function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-/g, "_");
}

function asBooleanFieldDef(key: string, label: string): FieldDef {
  return {
    id: key,
    section_id: "",
    key,
    label,
    field_type: "boolean",
    storage: "jsonb",
    core_column: null,
    options: null,
    sort_order: 0,
    show_on_overview: true,
    required: false,
  };
}

// FI equivalent of AddFieldSelect's "+ Create new field..." — adds a
// boolean type tag to this item only (stored in item.data), not a
// section field_def.
export default function AddTypeField({ existingKeys, onAdd }: AddTypeFieldProps) {
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    const key = slugifyKey(trimmed);
    if (!key) {
      setError("Need a usable label.");
      return;
    }
    if (existingKeys.includes(key)) {
      setError("That type is already listed.");
      return;
    }
    onAdd(asBooleanFieldDef(key, trimmed));
    setLabel("");
    setError("");
    setCreating(false);
  }

  if (creating) {
    return (
      <form onSubmit={handleCreate} className={styles["create-form"]}>
        <label className={styles["create-field"]}>
          New type
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Seafood Shack"
            className={styles["create-input"]}
            autoFocus
          />
        </label>
        <div className={styles["create-actions"]}>
          <button type="submit" disabled={!label.trim()} className={styles["create-submit"]}>
            Add type
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setError("");
              setLabel("");
            }}
            className={styles["create-cancel"]}
          >
            Cancel
          </button>
        </div>
        {error ? <p className={styles["error"]}>{error}</p> : null}
      </form>
    );
  }

  return (
    <div className={styles["root"]}>
      <button type="button" onClick={() => setCreating(true)} className={styles["create-link"]}>
        + Create new type...
      </button>
    </div>
  );
}
