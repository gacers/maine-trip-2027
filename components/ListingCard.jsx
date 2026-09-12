"use client";

import { useState } from "react";
import ListingMap from "./ListingMap";
import ArchiveDialog from "./ArchiveDialog";
import { geocodeAddress } from "@/lib/loadGoogleMaps";
import { parseExtraMarkers, hasCoords } from "@/lib/listingUtils";
import { formatBedBath } from "@/lib/extractCounts";
import { extractAvgPerNight, formatAvgPerNight } from "@/lib/priceUtils";

function toBullets(text) {
  return (text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
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

export default function ListingCard({
  listing,
  onPatch,
  onDelete,
  bare = false,
  showTitle = true,
  showRank = true,
  showMap = true,
  showBedBath = true,
}) {
  const [rankDraft, setRankDraft] = useState(listing.rank ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState("");
  const [notesDraft, setNotesDraft] = useState(listing.notes || "");
  const [concernsDraft, setConcernsDraft] = useState(listing.concerns || "");
  const isArchived = listing.status === "archived";
  const extraMarkers = parseExtraMarkers(listing.extraMarkers);
  const bedBath = formatBedBath(listing);
  const avgPerNight = extractAvgPerNight(listing.price);

  function archive(reason) {
    onPatch(listing.id, { archiveReason: reason, status: "archived" });
    setShowArchiveDialog(false);
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

  function commitNotes() {
    if (notesDraft !== (listing.notes || "")) {
      onPatch(listing.id, { notes: notesDraft });
    }
  }

  function commitConcerns() {
    if (concernsDraft !== (listing.concerns || "")) {
      onPatch(listing.id, { concerns: concernsDraft });
    }
  }

  function startEdit() {
    setDraft({
      title: listing.title || "",
      price: listing.price || "",
      posterImage: listing.posterImage || "",
      description: (listing.description || "").split("\n").filter(Boolean).join("\n"),
      lat: listing.lat ?? "",
      lng: listing.lng ?? "",
      bedrooms: listing.bedrooms ?? "",
      beds: listing.beds ?? "",
      bathrooms: listing.bathrooms ?? "",
      groupLabel: listing.groupLabel || "",
      extraMarkers: extraMarkers.length ? extraMarkers : [],
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
      lat: draft.lat === "" ? "" : Number(draft.lat),
      lng: draft.lng === "" ? "" : Number(draft.lng),
      bedrooms: draft.bedrooms === "" ? "" : Number(draft.bedrooms),
      beds: draft.beds === "" ? "" : Number(draft.beds),
      bathrooms: draft.bathrooms === "" ? "" : Number(draft.bathrooms),
      groupLabel: draft.groupLabel || "",
      extraMarkers: JSON.stringify(cleanMarkers),
    });
    setIsEditing(false);
    setDraft(null);
  }

  const hasHouse = hasCoords(listing);

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
            <div className="text-sm text-zinc-600 mt-0.5">
              {listing.price}
              {/* Only show our own computed average when the price text
                  doesn't already spell out a nightly rate itself. */}
              {showBedBath && avgPerNight != null && !/\/\s?night|per\s?night/i.test(listing.price) && (
                <span className="text-zinc-500"> ({formatAvgPerNight(avgPerNight)})</span>
              )}
            </div>
          ) : (
            <div className="text-sm text-zinc-400 mt-0.5 italic">No price yet</div>
          )}
          {showBedBath && bedBath && (
            <div className="text-xs text-zinc-500 mt-0.5">{bedBath}</div>
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

      {!isEditing && showMap && hasHouse && (
        <ListingMap
          houses={[{ lat: listing.lat, lng: listing.lng, label: "House (approximate location)" }]}
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
            {showBedBath && (
              <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                <label className="flex flex-col gap-1 text-sm">
                  Bedrooms
                  <input
                    type="number"
                    value={draft.bedrooms}
                    onChange={(e) => setDraft({ ...draft, bedrooms: e.target.value })}
                    className="rounded border border-zinc-300 px-2 py-1.5"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Beds
                  <input
                    type="number"
                    value={draft.beds}
                    onChange={(e) => setDraft({ ...draft, beds: e.target.value })}
                    className="rounded border border-zinc-300 px-2 py-1.5"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Bathrooms
                  <input
                    type="number"
                    step="0.5"
                    value={draft.bathrooms}
                    onChange={(e) => setDraft({ ...draft, bathrooms: e.target.value })}
                    className="rounded border border-zinc-300 px-2 py-1.5"
                  />
                </label>
                <p className="text-xs text-zinc-500 col-span-3 -mt-1">
                  Auto-filled from the description when left blank.
                </p>
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
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={commitNotes}
          rows={2}
          placeholder="Add a note..."
          className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm text-zinc-700 bg-zinc-50 focus:bg-white focus:border-zinc-400"
        />
      </div>

      <div className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
        <h3 className="text-sm uppercase tracking-wide text-amber-700 font-medium">Concerns</h3>
        <textarea
          value={concernsDraft}
          onChange={(e) => setConcernsDraft(e.target.value)}
          onBlur={commitConcerns}
          rows={2}
          placeholder="Anything that gives you pause..."
          className="w-full rounded border border-amber-200 px-2 py-1.5 text-sm text-zinc-700 bg-white focus:border-amber-400"
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
            {listing.archiveReason && (
              <span className="text-xs text-zinc-500 italic">{listing.archiveReason}</span>
            )}
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
