"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CustomFieldTemplate } from "@/lib/customFieldTemplates";
import type { FieldType } from "@/lib/types";
import styles from "./AddFieldSelect.module.css";

const FIELD_TYPES: FieldType[] = ["text", "textarea", "url", "image_url", "number", "count", "price", "select", "boolean", "date"];
const CREATE_NEW_VALUE = "__create_new__";

export interface AddedFieldPayload {
  key: string;
  label: string;
  fieldType: FieldType;
  showOnOverview: boolean;
  required: boolean;
  options?: { choices?: string[]; aliases?: string[] } | null;
}

export interface AddFieldSelectProps {
  /** Trip section mode — posts to /api/trips/.../add-field and refreshes. */
  tripSlug?: string;
  sectionId?: string;
  /** Site-category mode (Future Interest) — posts to /api/field-templates
   * so the field lands on every trip section in that category too. */
  categorySlug?: string;
  existingKeys: string[];
  /** Called after a successful add in category mode (parent updates its
   * fieldDefs list). Ignored in trip/section mode (router.refresh). */
  onFieldAdded?: (field: AddedFieldPayload) => void;
}

function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-/g, "_");
}

// "+ Add existing field..." / "+ Create new field..." — same control on
// trip EntryCards and Future Interest. Trip mode writes one section's
// field_defs; category mode writes the shared template + every section
// in that site category so types stay in sync.
export default function AddFieldSelect({
  tripSlug,
  sectionId,
  categorySlug,
  existingKeys,
  onFieldAdded,
}: AddFieldSelectProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<CustomFieldTemplate[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<FieldType>(categorySlug ? "boolean" : "text");
  const [newOptionsText, setNewOptionsText] = useState("");
  const [newOverview, setNewOverview] = useState(!!categorySlug);

  useEffect(() => {
    fetch("/api/field-templates", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => {});
  }, []);

  const availableTemplates = templates.filter((t) => !existingKeys.includes(t.field_key));

  async function postField(field: AddedFieldPayload) {
    setAdding(true);
    setError("");
    try {
      if (categorySlug) {
        const res = await fetch("/api/field-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categorySlug, ...field }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Add failed");
        onFieldAdded?.(field);
        return true;
      }
      if (!tripSlug || !sectionId) throw new Error("Missing trip/section");
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
    const ok = await postField({
      key,
      label,
      fieldType: newType,
      showOnOverview: newOverview,
      required: false,
      options,
    });
    if (ok) {
      setCreating(false);
      setNewLabel("");
      setNewType(categorySlug ? "boolean" : "text");
      setNewOptionsText("");
      setNewOverview(!!categorySlug);
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
