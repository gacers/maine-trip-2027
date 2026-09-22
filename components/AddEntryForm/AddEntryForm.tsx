"use client";

import { useEffect, useState, type FormEvent } from "react";
import { fetchForwardGeocode } from "@/lib/geocodeClient";
import { searchPlacesByText } from "@/lib/googlePlaces";
import {
  isPlainUrl,
  isGoogleMapsShareUrl,
  isGoogleSearchUrl,
  isGoogleMapsUrl,
  extractGoogleSearchQuery,
  parseGoogleMapsUrl,
} from "@/lib/googleUrlHelpers";
import { computeTripNights } from "@/lib/fieldTypes/price";
import UrlEntryForm from "./UrlEntryForm";
import PlacePicker from "@/components/PlacePicker";
import DuplicateNotice from "./DuplicateNotice";
import CoreFieldsGrid, { type CoreFields } from "./CoreFieldsGrid";
import PairFieldsBox, { type PairPhase } from "./PairFieldsBox";
import type { PublicTrip, Section, ClientEntry, PlaceResult, TitleMatch } from "@/lib/types";
import styles from "./AddEntryForm.module.css";

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
  /** Fires once per entry actually saved — twice for a paired add, in
   * the order they're posted. Purely additive (e.g. append to a list);
   * a caller that also wants to know when the *whole* submission is
   * finished (a paired add is two of these) should use onSaveComplete
   * instead, not this — see its own doc comment for why. */
  onAdded: (entry: ClientEntry) => void;
  /** Fires exactly once, after every entry in this submission (one for
   * a solo add, two for a paired one) has actually been saved — right
   * before this form resets itself back to blank. AddEntryDialog uses
   * this (not onAdded) to decide when to close itself: closing on the
   * first onAdded of a paired add unmounts this form (Radix Dialog
   * content unmounts while closed) mid-save, silently dropping the
   * second entry — confirmed live, not a hypothetical. */
  onSaveComplete?: () => void;
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
  /** Offers "Pair with a new second property" on the duplicate notice
   * below, instead of just "Add a different one" — for the exact
   * situation that notice exists for: you're trying to add a house
   * that's already on the list because you actually want to use it in
   * a *different* pairing too. Reuses the existing entry (see
   * PairEntryDialog) rather than creating a second, duplicate row for
   * the same house. Omit to just get the plain reset button (e.g.
   * PairEntryDialog itself doesn't need this — it's already the
   * pairing flow). */
  onRequestPairExisting?: (entry: ClientEntry) => void;
  /** Gates AddFieldSelect's own "+ Add existing/new field..." control —
   * a schema-level change to this section, same admin-only bar
   * FieldDefsEditor/EntryEditForm's own copy of this control already
   * holds to. Contributors get everything else this form can do. */
  canManage?: boolean;
}

export default function AddEntryForm({
  trip,
  section,
  navGroupSlug,
  onAdded,
  canManage = false,
  onSaveComplete,
  authToken = null,
  bare = false,
  presetGroupLabel = "",
  onRequestPairExisting,
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
  // Set when the preview route (or the title-match dropdown, via
  // pickTitleMatch) found this same real place already documented
  // elsewhere — shown as a small note, and reusedEntryId (below) is
  // what actually makes the new entry a live reference to it (see
  // postEntry) rather than an independent copy.
  const [reusedFrom, setReusedFrom] = useState<{ tripName: string; sectionLabel: string } | null>(null);
  // The matched entry's own id — shared fields lock to it (disabled in
  // CoreFieldsGrid below) since they're about to be overridden by
  // whatever's actually stored there anyway; notes/concerns stay
  // editable, the one thing genuinely local to this trip.
  const [reusedEntryId, setReusedEntryId] = useState<string | null>(null);
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState("");

  // Live "already on another trip?" suggestions as you type into the
  // idle-phase input — see lib/entries.ts's searchEntriesByTitle. Set
  // back to [] on every keystroke change of `url` (below) rather than
  // only on a successful fetch, so a fast typist never sees a dropdown
  // that's actually answering an already-stale, shorter query.
  const [titleMatches, setTitleMatches] = useState<TitleMatch[]>([]);

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
  const tripNights = computeTripNights(trip);
  const apiBase = `/api/trips/${trip.slug}/sections/${navGroupSlug}/${section.slug}/entries`;
  const authHeaders: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};

  function initialData() {
    const d: Record<string, unknown> = {};
    fieldDefs.forEach((f) => {
      d[f.key] = "";
    });
    return d;
  }

  // Debounced live search of every trip's existing entries by title —
  // only while still on the idle "paste a link or type a name" step,
  // and only for actual typed text, not something that already looks
  // like a URL (pasting a link means the visitor already knows exactly
  // what they're adding; searching a raw URL string against titles
  // would never match anything anyway).
  useEffect(() => {
    const q = url.trim();
    const shouldSearch = phase === "idle" && q.length >= 2 && !isPlainUrl(q);
    let cancelled = false;
    // Not-yet-searchable input still clears any stale list from before
    // — deferred into the same timer-callback shape as the real fetch
    // below (rather than called straight from the effect body) so a
    // fast typist backspacing through a query doesn't cascade a render
    // per keystroke.
    if (!shouldSearch) {
      const timer = setTimeout(() => setTitleMatches([]), 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${apiBase}/search?q=${encodeURIComponent(q)}`, { headers: authHeaders });
        const resData = await res.json();
        if (!cancelled && res.ok) setTitleMatches(resData.matches || []);
      } catch {
        // Best-effort — a failed suggestion lookup shouldn't block typing.
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, phase]);

  // Same idea as choosePlace below (a Google Places pick) — pre-fills
  // from an already-documented entry instead of scraping/typing from
  // scratch, then hands off to the same reused-details notice the
  // URL-paste flow's own findEntryByUrlAnywhere match shows.
  function pickTitleMatch(match: TitleMatch) {
    setFields({
      ...initialCoreFields(),
      title: match.title,
      description: match.description || "",
      posterImage: match.posterImage || "",
      lat: match.lat ?? "",
      lng: match.lng ?? "",
    });
    setUrl(match.url || "");
    setData(initialData());
    setWarnings([]);
    setCookieWarning(null);
    setReusedFrom({ tripName: match.tripName, sectionLabel: match.sectionLabel });
    setReusedEntryId(match.id);
    setTitleMatches([]);
    setPhase("editing");
  }

  async function handleFindCoords() {
    if (!address.trim()) return;
    setGeocoding(true);
    setGeocodeMsg("");
    try {
      const { lat, lng, formattedAddress } = await fetchForwardGeocode(trip.slug, address, authToken);
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
    setReusedFrom(null);
    setReusedEntryId(null);
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
    setReusedFrom(null);
    setReusedEntryId(null);
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

  // The actual fetch, split out of handlePairPreview so handleSave can
  // also run it — the small "Fetch" button next to the second link is
  // easy to miss; typing a second URL and going straight to Save
  // shouldn't just silently drop it. Updates the pair state either way
  // (so the form reflects it, and a later "fix and save again" — see
  // handleSave's own postEntry failure path — starts from the right
  // place), and returns the fetched fields/data directly, since a
  // caller that just triggered this itself can't rely on state having
  // already re-rendered by the time it needs them.
  async function fetchPairPreview(
    raw: string
  ): Promise<{ ok: true; fields: CoreFields; data: Record<string, unknown> } | { ok: false; message: string }> {
    try {
      const res = await fetch(`${apiBase}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ url: raw }),
      });
      const resData = await res.json();
      if (!res.ok) {
        return { ok: false, message: resData.error || "Something went wrong." };
      }
      if (resData.duplicate) {
        return { ok: false, message: `Already on the list as "${resData.existing.title}" — pick a different second link.` };
      }
      const s = resData.scraped;
      const newFields: CoreFields = {
        ...CORE_INITIAL,
        title: s.title || "",
        posterImage: s.posterImage || "",
        lat: s.lat ?? "",
        lng: s.lng ?? "",
      };
      const newData = initialData();
      setPairFields(newFields);
      setPairData(newData);
      setPairWarnings(s.warnings || []);
      setPairCookieWarning(s.cookieWarning || null);
      setPairPhase("ready");
      // Suggest a shared label now that both titles are known — leaves it
      // alone if the admin already typed one in themselves.
      setFields((f) => (f.groupLabel.trim() ? f : { ...f, groupLabel: deriveGroupLabel(f.title, s.title || "") }));
      return { ok: true, fields: newFields, data: newData };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }

  async function handlePairPreview() {
    const raw = pairUrl.trim();
    if (!raw) return;
    setPairPhase("loading");
    setPairError("");
    const result = await fetchPairPreview(raw);
    if (!result.ok) {
      setPairError(result.message);
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
        setReusedFrom(resData.reusedFrom ? { tripName: resData.reusedFrom.tripName, sectionLabel: resData.reusedFrom.sectionLabel } : null);
        setReusedEntryId(resData.reusedFrom?.entryId || null);
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
    setReusedFrom(null);
    setReusedEntryId(null);
    setPlaceResults([]);
    setPhase("editing");
  }

  // importSourceEntryId is only ever the PRIMARY listing's own match
  // (reusedEntryId, from this same form's url/title-match flow) — the
  // pair's own second listing has no reuse-detection of its own yet,
  // so its own postEntry call must never inherit the primary's.
  async function postEntry(
    entryUrl: string,
    entryFields: CoreFields,
    entryData: Record<string, unknown>,
    groupLabel: string | null,
    importSourceEntryId: string | null = null
  ) {
    const res = await fetch(apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ url: entryUrl, ...entryFields, groupLabel, data: entryData, importSourceEntryId }),
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

    let paired = pairPhase === "ready";
    let pairFieldsToSave = pairFields;
    let pairDataToSave = pairData;
    // A second link typed in but never actually fetched (that "Fetch"
    // button is small and easy to miss) — auto-fetch it now rather
    // than silently dropping it, same as clicking Fetch yourself.
    // Whatever comes back can still be edited afterward either way.
    if (pairPhase === "input" && pairUrl.trim()) {
      setPhase("saving");
      const result = await fetchPairPreview(pairUrl.trim());
      if (!result.ok) {
        setPairError(result.message);
        setPairPhase("input");
        setPhase("editing");
        return;
      }
      paired = true;
      pairFieldsToSave = result.fields;
      pairDataToSave = result.data;
    }

    if (paired && !pairFieldsToSave.title.trim()) {
      setErrorMsg("The second link's title is required.");
      return;
    }
    setPhase("saving");
    setErrorMsg("");
    const groupLabel =
      fields.groupLabel.trim() || (paired ? deriveGroupLabel(fields.title, pairFieldsToSave.title) : "") || null;
    try {
      const r1 = await postEntry(url, fields, data, groupLabel, reusedEntryId);
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
        onSaveComplete?.();
        reset();
        return;
      }

      const r2 = await postEntry(pairUrl, pairFieldsToSave, pairDataToSave, groupLabel);
      if (r2.ok) {
        onAdded(r2.data.entry);
        onSaveComplete?.();
        reset();
      } else if (r2.status === 409 && r2.data.error === "duplicate") {
        onAdded(r2.data.existing);
        onSaveComplete?.();
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
    <div className={bare ? undefined : styles["card"]}>
      {(phase === "idle" || phase === "loading") && (
        <UrlEntryForm
          url={url}
          onUrlChange={setUrl}
          loading={phase === "loading"}
          placeholder={section.add_placeholder}
          onSubmit={handlePreview}
          onStartBlank={startBlank}
          titleMatches={titleMatches}
          onPickTitleMatch={pickTitleMatch}
        />
      )}

      {errorMsg && <p className={styles["error-msg"]}>{errorMsg}</p>}

      {phase === "picking" && placeResults.length > 0 && <PlacePicker places={placeResults} onChoose={choosePlace} onCancel={reset} />}

      {phase === "duplicate" && duplicate && (
        <DuplicateNotice duplicate={duplicate} onRequestPairExisting={onRequestPairExisting} onReset={reset} />
      )}

      {(phase === "editing" || phase === "saving") && (
        <form onSubmit={handleSave} className={styles["edit-form"]}>
          {reusedFrom && (
            <p className={styles["reused-notice"]}>
              Linked to the same place already documented in &quot;{reusedFrom.sectionLabel}&quot; in{" "}
              {reusedFrom.tripName} — shared details stay in sync automatically; notes
              {section.supports_concerns ? "/concerns" : ""} below are yours to add.
            </p>
          )}
          {cookieWarning && <p className={styles["cookie-warning"]}>{cookieWarning}</p>}
          {warnings.length > 0 && (
            <ul className={styles["warnings-list"]}>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          <div className={styles["grid"]}>
            <CoreFieldsGrid
              fields={fields}
              onFieldsChange={setFields}
              fieldDefs={fieldDefs}
              tripNights={tripNights}
              data={data}
              onDataChange={setData}
              address={address}
              onAddressChange={setAddress}
              geocoding={geocoding}
              geocodeMsg={geocodeMsg}
              onFindCoords={handleFindCoords}
              disabled={!!reusedEntryId}
              tripSlug={canManage ? trip.slug : undefined}
              sectionId={section.id}
              showConcerns={!!section.supports_concerns}
              authToken={authToken}
              uploadTripSlug={trip.slug}
            />
            <PairFieldsBox
              supportsPairing={!!section.supports_pairing}
              pairPhase={pairPhase}
              onOpen={() => setPairPhase("input")}
              onCancel={cancelPair}
              pairUrl={pairUrl}
              onPairUrlChange={setPairUrl}
              onFetch={handlePairPreview}
              pairError={pairError}
              tripSlug={trip.slug}
              authToken={authToken}
              pairCookieWarning={pairCookieWarning}
              pairWarnings={pairWarnings}
              pairFields={pairFields}
              onPairFieldsChange={setPairFields}
              pairData={pairData}
              onPairDataChange={setPairData}
              fieldDefs={fieldDefs}
              tripNights={tripNights}
              groupLabel={fields.groupLabel}
              onGroupLabelChange={(v) => setFields({ ...fields, groupLabel: v })}
              presetGroupLabel={presetGroupLabel}
            />
          </div>

          <div className={styles["actions"]}>
            <button type="submit" disabled={phase === "saving"} className={styles["primary-button"]}>
              {phase === "saving" ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={reset} className={styles["cancel-button"]}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
