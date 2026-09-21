"use client";

import { useEffect, useState } from "react";
import EntryCard from "@/components/EntryCard";
import type { FutureInterestViewItem } from "@/lib/futureInterest";
import type { SiteCategorySlug } from "@/lib/siteCategories";
import type { ClientEntry, FieldDef, FieldType } from "@/lib/types";

export interface FutureInterestCardProps {
  item: FutureInterestViewItem;
  categorySlug: SiteCategorySlug;
  /** Field defs shared with trip sections in this category. */
  initialFieldDefs: FieldDef[];
  /** Any accessible trip slug — EntryCard reverse-geocode lookups. */
  geocodeTripSlug?: string;
  onUpdated: (item: FutureInterestViewItem) => void;
  onRemove: (id: string) => void;
}

const NOTES_KEY = "__notes";
const CONCERNS_KEY = "__concerns";

/** Map a Future Interest row onto ClientEntry so EntryCard can render it. */
export function futureInterestToClientEntry(item: FutureInterestViewItem): ClientEntry {
  const raw = { ...(item.data || {}) };
  let notes: string | null =
    item.kind === "catalog"
      ? item.entryNotes ?? null
      : typeof raw[NOTES_KEY] === "string"
        ? (raw[NOTES_KEY] as string)
        : null;
  let concerns: string | null =
    item.kind === "catalog"
      ? item.entryConcerns ?? null
      : typeof raw[CONCERNS_KEY] === "string"
        ? (raw[CONCERNS_KEY] as string)
        : null;
  delete raw[NOTES_KEY];
  delete raw[CONCERNS_KEY];

  return {
    id: item.id,
    sectionId: "",
    tripId: "",
    rank: 0,
    status: "active",
    title: item.title,
    url: item.url,
    posterImage: item.poster_image,
    description: item.description,
    lat: item.lat,
    lng: item.lng,
    country: item.country,
    notes,
    concerns,
    archiveReason: "",
    groupLabel: "",
    extraMarkers: [],
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    visited: item.visited,
    visitedDate: null,
    importSourceEntryId: null,
    ...raw,
  } as ClientEntry;
}

function bulletsJoin(existing: string | null | undefined, append: string): string {
  const cur = (existing || "").trim();
  return cur ? `${cur}\n${append}` : append;
}

function mergeItemDataKeys(defs: FieldDef[], data: Record<string, unknown>): FieldDef[] {
  const known = new Set(defs.map((f) => f.key));
  const extras: FieldDef[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === NOTES_KEY || key === CONCERNS_KEY) continue;
    if (known.has(key)) continue;
    if (value !== true && value !== "true" && value !== false && value !== "false") continue;
    extras.push({
      id: key,
      section_id: "",
      key,
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      field_type: "boolean",
      storage: "jsonb",
      core_column: null,
      options: null,
      sort_order: 0,
      show_on_overview: true,
      required: false,
    });
  }
  return [...defs, ...extras];
}

function catalogApiBase(item: FutureInterestViewItem): string | null {
  if (item.kind !== "catalog" || !item.tripSlug || !item.navGroupSlug || !item.sectionSlug) return null;
  return `/api/trips/${item.tripSlug}/sections/${item.navGroupSlug}/${item.sectionSlug}/entries`;
}

// Same EntryCard as trip Food & Drink — Options appear by live reference;
// marking visited removes the card (and marks the trip Options entry).
export default function FutureInterestCard({
  item,
  categorySlug,
  initialFieldDefs,
  geocodeTripSlug,
  onUpdated,
  onRemove,
}: FutureInterestCardProps) {
  const entry = futureInterestToClientEntry(item);
  const [fieldDefs, setFieldDefs] = useState(() => mergeItemDataKeys(initialFieldDefs, item.data || {}));
  const isStays = categorySlug === "stays";

  useEffect(() => {
    setFieldDefs(mergeItemDataKeys(initialFieldDefs, item.data || {}));
  }, [initialFieldDefs, item.data, item.id]);

  function handleFieldAdded(field: {
    key: string;
    label: string;
    fieldType: FieldType;
    showOnOverview: boolean;
    required: boolean;
    options?: { choices?: string[]; aliases?: string[] } | null;
  }) {
    setFieldDefs((prev) => {
      if (prev.some((f) => f.key === field.key)) return prev;
      return [
        ...prev,
        {
          id: field.key,
          section_id: "",
          key: field.key,
          label: field.label,
          field_type: field.fieldType,
          storage: "jsonb",
          core_column: null,
          options: field.options || null,
          sort_order: prev.length,
          show_on_overview: field.showOnOverview,
          required: field.required,
        },
      ];
    });
  }

  async function handleCatalogPatch(id: string, patch: Record<string, unknown>) {
    const base = catalogApiBase(item);
    if (!base) return;

    // Visited → leave Future Interest (Options entry stays, now visited).
    if (patch.visited === true) {
      const res = await fetch(`${base}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visited: true }),
      });
      if (!res.ok) return;
      onRemove(id);
      return;
    }

    // Archive from FI card = same as visited for Options references.
    if (patch.status === "archived") {
      const res = await fetch(`${base}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visited: true }),
      });
      if (!res.ok) return;
      onRemove(id);
      return;
    }

    const body: Record<string, unknown> = { ...patch };
    const res = await fetch(`${base}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const resData = await res.json();
    if (!res.ok) return;
    const updated = resData.entry as ClientEntry;
    onUpdated({
      ...item,
      title: updated.title,
      url: updated.url,
      poster_image: updated.posterImage,
      description: updated.description,
      lat: updated.lat,
      lng: updated.lng,
      country: updated.country,
      data: (() => {
        const data: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updated)) {
          if (
            [
              "id",
              "sectionId",
              "tripId",
              "rank",
              "status",
              "archiveReason",
              "notes",
              "concerns",
              "title",
              "url",
              "posterImage",
              "description",
              "lat",
              "lng",
              "country",
              "extraMarkers",
              "groupLabel",
              "createdAt",
              "updatedAt",
              "visited",
              "visitedDate",
              "importSourceEntryId",
              "averageScore",
              "ratingCount",
              "myScore",
            ].includes(key)
          ) {
            continue;
          }
          data[key] = value;
        }
        return data;
      })(),
      entryNotes: updated.notes,
      entryConcerns: updated.concerns,
      visited: !!updated.visited,
      updated_at: updated.updatedAt,
    });
    if (updated.visited) onRemove(id);
  }

  async function handleManualPatch(id: string, patch: Record<string, unknown>) {
    // Visited → remove from Future Interest entirely.
    if (patch.visited === true || patch.status === "archived") {
      onRemove(id);
      return;
    }

    const body: Record<string, unknown> = {};
    const nextData: Record<string, unknown> = { ...(item.data || {}) };

    if ("title" in patch) body.title = patch.title ?? null;
    if ("url" in patch) body.url = patch.url ?? null;
    if ("posterImage" in patch) body.posterImage = patch.posterImage ?? null;
    if ("description" in patch) body.description = patch.description ?? null;
    if ("lat" in patch) body.lat = patch.lat === "" || patch.lat == null ? null : Number(patch.lat);
    if ("lng" in patch) body.lng = patch.lng === "" || patch.lng == null ? null : Number(patch.lng);

    if ("data" in patch && patch.data && typeof patch.data === "object") {
      for (const key of Object.keys(nextData)) {
        if (key === NOTES_KEY || key === CONCERNS_KEY) continue;
        delete nextData[key];
      }
      Object.assign(nextData, patch.data as Record<string, unknown>);
      body.data = nextData;
    }

    if ("notes" in patch) {
      nextData[NOTES_KEY] = patch.notes || "";
      body.data = nextData;
    }
    if (typeof patch.appendNote === "string" && patch.appendNote.trim()) {
      nextData[NOTES_KEY] = bulletsJoin(
        typeof nextData[NOTES_KEY] === "string" ? (nextData[NOTES_KEY] as string) : entry.notes,
        patch.appendNote.trim()
      );
      body.data = nextData;
    }
    if ("concerns" in patch) {
      nextData[CONCERNS_KEY] = patch.concerns || "";
      body.data = nextData;
    }
    if (typeof patch.appendConcern === "string" && patch.appendConcern.trim()) {
      nextData[CONCERNS_KEY] = bulletsJoin(
        typeof nextData[CONCERNS_KEY] === "string" ? (nextData[CONCERNS_KEY] as string) : entry.concerns,
        patch.appendConcern.trim()
      );
      body.data = nextData;
    }

    if (Object.keys(body).length === 0) return;

    const res = await fetch(`/api/future-interest/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const resData = await res.json();
    if (!res.ok) return;
    onUpdated({ ...resData.item, kind: "manual" as const });
  }

  async function handlePatch(id: string, patch: Record<string, unknown>) {
    if (item.kind === "catalog") await handleCatalogPatch(id, patch);
    else await handleManualPatch(id, patch);
  }

  async function handleDelete(id: string) {
    if (item.kind === "catalog") {
      // Same as visited — leave Future Interest without deleting the Options entry.
      await handleCatalogPatch(id, { visited: true });
      return;
    }
    onRemove(id);
  }

  return (
    <EntryCard
      entry={entry}
      fieldDefs={fieldDefs}
      tripSlug={item.kind === "catalog" ? item.tripSlug || geocodeTripSlug : geocodeTripSlug}
      categorySlug={categorySlug}
      onFieldAdded={handleFieldAdded}
      onPatch={handlePatch}
      onDelete={handleDelete}
      canManage
      canContribute
      showRatings={false}
      showMap
      comparisonMode={false}
      compact={!isStays}
      mediumMedia={isStays}
      supportsPairing={false}
      showVisitedControl
    />
  );
}
