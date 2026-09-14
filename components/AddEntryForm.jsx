"use client";

import { useState } from "react";
import { geocodeAddress } from "@/lib/loadGoogleMaps";
import { searchPlacesByText } from "@/lib/googlePlaces";
import {
  isPlainUrl,
  isGoogleMapsShareUrl,
  isGoogleSearchUrl,
  isGoogleMapsUrl,
  extractGoogleSearchQuery,
  parseGoogleMapsUrl,
} from "@/lib/googleUrlHelpers";
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

// Mirrors the guidance Claude Desktop already follows for a paired 2-URL
// add (docs/claude-desktop-add-prompts.md): prefer the two titles' shared
// lead-in before a separator (e.g. "Gouldsboro - Schoodic East" /
// "Gouldsboro - Harbor House" share "Gouldsboro"), otherwise just combine
// both titles — always just a starting suggestion, the field stays editable.
function deriveGroupLabel(titleA, titleB) {
  const a = (titleA || "").trim();
  const b = (titleB || "").trim();
  if (!a || !b) return a || b || "";
  const lead = (t) => t.split(/\s*[-:|]\s*/)[0].trim();
  const aLead = lead(a);
  const bLead = lead(b);
  if (aLead && aLead.toLowerCase() === bLead.toLowerCase()) return aLead;
  return `${a} / ${b}`;
}

export default function AddEntryForm({ trip, section, onAdded, authToken = null }) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | loading | editing | duplicate | picking | saving | error
  const [fields, setFields] = useState(CORE_INITIAL);
  const [data, setData] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [cookieWarning, setCookieWarning] = useState(null);
  const [duplicate, setDuplicate] = useState(null);
  const [placeResults, setPlaceResults] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState("");

  // Pairing a second link into this same "2-item option" — the manual-input
  // equivalent of the AI agent's paired-URL add (both entries get the same
  // groupLabel; groupUnits.js renders any two entries sharing one as a
  // single card/map/rank).
  const [pairUrl, setPairUrl] = useState("");
  const [pairPhase, setPairPhase] = useState("none"); // none | input | loading | ready
  const [pairFields, setPairFields] = useState(CORE_INITIAL);
  const [pairData, setPairData] = useState({});
  const [pairWarnings, setPairWarnings] = useState([]);
  const [pairCookieWarning, setPairCookieWarning] = useState(null);
  const [pairError, setPairError] = useState("");

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
    setCookieWarning(null);
    setDuplicate(null);
    setPlaceResults([]);
    setAddress("");
    setGeocodeMsg("");
    setErrorMsg("");
    cancelPair();
  }

  function cancelPair() {
    setPairUrl("");
    setPairPhase("none");
    setPairFields(CORE_INITIAL);
    setPairData({});
    setPairWarnings([]);
    setPairCookieWarning(null);
    setPairError("");
  }

  async function handlePairPreview(e) {
    e.preventDefault();
    const raw = pairUrl.trim();
    if (!raw) return;
    setPairPhase("loading");
    setPairError("");
    try {
      const res = await fetch(`${apiBase}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ url: raw }),
      });
      const resData = await res.json();
      if (!res.ok) {
        setPairError(resData.error || "Something went wrong.");
        setPairPhase("input");
        return;
      }
      if (resData.duplicate) {
        setPairError(`Already on the list as "${resData.existing.title}" — pick a different second link.`);
        setPairPhase("input");
        return;
      }
      const s = resData.scraped;
      setPairFields({
        ...CORE_INITIAL,
        title: s.title || "",
        posterImage: s.posterImage || "",
        lat: s.lat ?? "",
        lng: s.lng ?? "",
      });
      setPairData(initialData());
      setPairWarnings(s.warnings || []);
      setPairCookieWarning(s.cookieWarning || null);
      setPairPhase("ready");
      // Suggest a shared label now that both titles are known — leaves it
      // alone if the admin already typed one in themselves.
      setFields((f) => (f.groupLabel.trim() ? f : { ...f, groupLabel: deriveGroupLabel(f.title, s.title || "") }));
    } catch (err) {
      setPairError(err.message);
      setPairPhase("input");
    }
  }

  async function handlePreview(e) {
    e.preventDefault();
    const raw = url.trim();
    if (!raw) return;
    setPhase("loading");
    setErrorMsg("");

    const isGoogleUrl = isGoogleMapsShareUrl(raw) || isGoogleSearchUrl(raw) || isGoogleMapsUrl(raw);

    // A real listing link (Airbnb/VRBO/generic OG tags) — unchanged.
    if (isPlainUrl(raw) && !isGoogleUrl) {
      try {
        const res = await fetch(`${apiBase}/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ url: raw }),
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
          description: s.description || "",
          lat: s.lat ?? "",
          lng: s.lng ?? "",
        });
        setData(initialData());
        setWarnings(s.warnings || []);
        setCookieWarning(s.cookieWarning || null);
        setPhase("editing");
      } catch (err) {
        setErrorMsg(err.message);
        setPhase("idle");
      }
      return;
    }

    // A Google Maps/share/search link, or just typed text (e.g. "Eventide
    // Oyster Co.") — location links like these carry no OpenGraph data for
    // the scraper above to find, so search Places instead and let the
    // visitor pick the right result.
    try {
      let query = raw;
      if (isGoogleSearchUrl(raw)) {
        query = extractGoogleSearchQuery(raw) || raw;
      } else if (isGoogleMapsShareUrl(raw)) {
        const res = await fetch("/api/resolve-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: raw }),
        });
        const resolveData = await res.json();
        if (!res.ok) throw new Error(resolveData.error || "Couldn't resolve that link");
        query = parseGoogleMapsUrl(resolveData.resolvedUrl).name || resolveData.resolvedUrl;
      } else if (isGoogleMapsUrl(raw)) {
        query = parseGoogleMapsUrl(raw).name || raw;
      }

      const results = await searchPlacesByText(query);
      if (results.length === 0) {
        setErrorMsg("No matching places found — try a more specific search, or paste the listing's direct link.");
        setPhase("idle");
        return;
      }
      setPlaceResults(results);
      setPhase("picking");
    } catch (err) {
      setErrorMsg(err.message);
      setPhase("idle");
    }
  }

  function choosePlace(place) {
    setFields({
      ...CORE_INITIAL,
      title: place.title || "",
      posterImage: place.photoUrl || "",
      // Prefer Google's own editorial blurb when it has one — a real
      // description reads far better here than a bare street address,
      // which still isn't lost: it's what the map/"open in Google Maps"
      // link is built from regardless of what description ends up as.
      description: place.summary || place.address || "",
      lat: place.lat ?? "",
      lng: place.lng ?? "",
    });
    setUrl(place.website || place.mapsUrl || url);
    setData(initialData());
    setWarnings([]);
    setCookieWarning(null);
    setPlaceResults([]);
    setPhase("editing");
  }

  async function postEntry(entryUrl, entryFields, entryData, groupLabel) {
    const res = await fetch(apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ url: entryUrl, ...entryFields, groupLabel, data: entryData }),
    });
    const resData = await res.json();
    return { ok: res.ok, status: res.status, data: resData };
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!fields.title.trim()) {
      setErrorMsg("Title is required.");
      return;
    }
    const paired = pairPhase === "ready";
    if (paired && !pairFields.title.trim()) {
      setErrorMsg("The second link's title is required.");
      return;
    }
    setPhase("saving");
    setErrorMsg("");
    const groupLabel =
      fields.groupLabel.trim() || (paired ? deriveGroupLabel(fields.title, pairFields.title) : "") || null;
    try {
      const r1 = await postEntry(url, fields, data, groupLabel);
      let entry1 = null;
      if (r1.ok) {
        entry1 = r1.data.entry;
        onAdded(entry1);
      } else if (r1.data.error === "duplicate") {
        if (paired) {
          // Already saved from an earlier attempt at this same pairing
          // (e.g. the second link failed last time) — treat as done, not
          // an error, so retrying doesn't add the first link twice.
          entry1 = r1.data.existing;
        } else {
          setDuplicate(r1.data.existing);
          setPhase("duplicate");
          return;
        }
      } else {
        setErrorMsg(r1.data.error || "Something went wrong.");
        setPhase("editing");
        return;
      }

      if (!paired) {
        reset();
        return;
      }

      const r2 = await postEntry(pairUrl, pairFields, pairData, groupLabel);
      if (r2.ok) {
        onAdded(r2.data.entry);
        reset();
      } else if (r2.status === 409 && r2.data.error === "duplicate") {
        onAdded(r2.data.existing);
        reset();
      } else {
        // The first link is already saved (or was already saved) — keep the
        // pair sub-form open with what was entered so fixing and re-saving
        // doesn't add the first link twice.
        setFields((f) => ({ ...f, groupLabel }));
        setErrorMsg(
          `Saved "${entry1.title}" — but the second link failed: ${
            r2.data.error || "Something went wrong."
          } Fix it below and save again.`
        );
        setPhase("editing");
      }
    } catch (err) {
      setErrorMsg(err.message);
      setPhase("editing");
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm">
      {phase === "idle" || phase === "loading" ? (
        <form onSubmit={handlePreview} className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
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
          </div>
          <p className="text-xs text-zinc-500">
            A listing link, a full Google Maps link, or just type a name (e.g. &quot;Eventide Oyster
            Co.&quot;) all work. A share.google link usually can&apos;t be read automatically — type
            the name instead if it doesn&apos;t work.
          </p>
        </form>
      ) : null}

      {errorMsg && <p className="text-sm text-red-600 mt-2">{errorMsg}</p>}

      {phase === "picking" && placeResults.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-sm text-zinc-600">Select the right place:</p>
          {placeResults.map((place) => (
            <button
              key={place.id}
              type="button"
              onClick={() => choosePlace(place)}
              className="text-left rounded-lg border border-zinc-200 hover:border-blue-400 hover:bg-blue-50/40 p-2 flex gap-3 items-center"
            >
              {place.photoUrl ? (
                <img
                  src={place.photoUrl}
                  alt=""
                  className="w-12 h-12 object-cover rounded shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-zinc-100 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium text-zinc-900 truncate">{place.title}</div>
                <div className="text-xs text-zinc-500 truncate">{place.address}</div>
              </div>
            </button>
          ))}
          <button type="button" onClick={reset} className="text-sm text-zinc-500 hover:underline self-start">
            None of these — cancel
          </button>
        </div>
      )}

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
          {cookieWarning && (
            <p className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded p-2">
              {cookieWarning}
            </p>
          )}
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
            {section.supports_pairing && (
            <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-zinc-700">
                  Pair with a second link (2-item option)
                </h3>
                {pairPhase === "none" ? (
                  <button
                    type="button"
                    onClick={() => setPairPhase("input")}
                    className="text-sm text-blue-600 hover:underline shrink-0"
                  >
                    + Add another
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={cancelPair}
                    className="text-sm text-zinc-500 hover:underline shrink-0"
                  >
                    Remove
                  </button>
                )}
              </div>

              {pairPhase === "input" || pairPhase === "loading" ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Paste the second link..."
                    value={pairUrl}
                    onChange={(e) => setPairUrl(e.target.value)}
                    className="flex-1 rounded border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handlePairPreview}
                    disabled={pairPhase === "loading" || !pairUrl.trim()}
                    className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                  >
                    {pairPhase === "loading" ? "Fetching..." : "Fetch"}
                  </button>
                </div>
              ) : null}
              {pairError && <p className="text-xs text-red-600">{pairError}</p>}

              {pairPhase === "ready" && (
                <div className="flex flex-col gap-2">
                  {pairCookieWarning && (
                    <p className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded p-2">
                      {pairCookieWarning}
                    </p>
                  )}
                  {pairWarnings.length > 0 && (
                    <ul className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 list-disc pl-5">
                      {pairWarnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                  <div className="grid sm:grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-sm">
                      Title
                      <input
                        required
                        value={pairFields.title}
                        onChange={(e) => setPairFields({ ...pairFields, title: e.target.value })}
                        className="rounded border border-zinc-300 px-2 py-1.5"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Photo URL
                      <input
                        value={pairFields.posterImage}
                        onChange={(e) => setPairFields({ ...pairFields, posterImage: e.target.value })}
                        className="rounded border border-zinc-300 px-2 py-1.5"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Latitude
                      <input
                        value={pairFields.lat}
                        onChange={(e) => setPairFields({ ...pairFields, lat: e.target.value })}
                        className="rounded border border-zinc-300 px-2 py-1.5"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Longitude
                      <input
                        value={pairFields.lng}
                        onChange={(e) => setPairFields({ ...pairFields, lng: e.target.value })}
                        className="rounded border border-zinc-300 px-2 py-1.5"
                      />
                    </label>
                    {fieldDefs.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                        {fieldDefs.map((f) => (
                          <FieldInput
                            key={f.key}
                            fieldDef={f}
                            value={pairData[f.key]}
                            onChange={(v) => setPairData({ ...pairData, [f.key]: v })}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500">
                    Notes, concerns, and description can be added to this one afterward via its own
                    &quot;Edit details.&quot;
                  </p>
                </div>
              )}

              <label className="flex flex-col gap-1 text-sm">
                Group label{pairPhase === "ready" ? "" : " (optional — only if this is a 2-item option)"}
                <input
                  value={fields.groupLabel}
                  onChange={(e) => setFields({ ...fields, groupLabel: e.target.value })}
                  placeholder='e.g. "Jonesport - 2 House Option" (use the exact same text on both)'
                  className="rounded border border-zinc-300 px-2 py-1.5"
                />
              </label>
            </div>
            )}
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
