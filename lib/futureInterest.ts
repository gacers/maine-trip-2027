import { nanoid } from "nanoid";
import { supabaseServiceRole } from "@/lib/supabaseServer";
import { getCatalogForCategory, type CatalogItem } from "@/lib/catalog";
import type { SiteCategorySlug } from "@/lib/siteCategories";
import type { ClientEntry } from "@/lib/types";

export interface FutureInterestItem {
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

/** Unified FI list row — live Options references + manually added rows. */
export interface FutureInterestViewItem extends FutureInterestItem {
  kind: "catalog" | "manual";
  /** Catalog-backed: PATCH path into the source trip Options entry. */
  tripSlug?: string | null;
  navGroupSlug?: string | null;
  sectionSlug?: string | null;
  /** Catalog-backed: notes/concerns live on the trip entry. */
  entryNotes?: string | null;
  entryConcerns?: string | null;
}

export interface FutureInterestInput {
  categorySlug: SiteCategorySlug;
  title?: string | null;
  url?: string | null;
  posterImage?: string | null;
  description?: string | null;
  lat?: number | null;
  lng?: number | null;
  data?: Record<string, unknown>;
  country?: string | null;
  sourceEntryId?: string | null;
}

const CLIENT_ENTRY_CORE = new Set([
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
]);

function entryFieldData(entry: ClientEntry): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (CLIENT_ENTRY_CORE.has(key)) continue;
    if (value === undefined) continue;
    data[key] = value;
  }
  return data;
}

function parseHref(href: string): { tripSlug: string; navGroupSlug: string; sectionSlug: string } | null {
  const path = href.replace(/^\//, "").split("#")[0];
  const [tripSlug, navGroupSlug, sectionSlug] = path.split("/");
  if (!tripSlug || !navGroupSlug || !sectionSlug) return null;
  return { tripSlug, navGroupSlug, sectionSlug };
}

function catalogToViewItem(c: CatalogItem, categorySlug: SiteCategorySlug): FutureInterestViewItem {
  const e = c.entry;
  const route = parseHref(c.href);
  return {
    id: e.id,
    kind: "catalog",
    category_slug: categorySlug,
    title: e.title,
    url: e.url,
    poster_image: e.posterImage,
    description: e.description,
    lat: e.lat,
    lng: e.lng,
    data: entryFieldData(e),
    country: e.country || c.country,
    source_entry_id: e.id,
    visited: false,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
    tripSlug: route?.tripSlug ?? null,
    navGroupSlug: route?.navGroupSlug ?? null,
    sectionSlug: route?.sectionSlug ?? null,
    entryNotes: e.notes,
    entryConcerns: e.concerns,
  };
}

function manualToViewItem(row: FutureInterestItem): FutureInterestViewItem {
  return { ...row, kind: "manual" };
}

/** DB-only rows (manual adds). Prefer listFutureInterestView for the page. */
export async function listFutureInterest(
  categorySlug: SiteCategorySlug,
  { includeVisited = false }: { includeVisited?: boolean } = {}
): Promise<FutureInterestItem[]> {
  const supabase = supabaseServiceRole();
  let query = supabase.from("future_interest_items").select("*").eq("category_slug", categorySlug).order("created_at", {
    ascending: false,
  });
  if (!includeVisited) query = query.eq("visited", false);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as FutureInterestItem[];
}

/** Drop leftover copies from the old "Bring in from Options" import —
 * Options now appear live by reference. */
async function pruneCatalogCopies(categorySlug: SiteCategorySlug): Promise<void> {
  const supabase = supabaseServiceRole();
  const { error } = await supabase
    .from("future_interest_items")
    .delete()
    .eq("category_slug", categorySlug)
    .not("source_entry_id", "is", null);
  if (error) throw new Error(error.message);
}

/**
 * Future Interest list: every unvisited Options-tier catalog place
 * (live reference) plus manually added FI-only rows. Visited Options
 * drop out automatically; marking visited on a row removes it.
 */
export async function listFutureInterestView(categorySlug: SiteCategorySlug): Promise<FutureInterestViewItem[]> {
  await pruneCatalogCopies(categorySlug);

  const [catalog, manualRows] = await Promise.all([
    getCatalogForCategory(categorySlug),
    listFutureInterest(categorySlug, { includeVisited: false }),
  ]);

  const catalogItems = catalog
    .filter((c) => c.tiers.includes("options") && !c.entry.visited)
    .map((c) => catalogToViewItem(c, categorySlug));

  const catalogUrls = new Set(catalogItems.map((c) => c.url).filter(Boolean));
  const catalogIds = new Set(catalogItems.map((c) => c.source_entry_id).filter(Boolean));

  // Manual rows only — skip any that duplicate a live Options card.
  const manualItems = manualRows
    .filter((row) => {
      if (row.source_entry_id && catalogIds.has(row.source_entry_id)) return false;
      if (row.url && catalogUrls.has(row.url)) return false;
      return true;
    })
    .map(manualToViewItem);

  const items = [...catalogItems, ...manualItems];
  items.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  return items;
}

export async function createFutureInterestItem(input: FutureInterestInput): Promise<FutureInterestItem> {
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
    visited: false,
  };
  const { data, error } = await supabase.from("future_interest_items").insert(row).select().single();
  if (error) throw new Error(error.message);
  return data as FutureInterestItem;
}

export async function updateFutureInterestItem(
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
): Promise<FutureInterestItem> {
  const supabase = supabaseServiceRole();
  const { data, error } = await supabase
    .from("future_interest_items")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as FutureInterestItem;
}

export async function deleteFutureInterestItem(id: string): Promise<void> {
  const supabase = supabaseServiceRole();
  const { error } = await supabase.from("future_interest_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
