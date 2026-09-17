import { useEffect, useState } from "react";
import type { FieldDef, FieldType } from "@/lib/types";
import type { CustomFieldTemplate } from "@/lib/customFieldTemplates";
import styles from "./FieldDefsEditor.module.css";

const FIELD_TYPES: FieldType[] = ["text", "textarea", "url", "image_url", "number", "count", "price", "select", "boolean", "date"];

// A field_def, edited as a form row — `optionsText` is the raw
// comma-separated input for whichever of options.choices/options.aliases
// this field's type actually uses, only split back into an array on
// submit (see rowToFieldDef).
export interface FieldRow {
  key: string;
  label: string;
  field_type: FieldType;
  show_on_overview: boolean;
  required: boolean;
  optionsText: string;
}

export function fieldDefToRow(f: FieldDef): FieldRow {
  return {
    key: f.key,
    label: f.label,
    field_type: f.field_type,
    show_on_overview: f.show_on_overview,
    required: f.required,
    optionsText:
      f.field_type === "select"
        ? (f.options?.choices || []).join(", ")
        : f.field_type === "count"
          ? (f.options?.aliases || []).join(", ")
          : "",
  };
}

export function rowToFieldDef(row: FieldRow) {
  const options =
    row.field_type === "select"
      ? { choices: row.optionsText.split(",").map((s) => s.trim()).filter(Boolean) }
      : row.field_type === "count" && row.optionsText.trim()
        ? { aliases: row.optionsText.split(",").map((s) => s.trim()).filter(Boolean) }
        : undefined;
  return {
    key: row.key,
    label: row.label,
    field_type: row.field_type,
    show_on_overview: !!row.show_on_overview,
    required: !!row.required,
    options,
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface FieldDefsEditorProps {
  fields: FieldRow[];
  onChange: (fields: FieldRow[]) => void;
}

function templateToRow(t: CustomFieldTemplate): FieldRow {
  return {
    key: t.field_key,
    label: t.label,
    field_type: t.field_type,
    show_on_overview: t.show_on_overview,
    required: t.required,
    optionsText:
      t.field_type === "select"
        ? (t.options?.choices || []).join(", ")
        : t.field_type === "count"
          ? (t.options?.aliases || []).join(", ")
          : "",
  };
}

// The section's own custom fields (price, bedrooms, Closed, ...) —
// add/edit/remove rows. Owns the array-manipulation itself (add/
// update/remove), the parent just holds the current array and reads
// it back on submit. Also offers picking an already-defined field
// (any section, any trip — see lib/customFieldTemplates.ts) instead of
// starting blank, the same "build it once, reuse it everywhere" idea
// SectionsAdmin's own template buttons give whole nav groups.
export default function FieldDefsEditor({ fields, onChange }: FieldDefsEditorProps) {
  const [templates, setTemplates] = useState<CustomFieldTemplate[]>([]);

  useEffect(() => {
    fetch("/api/field-templates", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => {});
  }, []);

  function addField() {
    onChange([...fields, { key: "", label: "", field_type: "text", show_on_overview: false, required: false, optionsText: "" }]);
  }

  function addTemplateField(fieldKey: string) {
    const template = templates.find((t) => t.field_key === fieldKey);
    if (!template) return;
    onChange([...fields, templateToRow(template)]);
  }

  function updateField(i: number, patch: Partial<FieldRow>) {
    onChange(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function removeField(i: number) {
    onChange(fields.filter((_, idx) => idx !== i));
  }

  // Already-added keys don't need to be offered again — picking one a
  // second time would just collide with the row already on the form.
  const availableTemplates = templates.filter((t) => !fields.some((f) => f.key === t.field_key));

  return (
    <div className={styles["root"]}>
      <div className={styles["header"]}>
        <h3 className={styles["title"]}>Fields</h3>
        <div className={styles["header-actions"]}>
          {availableTemplates.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) addTemplateField(e.target.value);
              }}
              className={styles["template-select"]}
            >
              <option value="">+ Add existing field...</option>
              {availableTemplates.map((t) => (
                <option key={t.field_key} value={t.field_key}>
                  {t.label} ({t.field_type})
                </option>
              ))}
            </select>
          )}
          <button type="button" onClick={addField} className={styles["add-button"]}>
            + Add blank field
          </button>
        </div>
      </div>
      {fields.length === 0 && (
        <p className={styles["no-fields-hint"]}>
          No custom fields yet — title/url/photo/description/notes/concerns are always tracked.
        </p>
      )}
      <div className={styles["row-list"]}>
        {fields.map((f, i) => (
          <div key={i} className={styles["row"]}>
            <label className={styles["row-field"]}>
              Key
              <input
                value={f.key}
                onChange={(e) => updateField(i, { key: slugify(e.target.value).replace(/-/g, "_") })}
                className={styles["row-input"]}
              />
            </label>
            <label className={styles["row-field"]}>
              Label
              <input value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} className={styles["row-input"]} />
            </label>
            <label className={styles["row-field"]}>
              Type
              <select
                value={f.field_type}
                onChange={(e) => updateField(i, { field_type: e.target.value as FieldType })}
                className={styles["row-input"]}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {(f.field_type === "select" || f.field_type === "count") && (
              <label className={styles["row-wide-field"]}>
                {f.field_type === "select" ? "Choices (comma-separated)" : "Aliases (comma-separated, optional)"}
                <input value={f.optionsText} onChange={(e) => updateField(i, { optionsText: e.target.value })} className={styles["row-input"]} />
              </label>
            )}
            <label className={styles["overview-field"]}>
              <input
                type="checkbox"
                checked={f.show_on_overview}
                onChange={(e) => updateField(i, { show_on_overview: e.target.checked })}
                className={styles["small-checkbox"]}
              />
              Overview
            </label>
            <button type="button" onClick={() => removeField(i)} className={styles["remove-button"]}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
