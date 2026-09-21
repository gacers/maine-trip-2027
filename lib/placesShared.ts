import type { ClientEntry } from "@/lib/types";

export interface PlaceItem {
  id: string;
  category_slug: string;
  title: string | null;
  url: string | null;
  poster_image: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  data: Record<string, unknown>;
  country: string | null;
  source_entry_id: string | null;
  visited: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlaceInput {
  categorySlug: string;
  title?: string | null;
  url?: string | null;
  posterImage?: string | null;
  description?: string | null;
  lat?: number | null;
  lng?: number | null;
  data?: Record<string, unknown>;
  country?: string | null;
  sourceEntryId?: string | null;
  visited?: boolean;
}

const NOTES_KEY = "__notes";
const CONCERNS_KEY = "__concerns";

/** Flatten a place_items row into the same ClientEntry shape trip cards use. */
export function placeToClientEntry(item: PlaceItem): ClientEntry {
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
