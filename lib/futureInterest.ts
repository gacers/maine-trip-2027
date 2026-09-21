import { nanoid } from "nanoid";
import { supabaseServiceRole } from "@/lib/supabaseServer";
import { getCatalogForCategory } from "@/lib/catalog";
import type { SiteCategorySlug } from "@/lib/siteCategories";
import {
  ACTIVITIES_TYPE_FIELD_DEFS,
  FOOD_DRINK_TYPE_FIELD_DEFS,
  type TemplateFieldDef,
} from "@/lib/sectionTemplates";

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

function typeDataFromEntry(
  categorySlug: SiteCategorySlug,
  entry: Record<string, unknown>
): Record<string, unknown> {
  const defs: TemplateFieldDef[] =
    categorySlug === "food-drink"
      ? FOOD_DRINK_TYPE_FIELD_DEFS
      : categorySlug === "activities"
        ? ACTIVITIES_TYPE_FIELD_DEFS
        : [];
  const data: Record<string, unknown> = {};
  for (const f of defs) {
    if (entry[f.key] === true || entry[f.key] === "true") data[f.key] = true;
  }
  return data;
}

// Import unvisited Options-tier catalog entries for this category that
// aren't already linked via source_entry_id (or matching URL).
export async function importUnvisitedOptions(categorySlug: SiteCategorySlug): Promise<{ imported: number }> {
  const catalog = await getCatalogForCategory(categorySlug);
  const candidates = catalog.filter((c) => c.tiers.includes("options") && !c.entry.visited);

  const supabase = supabaseServiceRole();
  const { data: existing, error } = await supabase
    .from("future_interest_items")
    .select("source_entry_id, url")
    .eq("category_slug", categorySlug);
  if (error) throw new Error(error.message);

  const existingSourceIds = new Set((existing || []).map((r) => r.source_entry_id).filter(Boolean));
  const existingUrls = new Set((existing || []).map((r) => r.url).filter(Boolean));

  let imported = 0;
  for (const c of candidates) {
    if (existingSourceIds.has(c.entry.id)) continue;
    if (c.entry.url && existingUrls.has(c.entry.url)) continue;
    await createFutureInterestItem({
      categorySlug,
      title: c.entry.title,
      url: c.entry.url,
      posterImage: c.entry.posterImage,
      description: c.entry.description,
      lat: c.entry.lat,
      lng: c.entry.lng,
      country: c.entry.country || c.country,
      data: typeDataFromEntry(categorySlug, c.entry as unknown as Record<string, unknown>),
      sourceEntryId: c.entry.id,
    });
    imported += 1;
    if (c.entry.url) existingUrls.add(c.entry.url);
    existingSourceIds.add(c.entry.id);
  }
  return { imported };
}
