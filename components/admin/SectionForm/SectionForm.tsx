"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { PublicTrip, NavGroup, Section, FieldDef, FieldType } from "@/lib/types";
import styles from "./SectionForm.module.css";

const FIELD_TYPES: FieldType[] = [
  "text",
  "textarea",
  "url",
  "image_url",
  "number",
  "count",
  "price",
  "select",
  "boolean",
  "date",
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// A field_def, edited as a form row — `optionsText` is the raw
// comma-separated input for whichever of options.choices/options.aliases
// this field's type actually uses, only split back into an array on
// submit (rowToFieldDef).
interface FieldRow {
  key: string;
  label: string;
  field_type: FieldType;
  show_on_overview: boolean;
  required: boolean;
  optionsText: string;
}

function fieldDefToRow(f: FieldDef): FieldRow {
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

function rowToFieldDef(row: FieldRow) {
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

export interface SectionFormProps {
  trip: PublicTrip;
  navGroups: NavGroup[];
  section?: Section | null;
}

// Shared by both the "New section" and "Edit section" admin pages —
// the create/update API contract (POST/PATCH) is almost identical, this
// form just switches which one it calls.
export default function SectionForm({ trip, navGroups, section }: SectionFormProps) {
  const router = useRouter();
  const isEdit = !!section;

  const [label, setLabel] = useState(section?.label || "");
  const [slug, setSlug] = useState(section?.slug || "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [subNavLabel, setSubNavLabel] = useState(section?.sub_nav_label || "");
  const [addPlaceholder, setAddPlaceholder] = useState(section?.add_placeholder || "");
  const [emptyMessage, setEmptyMessage] = useState(section?.empty_message || "");
  const [supportsPairing, setSupportsPairing] = useState(section?.supports_pairing ?? false);
  const [hasMap, setHasMap] = useState(section?.has_map ?? true);
  const [supportsRanking, setSupportsRanking] = useState(section?.supports_ranking ?? false);
  const [supportsRatings, setSupportsRatings] = useState(section?.supports_ratings ?? false);
  const [compactCards, setCompactCards] = useState(section?.compact_cards ?? false);
  const [navGroupId, setNavGroupId] = useState(section?.nav_group_id || navGroups[0]?.id || "");
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [fields, setFields] = useState<FieldRow[]>((section?.field_defs || []).map(fieldDefToRow));
  const [addCounterpart, setAddCounterpart] = useState(false);
  const [counterpartLabel, setCounterpartLabel] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function handleLabelChange(v: string) {
    setLabel(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  function addField() {
    setFields([
      ...fields,
      { key: "", label: "", field_type: "text", show_on_overview: false, required: false, optionsText: "" },
    ]);
  }

  function updateField(i: number, patch: Partial<FieldRow>) {
    setFields(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function removeField(i: number) {
    setFields(fields.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    for (const f of fields) {
      if (!f.key.trim() || !f.label.trim()) {
        setError("Every field needs both a key and a label.");
        return;
      }
    }

    setSaving(true);
    const payload: Record<string, unknown> = {
      label,
      subNavLabel: subNavLabel || label,
      addPlaceholder,
      emptyMessage,
      supportsPairing,
      hasMap,
      supportsRanking,
      supportsRatings,
      compactCards,
      fieldDefs: fields.map(rowToFieldDef),
    };
    if (!isEdit) {
      payload.slug = slug;
      if (newGroupLabel.trim()) payload.newNavGroupLabel = newGroupLabel.trim();
      else payload.navGroupId = navGroupId;
    } else {
      payload.navGroupId = navGroupId;
    }

    try {
      const url = isEdit ? `/api/trips/${trip.slug}/sections/${section!.slug}` : `/api/trips/${trip.slug}/sections`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      // Create the "already visited/done" counterpart in the SAME nav
      // group the primary section just landed in (reusing its
      // nav_group_id rather than resolving newNavGroupLabel a second
      // time, which would create a duplicate group) — same fields, but
      // never pairing/map/ranking (see below).
      if (!isEdit && addCounterpart) {
        const counterpartPayload = {
          slug: `${slug}-visited`,
          label: counterpartLabel || `Previously Visited ${label}`,
          subNavLabel: "Previously Visited",
          addPlaceholder: `Paste a link for a ${label.toLowerCase()} you've already been to...`,
          emptyMessage: `No previous ${label.toLowerCase()} yet — paste a link above.`,
          // A "previous"/already-decided list never needs pairing, a map,
          // ranking, or ratings, regardless of what the primary section
          // is set to.
          supportsPairing: false,
          hasMap: false,
          supportsRanking: false,
          supportsRatings: false,
          compactCards,
          navGroupId: data.section.nav_group_id,
          fieldDefs: fields.map(rowToFieldDef),
        };
        const counterpartRes = await fetch(`/api/trips/${trip.slug}/sections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(counterpartPayload),
        });
        const counterpartData = await counterpartRes.json();
        if (!counterpartRes.ok) {
          throw new Error(`Created "${label}", but its counterpart failed: ${counterpartData.error || "unknown error"}`);
        }
      }

      router.push(`/${trip.slug}/admin/sections`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.grid}>
        <label className={styles.field}>
          Label
          <input required value={label} onChange={(e) => handleLabelChange(e.target.value)} className={styles.input} />
        </label>
        <label className={styles.field}>
          URL slug
          <input
            required
            disabled={isEdit}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            className={styles.input}
          />
        </label>
        <label className={styles.field}>
          Sub-nav label (optional)
          <input
            value={subNavLabel}
            onChange={(e) => setSubNavLabel(e.target.value)}
            placeholder={label}
            className={styles.input}
          />
        </label>

        {isEdit ? (
          <label className={styles.field}>
            Nav group
            <select value={navGroupId} onChange={(e) => setNavGroupId(e.target.value)} className={styles.input}>
              {navGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className={styles.field}>
            <label>Nav group</label>
            <div className={styles.navGroupRow}>
              <select
                value={newGroupLabel ? "" : navGroupId}
                onChange={(e) => {
                  setNavGroupId(e.target.value);
                  setNewGroupLabel("");
                }}
                disabled={!!newGroupLabel}
                className={styles.navGroupSelect}
              >
                {navGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
              <input
                value={newGroupLabel}
                onChange={(e) => setNewGroupLabel(e.target.value)}
                placeholder="or new group..."
                className={styles.navGroupInput}
              />
            </div>
          </div>
        )}

        <label className={styles.wideField}>
          Add-form placeholder text
          <input
            value={addPlaceholder}
            onChange={(e) => setAddPlaceholder(e.target.value)}
            placeholder="Paste a link..."
            className={styles.input}
          />
        </label>
        <label className={styles.wideField}>
          Empty-list message
          <input
            value={emptyMessage}
            onChange={(e) => setEmptyMessage(e.target.value)}
            placeholder="Nothing here yet — paste a link above."
            className={styles.input}
          />
        </label>

        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={supportsPairing}
            onChange={(e) => setSupportsPairing(e.target.checked)}
            className={styles.checkbox}
          />
          Supports pairing two items into one option
        </label>
        <label className={styles.checkboxField}>
          <input type="checkbox" checked={hasMap} onChange={(e) => setHasMap(e.target.checked)} className={styles.checkbox} />
          Show a map with driving times, not just a plain marker. Turn off for a
          &quot;previous&quot;/already-done list, which has nothing left to compare.
        </label>
        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={supportsRanking}
            onChange={(e) => setSupportsRanking(e.target.checked)}
            className={styles.checkbox}
          />
          Show the manual Rank input — only for a still-deciding-among-options list (e.g. Possible Houses), not a
          &quot;previous&quot; list or lighter sections like Food &amp; Drink/Activities.
        </label>
        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={supportsRatings}
            onChange={(e) => setSupportsRatings(e.target.checked)}
            className={styles.checkbox}
          />
          Show 5-star ratings (each visitor&apos;s own score, plus everyone&apos;s average) — same
          still-deciding-among-options sections as ranking.
        </label>
        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={compactCards}
            onChange={(e) => setCompactCards(e.target.checked)}
            className={styles.checkbox}
          />
          Compact cards, two per row — for lighter entries (food & drink, activities). Leave off for houses, which
          need the full width.
        </label>
      </div>

      {!isEdit && (
        <div className={styles.counterpartBox}>
          <label className={styles.counterpartLabel}>
            <input
              type="checkbox"
              checked={addCounterpart}
              onChange={(e) => setAddCounterpart(e.target.checked)}
              className={styles.checkbox}
            />
            Also create a &quot;Previously Visited&quot; counterpart
          </label>
          <p className={styles.counterpartHint}>
            Same pattern as Possible Houses / Previous Stays — a second section in the same nav group, sharing the
            same fields, for things you&apos;ve already done (e.g. Distilleries you want to visit vs. ones
            you&apos;ve already been to).
          </p>
          {addCounterpart && (
            <label className={styles.field}>
              Counterpart label
              <input
                value={counterpartLabel}
                onChange={(e) => setCounterpartLabel(e.target.value)}
                placeholder={`Previously Visited ${label || "..."}`}
                className={styles.input}
              />
            </label>
          )}
        </div>
      )}

      <div className={styles.fieldsSection}>
        <div className={styles.fieldsHeader}>
          <h3 className={styles.fieldsTitle}>Fields</h3>
          <button type="button" onClick={addField} className={styles.addFieldButton}>
            + Add field
          </button>
        </div>
        {fields.length === 0 && (
          <p className={styles.noFieldsHint}>
            No custom fields yet — this section will still track title/url/photo/description/notes/concerns/rank/status
            by default.
          </p>
        )}
        <div className={styles.fieldRowList}>
          {fields.map((f, i) => (
            <div key={i} className={styles.fieldRow}>
              <label className={styles.fieldRowField}>
                Key
                <input
                  value={f.key}
                  onChange={(e) => updateField(i, { key: slugify(e.target.value).replace(/-/g, "_") })}
                  className={styles.fieldRowInput}
                />
              </label>
              <label className={styles.fieldRowField}>
                Label
                <input
                  value={f.label}
                  onChange={(e) => updateField(i, { label: e.target.value })}
                  className={styles.fieldRowInput}
                />
              </label>
              <label className={styles.fieldRowField}>
                Type
                <select
                  value={f.field_type}
                  onChange={(e) => updateField(i, { field_type: e.target.value as FieldType })}
                  className={styles.fieldRowInput}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              {(f.field_type === "select" || f.field_type === "count") && (
                <label className={styles.fieldRowWideField}>
                  {f.field_type === "select" ? "Choices (comma-separated)" : "Aliases (comma-separated, optional)"}
                  <input
                    value={f.optionsText}
                    onChange={(e) => updateField(i, { optionsText: e.target.value })}
                    className={styles.fieldRowInput}
                  />
                </label>
              )}
              <label className={styles.overviewCheckboxField}>
                <input
                  type="checkbox"
                  checked={f.show_on_overview}
                  onChange={(e) => updateField(i, { show_on_overview: e.target.checked })}
                  className={styles.smallCheckbox}
                />
                Overview
              </label>
              <button type="button" onClick={() => removeField(i)} className={styles.removeButton}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.actions}>
        <button type="submit" disabled={saving} className={styles.submitButton}>
          {saving ? "Saving..." : isEdit ? "Save changes" : "Create section"}
        </button>
      </div>
    </form>
  );
}
