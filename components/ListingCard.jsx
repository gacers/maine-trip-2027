"use client";

import { useState } from "react";
import ListingMap from "./ListingMap";
import { geocodeAddress } from "@/lib/loadGoogleMaps";

const REASON_OPTIONS = [
  { key: "too_expensive", label: "Too expensive" },
  { key: "bad_location", label: "Bad location" },
];

function reasonSet(archiveReason) {
  return new Set((archiveReason || "").split(",").map((s) => s.trim()).filter(Boolean));
}

function toBullets(text) {
  return (text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseExtraMarkers(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const MARKER_COLORS = ["#1A73E8", "#EF6C00", "#00897B", "#C2185B", "#5D4037", "#616161"];

function BulletList({ items }) {
  if (!items.length) return null;
  return (
    <ul className="list-disc pl-5 text-sm text-zinc-700 flex flex-col gap-0.5">
      {items.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
}

export default function ListingCard({ listing, onPatch, onDelete, bare = false, showTitle = true }) {
  const [rankDraft, setRankDraft] = useState(listing.rank ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState("");
  const reasons = reasonSet(listing.archiveReason);
  const isArchived = listing.status === "archived";
  const extraMarkers = parseExtraMarkers(listing.extraMarkers);

  function toggleReason(key) {
    const next = new Set(reasons);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const archiveReason = Array.from(next).join(",");
    onPatch(listing.id, {
      archiveReason,
      status: next.size > 0 ? "archived" : "active",
    });
  }

  function restore() {
    onPatch(listing.id, { archiveReason: "", status: "active" });
  }

  function commitRank() {
    const n = Number(rankDraft);
    if (!Number.isNaN(n) && n !== listing.rank) {
      onPatch(listing.id, { rank: n });
    }
  }

  function startEdit() {
    setDraft({
      title: listing.title || "",
      price: listing.price || "",
      posterImage: listing.posterImage || "",
      description: (listing.description || "").split("\n").filter(Boolean).join("\n"),
      notes: listing.notes || "",
      lat: listing.lat ?? "",
      lng: listing.lng ?? "",
      groupLabel: listing.groupLabel || "",
      extraMarkers: extraMarkers.length
        ? extraMarkers
        : [],
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

    onPatch(listing.id, {
      title: draft.title,
      price: draft.price,
      posterImage: draft.posterImage,
      description: draft.description,
      notes: draft.notes,
      lat: draft.lat === "" ? "" : Number(draft.lat),
      lng: draft.lng === "" ? "" : Number(draft.lng),
      groupLabel: draft.groupLabel || "",
      extraMarkers: JSON.stringify(cleanMarkers),
    });
    setIsEditing(false);
    setDraft(null);
  }

  const hasHouse = listing.lat !== null && listing.lat !== "" && listing.lng !== null && listing.lng !== "";

  return (
    <article
      id={`listing-${listing.id}`}
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
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-semibold text-zinc-900 hover:text-blue-600 underline decoration-blue-400 break-words"
            >
              {listing.title}
            </a>
          )}
          {listing.price ? (
            <div className="text-sm text-zinc-600 mt-0.5">{listing.price}</div>
          ) : (
            <div className="text-sm text-zinc-400 mt-0.5 italic">No price yet</div>
          )}
          {!showTitle && (
            <a
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              Original listing &#8599;
            </a>
          )}
        </div>
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
      </div>

      {listing.posterImage && (
        <div className="w-full max-h-[480px] flex items-center justify-center bg-zinc-100 rounded-lg overflow-hidden">
          <img
            src={listing.posterImage}
            alt={listing.title}
            className="w-full h-auto max-h-[480px] object-contain"
            loading="lazy"
          />
        </div>
      )}

      {!isEditing && toBullets(listing.description).length > 0 && (
        <div>
          <h3 className="text-sm uppercase tracking-wide text-zinc-500 font-medium mb-1">
            Description
          </h3>
          <BulletList items={toBullets(listing.description)} />
        </div>
      )}

      {!isEditing && toBullets(listing.notes).length > 0 && (
        <div>
          <h3 className="text-sm uppercase tracking-wide text-zinc-500 font-medium mb-1">Notes</h3>
          <BulletList items={toBullets(listing.notes)} />
        </div>
      )}

      {!isEditing && hasHouse && (
        <ListingMap
          house={{ lat: listing.lat, lng: listing.lng }}
          houseLabel="House (approximate location)"
          extraMarkers={extraMarkers}
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
              Price
              <input
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                className="rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
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
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Notes (one bullet per line)
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows={2}
                className="rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
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
              Group label (optional — only if this is a 2-house option)
              <input
                value={draft.groupLabel}
                onChange={(e) => setDraft({ ...draft, groupLabel: e.target.value })}
                placeholder='e.g. "Jonesport - 2 House Option" (use the exact same text on both houses)'
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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 border-t border-zinc-100 mt-1">
        {REASON_OPTIONS.map((opt) => (
          <label key={opt.key} className="flex items-center gap-1.5 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={reasons.has(opt.key)}
              onChange={() => toggleReason(opt.key)}
              className="h-4 w-4"
            />
            {opt.label}
          </label>
        ))}

        {!isEditing && (
          <button onClick={startEdit} className="text-sm text-zinc-600 hover:underline">
            Edit details
          </button>
        )}

        {isArchived && (
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={restore}
              className="text-sm text-blue-600 hover:underline"
            >
              Restore
            </button>
            {confirmingDelete ? (
              <span className="text-sm flex items-center gap-2">
                Delete for good?
                <button
                  onClick={() => onDelete(listing.id)}
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
