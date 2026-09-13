"use client";

import { useState } from "react";
import { geocodeAddress } from "@/lib/loadGoogleMaps";
import FieldInput from "./FieldInput";

const CORE_INITIAL = {
  title: "",
  posterImage: "",
  description: "",
  lat: "",
  lng: "",
  notes: "",
  concerns: "",
  groupLabel: "",
};

export default function AddEntryForm({ trip, section, onAdded, authToken = null }) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | loading | editing | duplicate | saving | error
  const [fields, setFields] = useState(CORE_INITIAL);
  const [data, setData] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [duplicate, setDuplicate] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState("");

  const fieldDefs = section.field_defs || [];
  const apiBase = `/api/trips/${trip.slug}/sections/${section.slug}/entries`;
  const authHeaders = authToken ? { Authorization: `Bearer ${authToken}` } : {};

  function initialData() {
    const d = {};
    fieldDefs.forEach((f) => {
      d[f.key] = "";
    });
    return d;
  }

  async function handleFindCoords() {
    if (!address.trim()) return;
    setGeocoding(true);
    setGeocodeMsg("");
    try {
      const { lat, lng, formattedAddress } = await geocodeAddress(address);
      setFields((f) => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
      setGeocodeMsg(`Found: ${formattedAddress}`);
    } catch (err) {
      setGeocodeMsg(err.message);
    } finally {
      setGeocoding(false);
    }
  }

  function reset() {
    setUrl("");
    setPhase("idle");
    setFields(CORE_INITIAL);
    setData({});
    setWarnings([]);
    setDuplicate(null);
    setAddress("");
    setGeocodeMsg("");
    setErrorMsg("");
  }

  async function handlePreview(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setPhase("loading");
    setErrorMsg("");
    try {
      const res = await fetch(`${apiBase}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ url }),
      });
      const resData = await res.json();
      if (!res.ok) {
        setErrorMsg(resData.error || "Something went wrong.");
        setPhase("idle");
        return;
      }
      if (resData.duplicate) {
        setDuplicate(resData.existing);
        setPhase("duplicate");
        return;
      }
      const s = resData.scraped;
      setFields({
        ...CORE_INITIAL,
        title: s.title || "",
        posterImage: s.posterImage || "",
        lat: s.lat ?? "",
        lng: s.lng ?? "",
      });
      setData(initialData());
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
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ url, ...fields, data }),
      });
      const resData = await res.json();
      if (!res.ok) {
        if (resData.error === "duplicate") {
          setDuplicate(resData.existing);
          setPhase("duplicate");
          return;
        }
        setErrorMsg(resData.error || "Something went wrong.");
        setPhase("editing");
        return;
      }
      onAdded(resData.entry);
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
            placeholder={section.add_placeholder}
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

            {fieldDefs.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:col-span-2">
                {fieldDefs.map((f) => (
                  <FieldInput
                    key={f.key}
                    fieldDef={f}
                    value={data[f.key]}
                    onChange={(v) => setData({ ...data, [f.key]: v })}
                  />
                ))}
                {fieldDefs.some((f) => f.field_type === "count") && (
                  <p className="text-xs text-zinc-500 col-span-full -mt-1">
                    Leave count fields blank to auto-fill from the description.
                  </p>
                )}
              </div>
            )}

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
            <div className="flex flex-col gap-1 text-sm sm:col-span-2">
              <label>Or find lat/lng from an address</label>
              <div className="flex gap-2">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 129 State Route 32, New Harbor, ME"
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
              Notes
              <textarea
                value={fields.notes}
                onChange={(e) => setFields({ ...fields, notes: e.target.value })}
                rows={2}
                className="rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Concerns (optional)
              <textarea
                value={fields.concerns}
                onChange={(e) => setFields({ ...fields, concerns: e.target.value })}
                rows={2}
                className="rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Group label (optional — only if this is a 2-item option)
              <input
                value={fields.groupLabel}
                onChange={(e) => setFields({ ...fields, groupLabel: e.target.value })}
                placeholder='e.g. "Jonesport - 2 House Option" (use the exact same text on both)'
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
              {phase === "saving" ? "Saving..." : "Save"}
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
