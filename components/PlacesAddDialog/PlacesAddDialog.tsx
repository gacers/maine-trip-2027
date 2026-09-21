"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@/components/Dialog";
import Button from "@/components/Button";
import PlacePicker from "@/components/PlacePicker";
import UrlEntryForm from "@/components/AddEntryForm/UrlEntryForm";
import CoreFieldsGrid, { type CoreFields } from "@/components/AddEntryForm/CoreFieldsGrid";
import type { AddedFieldPayload } from "@/components/AddFieldSelect";
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
import type { PlaceItem } from "@/lib/placesShared";
import { withMovedFromStash } from "@/lib/statusFields";
import type { FieldDef, PlaceResult } from "@/lib/types";
import dialogStyles from "@/components/AddEntryDialog/AddEntryDialog.module.css";
import formStyles from "@/components/AddEntryForm/AddEntryForm.module.css";

export interface PlacesAddDialogProps {
  categorySlug: SiteCategorySlug;
  fieldDefs: FieldDef[];
  onAdded: (item: PlaceItem) => void;
  onFieldDefsChanged?: (field: AddedFieldPayload) => void;
  showConcerns?: boolean;
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

function placeholderFor(categorySlug: string): string {
  const map: Record<string, string> = {
    stays: "Paste a link for a place we stay...",
    "food-drink": "Paste a link for a regular spot...",
    activities: "Paste a link for an activity we know...",
    distilleries: "Paste a link for a distillery...",
    wineries: "Paste a link for a winery...",
  };
  return map[categorySlug] || "Paste a link for this place...";
}

type Phase = "idle" | "loading" | "editing" | "picking" | "saving";

function asLocalFieldDef(field: AddedFieldPayload): FieldDef {
  return {
    id: field.key,
    section_id: "",
    key: field.key,
    label: field.label,
    field_type: field.fieldType,
    storage: "jsonb",
    core_column: null,
    options: field.options || null,
    sort_order: 0,
    show_on_overview: field.showOnOverview,
    required: field.required,
  };
}

export default function PlacesAddDialog({
  categorySlug,
  fieldDefs: initialFieldDefs,
  onAdded,
  onFieldDefsChanged,
  showConcerns = false,
}: PlacesAddDialogProps) {
  const categoryLabel = siteCategoryLabel(categorySlug);
  const showTypes = true; // Closed/Moved (+ any type tags) on every category
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [fields, setFields] = useState<CoreFields>(CORE_INITIAL);
  const [typeData, setTypeData] = useState<Record<string, unknown>>({});
  const [fieldDefs, setFieldDefs] = useState(initialFieldDefs);
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [cookieWarning, setCookieWarning] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [geocodeMsg, setGeocodeMsg] = useState("");

  useEffect(() => {
    setFieldDefs(initialFieldDefs);
  }, [initialFieldDefs]);

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset() {
    setUrl("");
    setPhase("idle");
    setFields(CORE_INITIAL);
    setTypeData({});
    setFieldDefs(initialFieldDefs);
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

  function handleFieldAdded(field: AddedFieldPayload) {
    setFieldDefs((prev) => (prev.some((f) => f.key === field.key) ? prev : [...prev, asLocalFieldDef(field)]));
    onFieldDefsChanged?.(field);
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
        const res = await fetch("/api/places/preview", {
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
    if (categorySlug === "food-drink") {
      const picked = Object.values(typeData).some((v) => v === true);
      if (!picked) {
        setErrorMsg("Pick at least one type (Restaurant, Bar, …).");
        return;
      }
    }
    setPhase("saving");
    setErrorMsg("");
    let data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(typeData)) {
      if (value === true || value === false) data[key] = value;
      else if (typeof value === "string" && value.trim()) data[key] = value.trim();
      else if (typeof value === "number" && !Number.isNaN(value)) data[key] = value;
    }
    data = withMovedFromStash(data, fields.lat, fields.lng);
    try {
      const res = await fetch("/api/places", {
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
          data,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Save failed");
      onAdded(resData.item);
      setOpen(false);
      reset();
    } catch (err) {
      setErrorMsg((err as Error).message);
      setPhase("editing");
    }
  }

  const typeFieldDefs = showTypes ? fieldDefs : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          + Add to {categoryLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className={dialogStyles["content"]}>
        <DialogTitle>Add to Places — {categoryLabel}</DialogTitle>
        <div>
          {(phase === "idle" || phase === "loading") && (
            <UrlEntryForm
              url={url}
              onUrlChange={setUrl}
              loading={phase === "loading"}
              placeholder={placeholderFor(categorySlug)}
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
                  fieldDefs={typeFieldDefs}
                  tripNights={null}
                  data={typeData}
                  onDataChange={setTypeData}
                  address={address}
                  onAddressChange={setAddress}
                  geocoding={false}
                  geocodeMsg={geocodeMsg}
                  onFindCoords={() =>
                    setGeocodeMsg("Enter lat/lng above, or go back and search by place name.")
                  }
                  categorySlug={showTypes ? categorySlug : undefined}
                  onFieldAdded={showTypes ? handleFieldAdded : undefined}
                  showConcerns={showConcerns}
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
