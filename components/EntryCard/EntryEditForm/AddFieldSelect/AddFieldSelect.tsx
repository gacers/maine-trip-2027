"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomFieldTemplate } from "@/lib/customFieldTemplates";
import styles from "./AddFieldSelect.module.css";

export interface AddFieldSelectProps {
  tripSlug: string;
  sectionId: string;
  /** This section's own current field keys — an already-added one
   * isn't offered again, same as FieldDefsEditor's own
   * availableTemplates filter. */
  existingKeys: string[];
}

// "+ Add existing field..." for a section that's missing one while
// actually editing an entry that could use it right now (confirmed
// live as a real need: checking a Food & Drink type-tag box that
// hasn't been added to THIS section yet used to mean leaving the
// entry, opening Edit Section, adding it there via FieldDefsEditor's
// own identical picker, then coming back). Same list
// (/api/field-templates), same "{label} ({field_type})" option
// format, same immediate-on-select behavior — the only difference is
// this persists straight to the section's own field_defs right away
// (there's no separate section-level Save step to defer to from
// inside an entry's own edit form) and refreshes the page so the new
// field's own input appears here immediately.
export default function AddFieldSelect({ tripSlug, sectionId, existingKeys }: AddFieldSelectProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<CustomFieldTemplate[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/field-templates", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => {});
  }, []);

  const availableTemplates = templates.filter((t) => !existingKeys.includes(t.field_key));

  async function addTemplateField(fieldKey: string) {
    const template = availableTemplates.find((t) => t.field_key === fieldKey);
    if (!template) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch(`/api/trips/${tripSlug}/sections/add-field`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId,
          key: template.field_key,
          label: template.label,
          fieldType: template.field_type,
          showOnOverview: template.show_on_overview,
          required: template.required,
          options: template.options,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Add failed");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  if (availableTemplates.length === 0) return null;

  return (
    <div className={styles["root"]}>
      <select
        value=""
        disabled={adding}
        onChange={(e) => {
          if (e.target.value) addTemplateField(e.target.value);
        }}
        className={styles["select"]}
      >
        <option value="">{adding ? "Adding..." : "+ Add existing field..."}</option>
        {availableTemplates.map((t) => (
          <option key={t.field_key} value={t.field_key}>
            {t.label} ({t.field_type})
          </option>
        ))}
      </select>
      {error && <p className={styles["error"]}>{error}</p>}
    </div>
  );
}
