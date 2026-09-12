"use client";

import { useState } from "react";

const initialFields = { title: "", price: "", posterImage: "", description: "", lat: "", lng: "", notes: "" };

export default function AddListingForm({ onAdded }) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | loading | editing | duplicate | saving | error
  const [fields, setFields] = useState(initialFields);
  const [warnings, setWarnings] = useState([]);
  const [duplicate, setDuplicate] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  function reset() {
    setUrl("");
    setPhase("idle");
    setFields(initialFields);
    setWarnings([]);
    setDuplicate(null);
    setErrorMsg("");
  }

  async function handlePreview(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setPhase("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/listings/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Something went wrong.");
        setPhase("idle");
        return;
      }
      if (data.duplicate) {
        setDuplicate(data.existing);
        setPhase("duplicate");
        return;
      }
      const s = data.scraped;
      setFields({
        title: s.title || "",
        price: s.price || "",
        posterImage: s.posterImage || "",
        lat: s.lat ?? "",
        lng: s.lng ?? "",
        notes: "",
      });
      setWarnings(s.warnings || []);
      setPhase("editing");
    } catch (err) {
      setErrorMsg(err.message);
      setPhase("idle");
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!fields.title.trim()) {
      setErrorMsg("Title is required.");
      return;
    }
    setPhase("saving");
    setErrorMsg("");
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, ...fields }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "duplicate") {
          setDuplicate(data.existing);
          setPhase("duplicate");
          return;
        }
        setErrorMsg(data.error || "Something went wrong.");
        setPhase("editing");
        return;
      }
      onAdded(data.listing);
      reset();
    } catch (err) {
      setErrorMsg(err.message);
      setPhase("editing");
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm">
      {phase === "idle" || phase === "loading" ? (
        <form onSubmit={handlePreview} className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            required
            placeholder="Paste an Airbnb, VRBO, or other listing URL..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={phase === "loading"}
            className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {phase === "loading" ? "Fetching..." : "Add"}
          </button>
        </form>
      ) : null}

      {errorMsg && <p className="text-sm text-red-600 mt-2">{errorMsg}</p>}

      {phase === "duplicate" && duplicate && (
        <div className="mt-2 text-sm text-zinc-700">
          Already on the list:{" "}
          <a href={`#listing-${duplicate.id}`} className="text-blue-600 hover:underline">
            {duplicate.title}
          </a>
          .
          <button onClick={reset} className="ml-3 text-zinc-500 hover:underline">
            Add a different one
          </button>
        </div>
      )}

      {phase === "editing" || phase === "saving" ? (
        <form onSubmit={handleSave} className="mt-3 flex flex-col gap-3">
          {warnings.length > 0 && (
            <ul className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 list-disc pl-5">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Title
              <input
                required
                value={fields.title}
                onChange={(e) => setFields({ ...fields, title: e.target.value })}
                className="rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Price
              <input
                value={fields.price}
                onChange={(e) => setFields({ ...fields, price: e.target.value })}
                placeholder="e.g. $450/night"
                className="rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Photo URL
              <input
                value={fields.posterImage}
                onChange={(e) => setFields({ ...fields, posterImage: e.target.value })}
                className="rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Description (one bullet per line, optional)
              <textarea
                value={fields.description}
                onChange={(e) => setFields({ ...fields, description: e.target.value })}
                rows={3}
                className="rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Latitude
              <input
                value={fields.lat}
                onChange={(e) => setFields({ ...fields, lat: e.target.value })}
                className="rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Longitude
              <input
                value={fields.lng}
                onChange={(e) => setFields({ ...fields, lng: e.target.value })}
                className="rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Notes
              <textarea
                value={fields.notes}
                onChange={(e) => setFields({ ...fields, notes: e.target.value })}
                rows={2}
                className="rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={phase === "saving"}
              className="rounded bg-zinc-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {phase === "saving" ? "Saving..." : "Save listing"}
            </button>
            <button type="button" onClick={reset} className="text-sm text-zinc-500 hover:underline">
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
