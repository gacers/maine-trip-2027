"use client";

import { useState, type FormEvent } from "react";
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
import FieldInput from "@/components/FieldInput";
import type { PublicTrip, Section, ClientEntry, PlaceResult } from "@/lib/types";
import styles from "./AddEntryForm.module.css";

interface CoreFields {
  title: string;
  posterImage: string;
  description: string;
  lat: string | number;
  lng: string | number;
  notes: string;
  concerns: string;
  groupLabel: string;
}

const CORE_INITIAL: CoreFields = {
  title: "",
  posterImage: "",
  description: "",
  lat: "",
  lng: "",
  notes: "",
  concerns: "",
  groupLabel: "",
};

type Phase = "idle" | "loading" | "editing" | "duplicate" | "picking" | "saving";
type PairPhase = "none" | "input" | "loading" | "ready";

// Mirrors the guidance Claude Desktop already follows for a paired 2-URL
// add (docs/claude-desktop-add-prompts.md): prefer the two titles' shared
// lead-in before a separator (e.g. "Gouldsboro - Schoodic East" /
// "Gouldsboro - Harbor House" share "Gouldsboro"), otherwise just combine
// both titles — always just a starting suggestion, the field stays editable.
function deriveGroupLabel(titleA: string, titleB: string): string {
  const a = (titleA || "").trim();
  const b = (titleB || "").trim();
  if (!a || !b) return a || b || "";
  const lead = (t: string) => t.split(/\s*[-:|]\s*/)[0].trim();
  const aLead = lead(a);
  const bLead = lead(b);
  if (aLead && aLead.toLowerCase() === bLead.toLowerCase()) return aLead;
  return `${a} / ${b}`;
}

export interface AddEntryFormProps {
  trip: PublicTrip;
  section: Section;
  /** This section's own nav group slug — a section's slug is only
   * unique within its group (see migration 0014), so the entries API
   * path needs both. */
  navGroupSlug: string;
  onAdded: (entry: ClientEntry) => void;
  authToken?: string | null;
  /** Skip this form's own card framing (border/shadow/padding) — used
   * when it's already inside its own container, e.g. AddEntryDialog's
   * modal, where a card-in-a-card would just double up the chrome. */
  bare?: boolean;
  /** Seeds (and re-seeds, across every fields reset below) the Group
   * label field — used by PairEntryDialog to pair a brand-new listing
   * with an already-saved entry: whatever gets added here shares that
   * entry's own groupLabel, so the two pair up automatically the same
   * way any two entries sharing a groupLabel do (lib/groupUnits.ts).
   * Still just a plain editable field, not locked. */
  presetGroupLabel?: string;
}

export default function AddEntryForm({
  trip,
  section,
  navGroupSlug,
  onAdded,
  authToken = null,
  bare = false,
  presetGroupLabel = "",
}: AddEntryFormProps) {
  // A fresh CORE_INITIAL, except carrying presetGroupLabel forward —
  // every place below that resets `fields` back to a blank slate
  // (initial mount, a successful preview fetch, Cancel) uses this
  // instead of the bare constant, so pairing survives all of them.
  function initialCoreFields(): CoreFields {
    return { ...CORE_INITIAL, groupLabel: presetGroupLabel };
  }

  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [fields, setFields] = useState<CoreFields>(initialCoreFields);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [cookieWarning, setCookieWarning] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<ClientEntry | null>(null);
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState("");

  // Pairing a second link into this same "2-item option" — the manual-input
  // equivalent of the AI agent's paired-URL add (both entries get the same
  // groupLabel; groupUnits.ts renders any two entries sharing one as a
  // single card/map/rank).
  const [pairUrl, setPairUrl] = useState("");
  const [pairPhase, setPairPhase] = useState<PairPhase>("none");
  const [pairFields, setPairFields] = useState<CoreFields>(CORE_INITIAL);
  const [pairData, setPairData] = useState<Record<string, unknown>>({});
  const [pairWarnings, setPairWarnings] = useState<string[]>([]);
  const [pairCookieWarning, setPairCookieWarning] = useState<string | null>(null);
  const [pairError, setPairError] = useState("");

  const fieldDefs = section.field_defs || [];
  const apiBase = `/api/trips/${trip.slug}/sections/${navGroupSlug}/${section.slug}/entries`;
  const authHeaders: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};

  function initialData() {
    const d: Record<string, unknown> = {};
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
      setGeocodeMsg((err as Error).message);
    } finally {
      setGeocoding(false);
    }
  }

  function reset() {
    setUrl("");
    setPhase("idle");
    setFields(initialCoreFields());
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

  // Skips the URL/scrape step entirely — jumps straight to the same
  // manual-entry fields a failed/partial scrape would leave you with,
  // for something that was never a URL to begin with (a place you're
  // adding purely from memory, or one you'd rather just type in by
  // hand). Uses this section's own field_defs the same as everything
  // else here, so there's nothing section-specific to wire up.
  function startBlank() {
    setUrl("");
    setFields(initialCoreFields());
    setData(initialData());
    setWarnings([]);
    setCookieWarning(null);
    setErrorMsg("");
    setPhase("editing");
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

  async function handlePairPreview(e: FormEvent) {
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
      setPairError((err as Error).message);
      setPairPhase("input");
    }
  }

  async function handlePreview(e: FormEvent) {
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
          ...initialCoreFields(),
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
        setErrorMsg((err as Error).message);
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
      setErrorMsg((err as Error).message);
      setPhase("idle");
    }
  }

  function choosePlace(place: PlaceResult) {
    setFields({
      ...initialCoreFields(),
      title: place.title || "",
      posterImage: place.photoUrl || "",
      // Prefer Google's own editorial blurb, then fall back to a short
      // category ("Seafood restaurant") derived from its place types —
      // never the street address, which isn't lost either way: it's
      // what the map/"open in Google Maps" link is built from regardless
      // of what description ends up as, and EntryCard shows it as its
      // own address line, not as the description.
      description: place.summary || place.category || "",
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

  async function postEntry(entryUrl: string, entryFields: CoreFields, entryData: Record<string, unknown>, groupLabel: string | null) {
    const res = await fetch(apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ url: entryUrl, ...entryFields, groupLabel, data: entryData }),
    });
    const resData = await res.json();
    return { ok: res.ok, status: res.status, data: resData };
  }

  async function handleSave(e: FormEvent) {
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
      let entry1: ClientEntry | null = null;
      if (r1.ok) {
        entry1 = r1.data.entry;
        onAdded(entry1!);
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
        setFields((f) => ({ ...f, groupLabel: groupLabel || "" }));
        setErrorMsg(
          `Saved "${entry1!.title}" — but the second link failed: ${
            r2.data.error || "Something went wrong."
          } Fix it below and save again.`
        );
        setPhase("editing");
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
      setPhase("editing");
    }
  }

  return (
    <div className={bare ? undefined : styles.card}>
      {phase === "idle" || phase === "loading" ? (
        <form onSubmit={handlePreview} className={styles.urlForm}>
          <div className={styles.urlRow}>
            <input
              type="text"
              required
              placeholder={section.add_placeholder ?? undefined}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={styles.urlInput}
            />
            <button type="submit" disabled={phase === "loading"} className={styles.primaryButton}>
              {phase === "loading" ? "Fetching..." : "Add"}
            </button>
          </div>
          <p className={styles.urlHint}>
            A listing link, a full Google Maps link, or just type a name (e.g. &quot;Eventide Oyster Co.&quot;) all
            work. A share.google link usually can&apos;t be read automatically — type the name instead if it
            doesn&apos;t work.
          </p>
          {phase === "idle" && (
            <button type="button" onClick={startBlank} className={styles.startBlankButton}>
              Or start with a blank entry instead
            </button>
          )}
        </form>
      ) : null}

      {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}

      {phase === "picking" && placeResults.length > 0 && (
        <div className={styles.pickingList}>
          <p className={styles.pickingHint}>Select the right place:</p>
          {placeResults.map((place) => (
            <button key={place.id} type="button" onClick={() => choosePlace(place)} className={styles.placeButton}>
              {place.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={place.photoUrl} alt="" className={styles.placePhoto} />
              ) : (
                <div className={styles.placePhotoFallback} />
              )}
              <div className={styles.placeInfo}>
                <div className={styles.placeTitle}>{place.title}</div>
                <div className={styles.placeAddress}>{place.address}</div>
              </div>
            </button>
          ))}
          <button type="button" onClick={reset} className={styles.cancelPickingButton}>
            None of these — cancel
          </button>
        </div>
      )}

      {phase === "duplicate" && duplicate && (
        <div className={styles.duplicateNotice}>
          Already on the list:{" "}
          <a href={`#listing-${duplicate.id}`} className={styles.duplicateLink}>
            {duplicate.title}
          </a>
          .
          <button onClick={reset} className={styles.duplicateResetButton}>
            Add a different one
          </button>
        </div>
      )}

      {phase === "editing" || phase === "saving" ? (
        <form onSubmit={handleSave} className={styles.editForm}>
          {cookieWarning && <p className={styles.cookieWarning}>{cookieWarning}</p>}
          {warnings.length > 0 && (
            <ul className={styles.warningsList}>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          <div className={styles.grid}>
            <label className={styles.field}>
              Title
              <input
                required
                value={fields.title}
                onChange={(e) => setFields({ ...fields, title: e.target.value })}
                className={styles.input}
              />
            </label>
            <label className={styles.wideField}>
              Photo URL
              <input
                value={fields.posterImage}
                onChange={(e) => setFields({ ...fields, posterImage: e.target.value })}
                className={styles.input}
              />
            </label>
            <label className={styles.wideField}>
              Description (one bullet per line, optional)
              <textarea
                value={fields.description}
                onChange={(e) => setFields({ ...fields, description: e.target.value })}
                rows={3}
                className={styles.input}
              />
            </label>

            {fieldDefs.length > 0 && (
              <div className={styles.fieldDefsGrid}>
                {fieldDefs.map((f) => (
                  <FieldInput key={f.key} fieldDef={f} value={data[f.key]} onChange={(v) => setData({ ...data, [f.key]: v })} />
                ))}
                {fieldDefs.some((f) => f.field_type === "count") && (
                  <p className={styles.countHint}>Leave count fields blank to auto-fill from the description.</p>
                )}
              </div>
            )}

            <label className={styles.field}>
              Latitude
              <input
                value={fields.lat}
                onChange={(e) => setFields({ ...fields, lat: e.target.value })}
                className={styles.input}
              />
            </label>
            <label className={styles.field}>
              Longitude
              <input
                value={fields.lng}
                onChange={(e) => setFields({ ...fields, lng: e.target.value })}
                className={styles.input}
              />
            </label>
            <div className={styles.wideField}>
              <label>Or find lat/lng from an address</label>
              <div className={styles.geocodeRow}>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 129 State Route 32, New Harbor, ME"
                  className={styles.geocodeInput}
                />
                <button type="button" onClick={handleFindCoords} disabled={geocoding || !address.trim()} className={styles.findButton}>
                  {geocoding ? "Finding..." : "Find"}
                </button>
              </div>
              {geocodeMsg && <p className={styles.geocodeMsg}>{geocodeMsg}</p>}
            </div>
            <label className={styles.wideField}>
              Notes
              <textarea
                value={fields.notes}
                onChange={(e) => setFields({ ...fields, notes: e.target.value })}
                rows={2}
                className={styles.input}
              />
            </label>
            <label className={styles.wideField}>
              Concerns (optional)
              <textarea
                value={fields.concerns}
                onChange={(e) => setFields({ ...fields, concerns: e.target.value })}
                rows={2}
                className={styles.input}
              />
            </label>
            {section.supports_pairing && (
              <div className={styles.pairBox}>
                <div className={styles.pairHeader}>
                  <h3 className={styles.pairTitle}>Pair with a second link (2-item option)</h3>
                  {pairPhase === "none" ? (
                    <button type="button" onClick={() => setPairPhase("input")} className={styles.pairToggleButtonAdd}>
                      + Add another
                    </button>
                  ) : (
                    <button type="button" onClick={cancelPair} className={styles.pairToggleButtonRemove}>
                      Remove
                    </button>
                  )}
                </div>

                {pairPhase === "input" || pairPhase === "loading" ? (
                  <div className={styles.pairUrlRow}>
                    <input
                      type="text"
                      placeholder="Paste the second link..."
                      value={pairUrl}
                      onChange={(e) => setPairUrl(e.target.value)}
                      className={styles.pairUrlInput}
                    />
                    <button
                      type="button"
                      onClick={handlePairPreview}
                      disabled={pairPhase === "loading" || !pairUrl.trim()}
                      className={styles.pairFetchButton}
                    >
                      {pairPhase === "loading" ? "Fetching..." : "Fetch"}
                    </button>
                  </div>
                ) : null}
                {pairError && <p className={styles.pairError}>{pairError}</p>}

                {pairPhase === "ready" && (
                  <div className={styles.pairReadyBox}>
                    {pairCookieWarning && <p className={styles.cookieWarning}>{pairCookieWarning}</p>}
                    {pairWarnings.length > 0 && (
                      <ul className={styles.warningsList}>
                        {pairWarnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    )}
                    <div className={styles.pairGrid}>
                      <label className={styles.field}>
                        Title
                        <input
                          required
                          value={pairFields.title}
                          onChange={(e) => setPairFields({ ...pairFields, title: e.target.value })}
                          className={styles.input}
                        />
                      </label>
                      <label className={styles.field}>
                        Photo URL
                        <input
                          value={pairFields.posterImage}
                          onChange={(e) => setPairFields({ ...pairFields, posterImage: e.target.value })}
                          className={styles.input}
                        />
                      </label>
                      <label className={styles.field}>
                        Latitude
                        <input
                          value={pairFields.lat}
                          onChange={(e) => setPairFields({ ...pairFields, lat: e.target.value })}
                          className={styles.input}
                        />
                      </label>
                      <label className={styles.field}>
                        Longitude
                        <input
                          value={pairFields.lng}
                          onChange={(e) => setPairFields({ ...pairFields, lng: e.target.value })}
                          className={styles.input}
                        />
                      </label>
                      {fieldDefs.length > 0 && (
                        <div className={styles.pairFieldDefsGrid}>
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
                    <p className={styles.pairEditHint}>
                      Notes, concerns, and description can be added to this one afterward via its own &quot;Edit
                      details.&quot;
                    </p>
                  </div>
                )}

                <label className={styles.field}>
                  Group label
                  {pairPhase === "ready" || presetGroupLabel ? "" : " (optional — only if this is a 2-item option)"}
                  <input
                    value={fields.groupLabel}
                    onChange={(e) => setFields({ ...fields, groupLabel: e.target.value })}
                    placeholder='e.g. "Jonesport - 2 House Option" (use the exact same text on both)'
                    className={styles.input}
                  />
                </label>
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <button type="submit" disabled={phase === "saving"} className={styles.primaryButton}>
              {phase === "saving" ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={reset} className={styles.cancelButton}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
