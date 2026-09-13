"use client";

import { useState } from "react";
import ListingMap from "./ListingMap";
import ArchiveDialog from "./ArchiveDialog";
import { geocodeAddress } from "@/lib/loadGoogleMaps";
import { parseExtraMarkers, hasCoords } from "@/lib/listingUtils";
import { computeBadge as computePriceBadge } from "@/lib/fieldTypes/price";
import { formatCounts } from "@/lib/fieldTypes/count";
import FieldInput from "./FieldInput";

function toBullets(text) {
  return (text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

const MARKER_COLORS = ["#1A73E8", "#EF6C00", "#00897B", "#C2185B", "#5D4037", "#616161"];

// The one bulleted-list structure every list on a card builds on —
// Description (plain) and Notes/Concerns (editable, via `renderItem`
// below) always render with this exact same <ul>/<li> markup so they
// look and space identically everywhere.
function BulletList({ items, renderItem }) {
  if (!items.length) return null;
  return (
    <ul className="list-disc pl-5 text-sm text-zinc-700 flex flex-col gap-0.5">
      {items.map((item, i) => (
        <li key={i}>{renderItem ? renderItem(item, i) : item}</li>
      ))}
    </ul>
  );
}

// A BulletList whose items are removable on hover, plus a "+ Add ..."
// affordance that appends a new one via onAdd — used for Notes/
// Concerns. Appending goes through the entries PATCH route's
// appendNote/appendConcern (see that route), the same operation
// whether it's triggered by this button or by asking Claude Desktop to
// add one to an existing entry.
function EditableNoteList({ items, onAdd, onRemove, addLabel, placeholder }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    onAdd(draft.trim());
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <BulletList
        items={items}
        renderItem={(item, i) => (
          <span className="group flex items-start justify-between gap-2">
            <span>{item}</span>
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="text-xs text-zinc-400 hover:text-red-600 opacity-0 group-hover:opacity-100 shrink-0"
            >
              Remove
            </button>
          </span>
        )}
      />
      {adding ? (
        <form onSubmit={submit} className="flex gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm"
          />
          <button type="submit" className="text-sm font-medium text-blue-600 hover:underline">
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setDraft("");
            }}
            className="text-sm text-zinc-500 hover:underline"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-sm text-blue-600 hover:underline self-start"
        >
          + {addLabel}
        </button>
      )}
    </div>
  );
}

export default function EntryCard({
  entry,
  fieldDefs = [],
  mapConfig,
  onPatch,
  onDelete,
  bare = false,
  showTitle = true,
  showRank = true,
  showMap = true,
}) {
  const [rankDraft, setRankDraft] = useState(entry.rank ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState("");
  const isArchived = entry.status === "archived";
  const extraMarkers = parseExtraMarkers(entry.extraMarkers);

  const priceFields = fieldDefs.filter((f) => f.field_type === "price");
  const countFields = fieldDefs.filter((f) => f.field_type === "count");
  const countsSummary = formatCounts(countFields.map((f) => ({ fieldDef: f, value: entry[f.key] })));

  function archive(reason) {
    onPatch(entry.id, { archiveReason: reason, status: "archived" });
    setShowArchiveDialog(false);
  }

  function restore() {
    onPatch(entry.id, { archiveReason: "", status: "active" });
  }

  function commitRank() {
    const n = Number(rankDraft);
    if (!Number.isNaN(n) && n !== entry.rank) {
      onPatch(entry.id, { rank: n });
    }
  }

  function addNote(text) {
    onPatch(entry.id, { appendNote: text });
  }

  function removeNoteAt(i) {
    const remaining = toBullets(entry.notes).filter((_, idx) => idx !== i);
    onPatch(entry.id, { notes: remaining.join("\n") });
  }

  function addConcern(text) {
    onPatch(entry.id, { appendConcern: text });
  }

  function removeConcernAt(i) {
    const remaining = toBullets(entry.concerns).filter((_, idx) => idx !== i);
    onPatch(entry.id, { concerns: remaining.join("\n") });
  }

  function startEdit() {
    const dataDraft = {};
    fieldDefs.forEach((f) => {
      dataDraft[f.key] = entry[f.key] ?? "";
    });
    setDraft({
      title: entry.title || "",
      posterImage: entry.posterImage || "",
      description: (entry.description || "").split("\n").filter(Boolean).join("\n"),
      lat: entry.lat ?? "",
      lng: entry.lng ?? "",
      groupLabel: entry.groupLabel || "",
      extraMarkers: extraMarkers.length ? extraMarkers : [],
      data: dataDraft,
    });
    setAddress("");
    setGeocodeMsg("");
    setIsEditing(true);
  }

  async function handleFindCoords() {
    if (!address.trim()) return;
    setGeocoding(true);
    setGeocodeMsg("");
    try {
      const { lat, lng, formattedAddress } = await geocodeAddress(address);
      setDraft((d) => ({ ...d, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
      setGeocodeMsg(`Found: ${formattedAddress}`);
    } catch (err) {
      setGeocodeMsg(err.message);
    } finally {
      setGeocoding(false);
    }
  }

  function updateDraftMarker(i, field, value) {
    const next = draft.extraMarkers.map((m, idx) => (idx === i ? { ...m, [field]: value } : m));
    setDraft({ ...draft, extraMarkers: next });
  }

  function addDraftMarker() {
    const color = MARKER_COLORS[draft.extraMarkers.length % MARKER_COLORS.length];
    setDraft({
      ...draft,
      extraMarkers: [...draft.extraMarkers, { label: "", color, lat: "", lng: "" }],
    });
  }

  function removeDraftMarker(i) {
    setDraft({ ...draft, extraMarkers: draft.extraMarkers.filter((_, idx) => idx !== i) });
  }

  function saveEdit() {
    const cleanMarkers = draft.extraMarkers
      .filter((m) => m.label && m.lat !== "" && m.lng !== "")
      .map((m) => ({ label: m.label, color: m.color, lat: Number(m.lat), lng: Number(m.lng) }));

    const dataPatch = {};
    for (const f of fieldDefs) {
      const v = draft.data[f.key];
      dataPatch[f.key] = f.field_type === "number" || f.field_type === "count" ? (v === "" ? "" : Number(v)) : v;
    }

    onPatch(entry.id, {
      title: draft.title,
      posterImage: draft.posterImage,
      description: draft.description,
      lat: draft.lat === "" ? "" : Number(draft.lat),
      lng: draft.lng === "" ? "" : Number(draft.lng),
      groupLabel: draft.groupLabel || "",
      extraMarkers: cleanMarkers,
      data: dataPatch,
    });
    setIsEditing(false);
    setDraft(null);
  }

  const hasHouse = hasCoords(entry);

  return (
    <article
      id={`listing-${entry.id}`}
      className={`flex flex-col gap-3 ${
        bare
          ? isArchived
            ? "opacity-70"
            : ""
          : `rounded-xl border p-4 sm:p-5 shadow-sm bg-white ${
              isArchived ? "border-zinc-200 opacity-70" : "border-zinc-200"
            }`
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {showTitle && (
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-semibold text-zinc-900 hover:text-blue-600 underline decoration-blue-400 break-words"
            >
              {entry.title}
            </a>
          )}
          {priceFields.map((f) => {
            const value = entry[f.key];
            const badge = computePriceBadge(value);
            return value ? (
              <div key={f.key} className="text-sm text-zinc-600 mt-0.5">
                {value}
                {badge && <span className="text-zinc-500"> ({badge})</span>}
              </div>
            ) : (
              <div key={f.key} className="text-sm text-zinc-400 mt-0.5 italic">
                No {f.label.toLowerCase()} yet
              </div>
            );
          })}
          {countsSummary && <div className="text-xs text-zinc-500 mt-0.5">{countsSummary}</div>}
          {!showTitle && (
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              Original listing &#8599;
            </a>
          )}
        </div>
        {showRank && (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <label className="text-xs text-zinc-500">Rank</label>
            <input
              type="number"
              value={rankDraft}
              onChange={(e) => setRankDraft(e.target.value)}
              onBlur={commitRank}
              className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm text-center"
            />
          </div>
        )}
      </div>

      {entry.posterImage && (
        <div className="w-full max-h-[480px] flex items-center justify-center bg-zinc-100 rounded-lg overflow-hidden">
          <img
            src={entry.posterImage}
            alt={entry.title}
            className="w-full h-auto max-h-[480px] object-contain"
            loading="lazy"
          />
        </div>
      )}

      {!isEditing && toBullets(entry.description).length > 0 && (
        <div>
          <h3 className="text-sm uppercase tracking-wide text-zinc-500 font-medium mb-1">
            Description
          </h3>
          <BulletList items={toBullets(entry.description)} />
        </div>
      )}

      {!isEditing && showMap && hasHouse && (
        <ListingMap
          houses={[{ lat: entry.lat, lng: entry.lng, label: "House (approximate location)" }]}
          extraMarkers={extraMarkers}
          mapConfig={mapConfig}
        />
      )}

      {isEditing && draft && (
        <div className="border border-zinc-200 rounded-lg p-3 flex flex-col gap-3 bg-zinc-50">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Title
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Photo URL
              <input
                value={draft.posterImage}
                onChange={(e) => setDraft({ ...draft, posterImage: e.target.value })}
                className="rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Description (one bullet per line)
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={4}
                className="rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>

            {fieldDefs.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:col-span-2">
                {fieldDefs.map((f) => (
                  <FieldInput
                    key={f.key}
                    fieldDef={f}
                    value={draft.data[f.key]}
                    onChange={(v) => setDraft({ ...draft, data: { ...draft.data, [f.key]: v } })}
                  />
                ))}
                {countFields.length > 0 && (
                  <p className="text-xs text-zinc-500 col-span-full -mt-1">
                    Count fields auto-fill from the description when left blank.
                  </p>
                )}
              </div>
            )}

            <label className="flex flex-col gap-1 text-sm">
              House latitude
              <input
                value={draft.lat}
                onChange={(e) => setDraft({ ...draft, lat: e.target.value })}
                className="rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              House longitude
              <input
                value={draft.lng}
                onChange={(e) => setDraft({ ...draft, lng: e.target.value })}
                className="rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <div className="flex flex-col gap-1 text-sm sm:col-span-2">
              <label>Or find lat/lng from an address</label>
              <div className="flex gap-2">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 45 Ocean Ave, Jonesport, ME"
                  className="flex-1 rounded border border-zinc-300 px-2 py-1.5"
                />
                <button
                  type="button"
                  onClick={handleFindCoords}
                  disabled={geocoding || !address.trim()}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  {geocoding ? "Finding..." : "Find"}
                </button>
              </div>
              {geocodeMsg && <p className="text-xs text-zinc-500">{geocodeMsg}</p>}
            </div>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Group label (optional — only if this is a 2-item option)
              <input
                value={draft.groupLabel}
                onChange={(e) => setDraft({ ...draft, groupLabel: e.target.value })}
                placeholder='e.g. "Jonesport - 2 House Option" (use the exact same text on both)'
                className="rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-medium text-zinc-700">
                Extra map points (restaurants, hikes, puffin tour, nearest town, etc.)
              </h4>
              <button
                type="button"
                onClick={addDraftMarker}
                className="text-sm text-blue-600 hover:underline"
              >
                + Add point
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {draft.extraMarkers.map((m, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-center">
                  <input
                    placeholder="Label"
                    value={m.label}
                    onChange={(e) => updateDraftMarker(i, "label", e.target.value)}
                    className="rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                  <input
                    placeholder="Latitude"
                    value={m.lat}
                    onChange={(e) => updateDraftMarker(i, "lat", e.target.value)}
                    className="rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                  <input
                    placeholder="Longitude"
                    value={m.lng}
                    onChange={(e) => updateDraftMarker(i, "lng", e.target.value)}
                    className="rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                  <input
                    type="color"
                    value={m.color}
                    onChange={(e) => updateDraftMarker(i, "color", e.target.value)}
                    className="w-8 h-8 p-0 border-0"
                  />
                  <button
                    type="button"
                    onClick={() => removeDraftMarker(i)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={saveEdit}
              className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium"
            >
              Save
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setDraft(null);
              }}
              className="text-sm text-zinc-500 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h3 className="text-sm uppercase tracking-wide text-zinc-500 font-medium">Notes</h3>
        <EditableNoteList
          items={toBullets(entry.notes)}
          onAdd={addNote}
          onRemove={removeNoteAt}
          addLabel="Add note"
          placeholder="Add a note..."
        />
      </div>

      <div className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
        <h3 className="text-sm uppercase tracking-wide text-amber-700 font-medium">Concerns</h3>
        <EditableNoteList
          items={toBullets(entry.concerns)}
          onAdd={addConcern}
          onRemove={removeConcernAt}
          addLabel="Add concern"
          placeholder="Anything that gives you pause..."
        />
      </div>

      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 border-t border-zinc-100 mt-1">
        {!isArchived && (
          <div className="relative">
            <button
              onClick={() => setShowArchiveDialog((v) => !v)}
              className="text-sm text-red-600 hover:underline"
            >
              Delete
            </button>
            {showArchiveDialog && (
              <ArchiveDialog onConfirm={archive} onCancel={() => setShowArchiveDialog(false)} />
            )}
          </div>
        )}

        {!isEditing && (
          <button onClick={startEdit} className="text-sm text-zinc-600 hover:underline">
            Edit details
          </button>
        )}

        {isArchived && (
          <div className="ml-auto flex items-center gap-3">
            {entry.archiveReason && (
              <span className="text-xs text-zinc-500 italic">{entry.archiveReason}</span>
            )}
            <button onClick={restore} className="text-sm text-blue-600 hover:underline">
              Restore
            </button>
            {confirmingDelete ? (
              <span className="text-sm flex items-center gap-2">
                Delete for good?
                <button
                  onClick={() => onDelete(entry.id)}
                  className="text-red-600 font-medium hover:underline"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="text-zinc-500 hover:underline"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-sm text-red-600 hover:underline"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
