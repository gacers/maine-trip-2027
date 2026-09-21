"use client";

import { useEffect, useState } from "react";
import EntryCard from "@/components/EntryCard";
import { placeToClientEntry, type PlaceItem } from "@/lib/placesShared";
import type { SiteCategorySlug } from "@/lib/siteCategories";
import type { SurfaceCardLayout } from "@/lib/siteSurfaceShared";
import { defaultCardLayout, defaultSupportsConcerns } from "@/lib/siteSurfaceShared";
import type { FieldDef, FieldType } from "@/lib/types";

export interface PlaceCardProps {
  item: PlaceItem;
  categorySlug: SiteCategorySlug;
  initialFieldDefs: FieldDef[];
  geocodeTripSlug?: string;
  cardLayout?: SurfaceCardLayout;
  showConcerns?: boolean;
  onUpdated: (item: PlaceItem) => void;
  onRemove: (id: string) => void;
}

const NOTES_KEY = "__notes";
const CONCERNS_KEY = "__concerns";

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

// Places are already-known spots — always visited. Same EntryCard chrome
// as Future Interests; Categories merges these rows in as Visited.
export default function PlaceCard({
  item,
  categorySlug,
  initialFieldDefs,
  geocodeTripSlug,
  cardLayout = defaultCardLayout(categorySlug),
  showConcerns = defaultSupportsConcerns(categorySlug),
  onUpdated,
  onRemove,
}: PlaceCardProps) {
  const entry = placeToClientEntry(item);
  const [fieldDefs, setFieldDefs] = useState(() => mergeItemDataKeys(initialFieldDefs, item.data || {}));
  const compact = cardLayout === "grid-3";
  const mediumMedia = cardLayout === "grid-2";

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

  async function handlePatch(id: string, patch: Record<string, unknown>) {
    if (patch.status === "archived") {
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
    if ("visited" in patch) body.visited = !!patch.visited;

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

    const res = await fetch(`/api/places/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const resData = await res.json();
    if (!res.ok) return;
    onUpdated(resData.item as PlaceItem);
  }

  return (
    <EntryCard
      entry={entry}
      fieldDefs={fieldDefs}
      tripSlug={geocodeTripSlug}
      categorySlug={categorySlug}
      onFieldAdded={handleFieldAdded}
      onPatch={handlePatch}
      onDelete={onRemove}
      canManage
      canContribute
      showRatings={false}
      showConcerns={showConcerns}
      showMap
      comparisonMode={false}
      compact={compact}
      mediumMedia={mediumMedia}
      supportsPairing={false}
      showVisitedControl
    />
  );
}
