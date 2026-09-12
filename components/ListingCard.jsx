"use client";

import { useState } from "react";

const REASON_OPTIONS = [
  { key: "too_expensive", label: "Too expensive" },
  { key: "bad_location", label: "Bad location" },
];

function reasonSet(archiveReason) {
  return new Set((archiveReason || "").split(",").map((s) => s.trim()).filter(Boolean));
}

export default function ListingCard({ listing, onPatch, onDelete }) {
  const [rankDraft, setRankDraft] = useState(listing.rank ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const reasons = reasonSet(listing.archiveReason);
  const isArchived = listing.status === "archived";

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

  return (
    <article
      id={`listing-${listing.id}`}
      className={`rounded-xl border p-4 sm:p-5 shadow-sm bg-white flex flex-col gap-3 ${
        isArchived ? "border-zinc-200 opacity-70" : "border-zinc-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg font-semibold text-zinc-900 hover:text-blue-600 underline decoration-blue-400 break-words"
          >
            {listing.title}
          </a>
          {listing.price ? (
            <div className="text-sm text-zinc-600 mt-0.5">{listing.price}</div>
          ) : (
            <div className="text-sm text-zinc-400 mt-0.5 italic">No price yet</div>
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
        <img
          src={listing.posterImage}
          alt={listing.title}
          className="w-full h-48 sm:h-56 object-cover rounded-lg"
          loading="lazy"
        />
      )}

      {listing.notes && (
        <p className="text-sm text-zinc-700 whitespace-pre-wrap">{listing.notes}</p>
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
