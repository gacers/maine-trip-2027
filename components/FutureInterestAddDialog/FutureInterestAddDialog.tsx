"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@/components/Dialog";
import Button from "@/components/Button";
import PlacePicker from "@/components/PlacePicker";
import UrlEntryForm from "@/components/AddEntryForm/UrlEntryForm";
import CoreFieldsGrid, { type CoreFields } from "@/components/AddEntryForm/CoreFieldsGrid";
import {
  isPlainUrl,
  isGoogleMapsShareUrl,
  isGoogleSearchUrl,
  isGoogleMapsUrl,
  extractGoogleSearchQuery,
  parseGoogleMapsUrl,
} from "@/lib/googleUrlHelpers";
import { searchPlacesByText } from "@/lib/googlePlaces";
import { siteCategoryLabel, type SiteCategorySlug } from "@/lib/siteCategories";
import type { FutureInterestItem } from "@/lib/futureInterest";
import type { PlaceResult } from "@/lib/types";
import dialogStyles from "@/components/AddEntryDialog/AddEntryDialog.module.css";
import formStyles from "@/components/AddEntryForm/AddEntryForm.module.css";

export interface FutureInterestAddDialogProps {
  categorySlug: SiteCategorySlug;
  onAdded: (item: FutureInterestItem) => void;
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

const PLACEHOLDERS: Record<SiteCategorySlug, string> = {
  stays: "Paste a link for a place to stay...",
  "food-drink": "Paste a link for a bar or restaurant we like...",
  activities: "Paste a link for a hike, tour, or activity...",
  distilleries: "Paste a link for a distillery...",
  wineries: "Paste a link for a winery...",
};

type Phase = "idle" | "loading" | "editing" | "picking" | "saving";

// Same Add dialog chrome + UrlEntryForm / Places / core fields as trip
// section Add — saves to Future Interest for the current category tab
// instead of a trip section.
export default function FutureInterestAddDialog({ categorySlug, onAdded }: FutureInterestAddDialogProps) {
  const categoryLabel = siteCategoryLabel(categorySlug);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [fields, setFields] = useState<CoreFields>(CORE_INITIAL);
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [cookieWarning, setCookieWarning] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [geocodeMsg, setGeocodeMsg] = useState("");

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset() {
    setUrl("");
    setPhase("idle");
    setFields(CORE_INITIAL);
    setPlaceResults([]);
    setErrorMsg("");
    setWarnings([]);
    setCookieWarning(null);
    setAddress("");
    setGeocodeMsg("");
  }

  function startBlank() {
    setUrl("");
    setFields(CORE_INITIAL);
    setWarnings([]);
    setCookieWarning(null);
    setErrorMsg("");
    setPhase("editing");
  }

  async function handlePreview(e: FormEvent) {
    e.preventDefault();
    const raw = url.trim();
    if (!raw) return;
    setPhase("loading");
    setErrorMsg("");

    const isGoogleUrl = isGoogleMapsShareUrl(raw) || isGoogleSearchUrl(raw) || isGoogleMapsUrl(raw);

    if (isPlainUrl(raw) && !isGoogleUrl) {
      try {
        const res = await fetch("/api/future-interest/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: raw }),
        });
        const resData = await res.json();
        if (!res.ok) {
          setErrorMsg(resData.error || "Something went wrong.");
          setPhase("idle");
          return;
        }
        const s = resData.scraped || {};
        setFields({
          ...CORE_INITIAL,
          title: s.title || "",
          posterImage: s.posterImage || "",
          description: s.description || "",
          lat: s.lat ?? "",
          lng: s.lng ?? "",
        });
        setUrl(s.normalizedUrl || s.url || raw);
        setWarnings(s.warnings || []);
        setCookieWarning(s.cookieWarning || null);
        setPhase("editing");
      } catch (err) {
        setErrorMsg((err as Error).message);
        setPhase("idle");
      }
      return;
    }

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
      ...CORE_INITIAL,
      title: place.title || "",
      posterImage: place.photoUrl || "",
      description: place.summary || place.category || "",
      lat: place.lat ?? "",
      lng: place.lng ?? "",
    });
    setUrl(place.website || place.mapsUrl || url);
    setWarnings([]);
    setCookieWarning(null);
    setPlaceResults([]);
    setPhase("editing");
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!fields.title.trim()) {
      setErrorMsg("Title is required.");
      return;
    }
    setPhase("saving");
    setErrorMsg("");
    try {
      const res = await fetch("/api/future-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categorySlug,
          title: fields.title.trim() || null,
          url: url.trim() || null,
          posterImage: fields.posterImage.trim() || null,
          description: fields.description.trim() || null,
          lat: fields.lat === "" ? null : Number(fields.lat),
          lng: fields.lng === "" ? null : Number(fields.lng),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onAdded(data.item);
      setOpen(false);
      reset();
    } catch (err) {
      setErrorMsg((err as Error).message);
      setPhase("editing");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          + Add to {categoryLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className={dialogStyles["content"]}>
        <DialogTitle>Add to {categoryLabel}</DialogTitle>
        <div>
          {(phase === "idle" || phase === "loading") && (
            <UrlEntryForm
              url={url}
              onUrlChange={setUrl}
              loading={phase === "loading"}
              placeholder={PLACEHOLDERS[categorySlug]}
              onSubmit={handlePreview}
              onStartBlank={startBlank}
              titleMatches={[]}
              onPickTitleMatch={() => {}}
            />
          )}

          {errorMsg && <p className={formStyles["error-msg"]}>{errorMsg}</p>}

          {phase === "picking" && placeResults.length > 0 && (
            <PlacePicker places={placeResults} onChoose={choosePlace} onCancel={reset} />
          )}

          {(phase === "editing" || phase === "saving") && (
            <form onSubmit={handleSave} className={formStyles["edit-form"]}>
              {cookieWarning && <p className={formStyles["cookie-warning"]}>{cookieWarning}</p>}
              {warnings.length > 0 && (
                <ul className={formStyles["warnings-list"]}>
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}

              <div className={formStyles["grid"]}>
                <CoreFieldsGrid
                  fields={fields}
                  onFieldsChange={setFields}
                  fieldDefs={[]}
                  tripNights={null}
                  data={{}}
                  onDataChange={() => {}}
                  address={address}
                  onAddressChange={setAddress}
                  geocoding={false}
                  geocodeMsg={geocodeMsg}
                  onFindCoords={() =>
                    setGeocodeMsg("Enter lat/lng above, or go back and search by place name.")
                  }
                />
              </div>

              <div className={formStyles["actions"]}>
                <button type="submit" disabled={phase === "saving"} className={formStyles["primary-button"]}>
                  {phase === "saving" ? "Saving..." : "Save"}
                </button>
                <button type="button" onClick={reset} className={formStyles["cancel-button"]}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
