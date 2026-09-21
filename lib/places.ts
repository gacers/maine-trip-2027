import { nanoid } from "nanoid";
import { supabaseServiceRole } from "@/lib/supabaseServer";
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

/** Manual place rows for a category — Categories merges these in as Visited. */
export async function listPlaces(categorySlug: string): Promise<PlaceItem[]> {
  const supabase = supabaseServiceRole();
  const { data, error } = await supabase
    .from("place_items")
    .select("*")
    .eq("category_slug", categorySlug)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as PlaceItem[];
}

export async function createPlaceItem(input: PlaceInput): Promise<PlaceItem> {
  const supabase = supabaseServiceRole();
  const row = {
    id: nanoid(8),
    category_slug: input.categorySlug,
    title: input.title || null,
    url: input.url || null,
    poster_image: input.posterImage || null,
    description: input.description || null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    data: input.data || {},
    country: input.country || null,
    source_entry_id: input.sourceEntryId || null,
    visited: input.visited !== false,
  };
  const { data, error } = await supabase.from("place_items").insert(row).select().single();
  if (error) throw new Error(error.message);
  return data as PlaceItem;
}

export async function updatePlaceItem(
  id: string,
  patch: Partial<{
    title: string | null;
    url: string | null;
    poster_image: string | null;
    description: string | null;
    lat: number | null;
    lng: number | null;
    data: Record<string, unknown>;
    country: string | null;
    visited: boolean;
    category_slug: string;
  }>
): Promise<PlaceItem> {
  const supabase = supabaseServiceRole();
  const { data, error } = await supabase
    .from("place_items")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as PlaceItem;
}

export async function deletePlaceItem(id: string): Promise<void> {
  const supabase = supabaseServiceRole();
  const { error } = await supabase.from("place_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
