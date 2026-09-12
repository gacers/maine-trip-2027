"use client";

import { useState } from "react";

const PRESET_REASONS = ["Too expensive", "Bad location"];

// Small inline popup (not a full modal) used by the Delete button on an
// active card: pick preset reasons and/or write a custom one, then
// archive. The item moves to the Archived list with that reason stored,
// and can still be restored from there.
export default function ArchiveDialog({ onConfirm, onCancel }) {
  const [selected, setSelected] = useState(new Set());
  const [other, setOther] = useState("");

  function toggle(reason) {
    const next = new Set(selected);
    if (next.has(reason)) next.delete(reason);
    else next.add(reason);
    setSelected(next);
  }

  function confirm() {
    const reasons = [...selected];
    if (other.trim()) reasons.push(other.trim());
    onConfirm(reasons.join(", "));
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-zinc-300 bg-white shadow-lg p-3 flex flex-col gap-3 z-10">
      <div>
        <p className="text-sm font-medium text-zinc-700 mb-1.5">Why archive this?</p>
        <div className="flex flex-col gap-1.5">
          {PRESET_REASONS.map((reason) => (
            <label key={reason} className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={selected.has(reason)}
                onChange={() => toggle(reason)}
                className="h-4 w-4"
              />
              {reason}
            </label>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Other (optional)
        <textarea
          value={other}
          onChange={(e) => setOther(e.target.value)}
          rows={2}
          placeholder="Any other reason..."
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </label>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-sm text-zinc-500 hover:underline">
          Cancel
        </button>
        <button
          onClick={confirm}
          className="rounded bg-red-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-red-700"
        >
          Archive
        </button>
      </div>
    </div>
  );
}
