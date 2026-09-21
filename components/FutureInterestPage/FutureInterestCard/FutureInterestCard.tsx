"use client";

import EntryCard from "@/components/EntryCard";
import {
  ACTIVITIES_TYPE_FIELD_DEFS,
  FOOD_DRINK_TYPE_FIELD_DEFS,
  type TemplateFieldDef,
} from "@/lib/sectionTemplates";
import type { FutureInterestItem } from "@/lib/futureInterest";
import type { SiteCategorySlug } from "@/lib/siteCategories";
import type { ClientEntry, FieldDef } from "@/lib/types";

export interface FutureInterestCardProps {
  item: FutureInterestItem;
  categorySlug: SiteCategorySlug;
  /** Any accessible trip slug — EntryCard reverse-geocode / map town
   * lookups go through that trip's geocode route (admin session). */
  geocodeTripSlug?: string;
  onUpdated: (item: FutureInterestItem) => void;
  onRemove: (id: string) => void;
}

const NOTES_KEY = "__notes";
const CONCERNS_KEY = "__concerns";

function asFieldDef(f: TemplateFieldDef): FieldDef {
  return {
    id: f.key,
    section_id: "",
    key: f.key,
    label: f.label,
    field_type: f.field_type,
    storage: "jsonb",
    core_column: null,
    options: f.options || null,
    sort_order: 0,
    show_on_overview: f.show_on_overview,
    required: false,
  };
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function fieldDefsForCategory(slug: SiteCategorySlug, data: Record<string, unknown>): FieldDef[] {
  const base =
    slug === "food-drink"
      ? FOOD_DRINK_TYPE_FIELD_DEFS
      : slug === "activities"
        ? ACTIVITIES_TYPE_FIELD_DEFS
        : [];
  const defs = base.map(asFieldDef);
  const known = new Set(defs.map((f) => f.key));
  for (const [key, value] of Object.entries(data)) {
    if (key === NOTES_KEY || key === CONCERNS_KEY) continue;
    if (known.has(key)) continue;
    if (value !== true && value !== "true" && value !== false && value !== "false") continue;
    defs.push(
      asFieldDef({
        key,
        label: humanizeKey(key),
        field_type: "boolean",
        show_on_overview: true,
      })
    );
  }
  return defs;
}

/** Map a Future Interest row onto ClientEntry so EntryCard can render it. */
export function futureInterestToClientEntry(item: FutureInterestItem): ClientEntry {
  const raw = { ...(item.data || {}) };
  const notes = typeof raw[NOTES_KEY] === "string" ? (raw[NOTES_KEY] as string) : null;
  const concerns = typeof raw[CONCERNS_KEY] === "string" ? (raw[CONCERNS_KEY] as string) : null;
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

// Same EntryCard as trip Food & Drink / Stays — patches go to the FI API.
export default function FutureInterestCard({
  item,
  categorySlug,
  geocodeTripSlug,
  onUpdated,
  onRemove,
}: FutureInterestCardProps) {
  const entry = futureInterestToClientEntry(item);
  const fieldDefs = fieldDefsForCategory(categorySlug, item.data || {});
  const isStays = categorySlug === "stays";

  async function handlePatch(id: string, patch: Record<string, unknown>) {
    const body: Record<string, unknown> = {};
    const nextData: Record<string, unknown> = { ...(item.data || {}) };

    if ("title" in patch) body.title = patch.title ?? null;
    if ("url" in patch) body.url = patch.url ?? null;
    if ("posterImage" in patch) body.posterImage = patch.posterImage ?? null;
    if ("description" in patch) body.description = patch.description ?? null;
    if ("lat" in patch) body.lat = patch.lat === "" || patch.lat == null ? null : Number(patch.lat);
    if ("lng" in patch) body.lng = patch.lng === "" || patch.lng == null ? null : Number(patch.lng);
    if ("visited" in patch) body.visited = !!patch.visited;

    if ("data" in patch && patch.data && typeof patch.data === "object") {
      // Replace type tags from the edit form; keep notes/concerns keys.
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

    // Archive on FI = remove (no archived state on wishlist items).
    if (patch.status === "archived") {
      onRemove(id);
      return;
    }

    if (Object.keys(body).length === 0) return;

    const res = await fetch(`/api/future-interest/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const resData = await res.json();
    if (!res.ok) return;
    onUpdated(resData.item);
  }

  return (
    <EntryCard
      entry={entry}
      fieldDefs={fieldDefs}
      tripSlug={geocodeTripSlug}
      onPatch={handlePatch}
      onDelete={onRemove}
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
