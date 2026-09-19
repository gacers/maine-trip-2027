"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CustomFieldTemplate } from "@/lib/customFieldTemplates";
import type { FieldType } from "@/lib/types";
import styles from "./AddFieldSelect.module.css";

const FIELD_TYPES: FieldType[] = ["text", "textarea", "url", "image_url", "number", "count", "price", "select", "boolean", "date"];
const CREATE_NEW_VALUE = "__create_new__";

export interface AddFieldSelectProps {
  tripSlug: string;
  sectionId: string;
  /** This section's own current field keys — an already-added one
   * isn't offered again, same as FieldDefsEditor's own
   * availableTemplates filter. */
  existingKeys: string[];
}

// Same key transform FieldDefsEditor's own Key input uses, applied
// here to a label instead of typed directly — a field created from
// this compact picker skips a separate Key input, so the key is
// derived once at creation time instead.
function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-/g, "_");
}

// "+ Add existing field..." / "+ Create new field..." for a section
// that's missing one while actually editing (or adding) an entry that
// could use it right now (confirmed live as a real need: checking a
// Food & Drink type-tag box that hasn't been added to THIS section
// yet used to mean leaving the entry, opening Edit Section, adding it
// there via FieldDefsEditor's own picker, then coming back). The
// "existing" list is the same one (/api/field-templates), same
// "{label} (field_type)" format; "Create new" opens the same
// label/type/choices shape FieldDefsEditor's own blank-field row
// offers, just without a separate Key input (derived from the label
// instead) or a Required checkbox (FieldDefsEditor doesn't actually
// expose one either). Either path persists straight to the section's
// own field_defs immediately — there's no separate section-level Save
// step to defer to from inside an entry's own form — and refreshes
// the page so the new field's own input appears right here.
export default function AddFieldSelect({ tripSlug, sectionId, existingKeys }: AddFieldSelectProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<CustomFieldTemplate[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<FieldType>("text");
  const [newOptionsText, setNewOptionsText] = useState("");
  const [newOverview, setNewOverview] = useState(false);

  useEffect(() => {
    fetch("/api/field-templates", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => {});
  }, []);

  const availableTemplates = templates.filter((t) => !existingKeys.includes(t.field_key));

  async function postField(field: {
    key: string;
    label: string;
    fieldType: FieldType;
    showOnOverview: boolean;
    required: boolean;
    options?: { choices?: string[]; aliases?: string[] } | null;
  }) {
    setAdding(true);
    setError("");
    try {
      const res = await fetch(`/api/trips/${tripSlug}/sections/add-field`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, ...field }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Add failed");
      router.refresh();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setAdding(false);
    }
  }

  async function addTemplateField(fieldKey: string) {
    const template = availableTemplates.find((t) => t.field_key === fieldKey);
    if (!template) return;
    await postField({
      key: template.field_key,
      label: template.label,
      fieldType: template.field_type,
      showOnOverview: template.show_on_overview,
      required: template.required,
      options: template.options,
    });
  }

  async function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label) return;
    const key = slugifyKey(label);
    if (!key) return;
    const options =
      newType === "select"
        ? { choices: newOptionsText.split(",").map((s) => s.trim()).filter(Boolean) }
        : newType === "count" && newOptionsText.trim()
          ? { aliases: newOptionsText.split(",").map((s) => s.trim()).filter(Boolean) }
          : undefined;
    const ok = await postField({ key, label, fieldType: newType, showOnOverview: newOverview, required: false, options });
    if (ok) {
      setCreating(false);
      setNewLabel("");
      setNewType("text");
      setNewOptionsText("");
      setNewOverview(false);
    }
  }

  if (creating) {
    return (
      <form onSubmit={handleCreateSubmit} className={styles["create-form"]}>
        <label className={styles["create-field"]}>
          Label
          <input
            autoFocus
            required
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className={styles["create-input"]}
          />
        </label>
        <label className={styles["create-field"]}>
          Type
          <select value={newType} onChange={(e) => setNewType(e.target.value as FieldType)} className={styles["create-input"]}>
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {(newType === "select" || newType === "count") && (
          <label className={styles["create-wide-field"]}>
            {newType === "select" ? "Choices (comma-separated)" : "Aliases (comma-separated, optional)"}
            <input value={newOptionsText} onChange={(e) => setNewOptionsText(e.target.value)} className={styles["create-input"]} />
          </label>
        )}
        <label className={styles["create-overview-field"]}>
          <input type="checkbox" checked={newOverview} onChange={(e) => setNewOverview(e.target.checked)} />
          Overview
        </label>
        <div className={styles["create-actions"]}>
          <button type="submit" disabled={adding || !newLabel.trim()} className={styles["create-submit"]}>
            {adding ? "Adding..." : "Add field"}
          </button>
          <button type="button" onClick={() => setCreating(false)} className={styles["create-cancel"]}>
            Cancel
          </button>
        </div>
        {error && <p className={styles["error"]}>{error}</p>}
      </form>
    );
  }

  if (availableTemplates.length === 0) {
    return (
      <div className={styles["root"]}>
        <button type="button" onClick={() => setCreating(true)} className={styles["create-link"]}>
          + Create new field...
        </button>
      </div>
    );
  }

  return (
    <div className={styles["root"]}>
      <select
        value=""
        disabled={adding}
        onChange={(e) => {
          if (e.target.value === CREATE_NEW_VALUE) setCreating(true);
          else if (e.target.value) addTemplateField(e.target.value);
        }}
        className={styles["select"]}
      >
        <option value="">{adding ? "Adding..." : "+ Add existing field..."}</option>
        {availableTemplates.map((t) => (
          <option key={t.field_key} value={t.field_key}>
            {t.label} ({t.field_type})
          </option>
        ))}
        <option value={CREATE_NEW_VALUE}>+ Create new field...</option>
      </select>
      {error && <p className={styles["error"]}>{error}</p>}
    </div>
  );
}
