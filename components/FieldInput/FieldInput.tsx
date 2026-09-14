"use client";

import type { FieldDef } from "@/lib/types";
import styles from "./FieldInput.module.css";

export interface FieldInputProps {
  fieldDef: FieldDef;
  value: unknown;
  onChange: (value: string | boolean) => void;
}

// One labeled input for a section's dynamic field, its control chosen
// by the field's own type — shared by EntryCard's edit form and
// AddEntryForm, so a section's fields render identically wherever
// they're edited without any per-field-name code.
export default function FieldInput({ fieldDef, value, onChange }: FieldInputProps) {
  if (fieldDef.field_type === "textarea") {
    return (
      <label className={styles.wide}>
        {fieldDef.label}
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={styles.input}
        />
      </label>
    );
  }
  if (fieldDef.field_type === "boolean") {
    return (
      <label className={styles.checkboxField}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className={styles.checkbox}
        />
        {fieldDef.label}
      </label>
    );
  }
  if (fieldDef.field_type === "select") {
    const choices = fieldDef.options?.choices || [];
    return (
      <label className={styles.field}>
        {fieldDef.label}
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={styles.input}
        >
          <option value="">--</option>
          {choices.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const inputType =
    fieldDef.field_type === "number" || fieldDef.field_type === "count"
      ? "number"
      : fieldDef.field_type === "date"
        ? "date"
        : "text";
  return (
    <label className={styles.field}>
      {fieldDef.label}
      <input
        type={inputType}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={styles.input}
      />
    </label>
  );
}
