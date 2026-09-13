"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FIELD_TYPES = ["text", "textarea", "url", "image_url", "number", "count", "price", "select", "boolean", "date"];

function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fieldDefToRow(f) {
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

function rowToFieldDef(row) {
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

// Shared by both the "New section" and "Edit section" admin pages —
// the create/update API contract (POST/PATCH) is almost identical, this
// form just switches which one it calls.
export default function SectionForm({ trip, navGroups, section }) {
  const router = useRouter();
  const isEdit = !!section;

  const [label, setLabel] = useState(section?.label || "");
  const [slug, setSlug] = useState(section?.slug || "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [subNavLabel, setSubNavLabel] = useState(section?.sub_nav_label || "");
  const [addPlaceholder, setAddPlaceholder] = useState(section?.add_placeholder || "");
  const [emptyMessage, setEmptyMessage] = useState(section?.empty_message || "");
  const [supportsPairing, setSupportsPairing] = useState(section?.supports_pairing ?? true);
  const [hasMap, setHasMap] = useState(section?.has_map ?? true);
  const [navGroupId, setNavGroupId] = useState(section?.nav_group_id || navGroups[0]?.id || "");
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [fields, setFields] = useState((section?.field_defs || []).map(fieldDefToRow));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function handleLabelChange(v) {
    setLabel(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  function addField() {
    setFields([...fields, { key: "", label: "", field_type: "text", show_on_overview: false, required: false, optionsText: "" }]);
  }

  function updateField(i, patch) {
    setFields(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function removeField(i) {
    setFields(fields.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    for (const f of fields) {
      if (!f.key.trim() || !f.label.trim()) {
        setError("Every field needs both a key and a label.");
        return;
      }
    }

    setSaving(true);
    const payload = {
      label,
      subNavLabel: subNavLabel || label,
      addPlaceholder,
      emptyMessage,
      supportsPairing,
      hasMap,
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
      const url = isEdit
        ? `/api/trips/${trip.slug}/sections/${section.slug}`
        : `/api/trips/${trip.slug}/sections`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      router.push(`/${trip.slug}/admin/sections`);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Label
          <input
            required
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          URL slug
          <input
            required
            disabled={isEdit}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            className="rounded border border-zinc-300 px-2 py-1.5 disabled:bg-zinc-100 disabled:text-zinc-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Sub-nav label (optional)
          <input
            value={subNavLabel}
            onChange={(e) => setSubNavLabel(e.target.value)}
            placeholder={label}
            className="rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>

        {isEdit ? (
          <label className="flex flex-col gap-1 text-sm">
            Nav group
            <select
              value={navGroupId}
              onChange={(e) => setNavGroupId(e.target.value)}
              className="rounded border border-zinc-300 px-2 py-1.5"
            >
              {navGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="flex flex-col gap-1 text-sm">
            <label>Nav group</label>
            <div className="flex gap-2">
              <select
                value={newGroupLabel ? "" : navGroupId}
                onChange={(e) => {
                  setNavGroupId(e.target.value);
                  setNewGroupLabel("");
                }}
                disabled={!!newGroupLabel}
                className="flex-1 rounded border border-zinc-300 px-2 py-1.5 disabled:bg-zinc-100"
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
                className="flex-1 rounded border border-zinc-300 px-2 py-1.5"
              />
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Add-form placeholder text
          <input
            value={addPlaceholder}
            onChange={(e) => setAddPlaceholder(e.target.value)}
            placeholder="Paste a link..."
            className="rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Empty-list message
          <input
            value={emptyMessage}
            onChange={(e) => setEmptyMessage(e.target.value)}
            placeholder="Nothing here yet — paste a link above."
            className="rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={supportsPairing} onChange={(e) => setSupportsPairing(e.target.checked)} className="h-4 w-4" />
          Supports pairing two items into one option
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasMap} onChange={(e) => setHasMap(e.target.checked)} className="h-4 w-4" />
          Show a map when lat/lng are set
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-700">Fields</h3>
          <button type="button" onClick={addField} className="text-sm text-blue-600 hover:underline">
            + Add field
          </button>
        </div>
        {fields.length === 0 && (
          <p className="text-xs text-zinc-500">
            No custom fields yet — this section will still track title/url/photo/description/notes/concerns/rank/status by default.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {fields.map((f, i) => (
            <div key={i} className="rounded-lg border border-zinc-200 p-2.5 grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
              <label className="flex flex-col gap-1 text-xs col-span-1">
                Key
                <input
                  value={f.key}
                  onChange={(e) => updateField(i, { key: slugify(e.target.value).replace(/-/g, "_") })}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs col-span-1">
                Label
                <input
                  value={f.label}
                  onChange={(e) => updateField(i, { label: e.target.value })}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs col-span-1">
                Type
                <select
                  value={f.field_type}
                  onChange={(e) => updateField(i, { field_type: e.target.value })}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              {(f.field_type === "select" || f.field_type === "count") && (
                <label className="flex flex-col gap-1 text-xs col-span-2">
                  {f.field_type === "select" ? "Choices (comma-separated)" : "Aliases (comma-separated, optional)"}
                  <input
                    value={f.optionsText}
                    onChange={(e) => updateField(i, { optionsText: e.target.value })}
                    className="rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
              )}
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={f.show_on_overview}
                  onChange={(e) => updateField(i, { show_on_overview: e.target.checked })}
                  className="h-3.5 w-3.5"
                />
                Overview
              </label>
              <button
                type="button"
                onClick={() => removeField(i)}
                className="text-xs text-red-600 hover:underline justify-self-start"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : isEdit ? "Save changes" : "Create section"}
        </button>
      </div>
    </form>
  );
}
