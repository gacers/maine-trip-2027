import { nanoid } from "nanoid";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createEntry } from "@/lib/entries";
import {
  createFutureInterestItem,
  deleteFutureInterestItem,
  listFutureInterest,
} from "@/lib/futureInterest";
import { supabaseServiceRole } from "@/lib/supabaseServer";

const NOTES_KEY = "__notes";
const CONCERNS_KEY = "__concerns";

function normalizeUrl(url: string | null | undefined): string | null {
  if (!url || !url.trim()) return null;
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

/** Options / primary wishlist sections — not Previously Visited tiers. */
export function isFutureInterestPromoteSection(slug: string): boolean {
  if (slug === "previously-visited" || slug.endsWith("-visited")) return false;
  return true;
}

/**
 * Move unvisited manual Future Interests for this category into the new
 * section as original trip entries (catalog roots). Deletes the FI rows.
 * Idempotent via URL match against entries already in the section.
 */
export async function promoteManualFutureInterestsToSection(input: {
  sectionId: string;
  tripId: string;
  categorySlug: string;
  /** Skip when documenting a completed/past trip (no Options wishlist). */
  tripCompleted: boolean;
}): Promise<{ promoted: number }> {
  if (input.tripCompleted) return { promoted: 0 };

  const manuals = await listFutureInterest(input.categorySlug, { includeVisited: false });
  if (manuals.length === 0) return { promoted: 0 };

  const supabase = supabaseServiceRole();
  const { data: existing, error: existError } = await supabase
    .from("entries")
    .select("id, url")
    .eq("section_id", input.sectionId)
    .eq("status", "active");
  if (existError) throw new Error(existError.message);

  const existingUrls = new Set(
    (existing || []).map((e) => normalizeUrl(e.url as string | null)).filter((u): u is string => !!u)
  );

  let promoted = 0;
  for (const item of manuals) {
    const urlKey = normalizeUrl(item.url);
    if (urlKey && existingUrls.has(urlKey)) continue;

    const raw = { ...(item.data || {}) };
    const notes = typeof raw[NOTES_KEY] === "string" ? (raw[NOTES_KEY] as string) : null;
    const concerns = typeof raw[CONCERNS_KEY] === "string" ? (raw[CONCERNS_KEY] as string) : null;
    delete raw[NOTES_KEY];
    delete raw[CONCERNS_KEY];

    await createEntry(supabase, {
      id: nanoid(8),
      section_id: input.sectionId,
      trip_id: input.tripId,
      status: "active",
      title: item.title,
      url: item.url,
      poster_image: item.poster_image,
      description: item.description,
      lat: item.lat,
      lng: item.lng,
      country: item.country,
      data: raw,
      notes,
      concerns,
      visited: false,
      visited_date: null,
      rank: null,
      archive_reason: null,
      group_label: null,
      extra_markers: [],
      import_source_entry_id: null,
      promoted_from_future_interest: true,
      future_interest_origin_id: item.id,
    });

    await deleteFutureInterestItem(item.id);
    if (urlKey) existingUrls.add(urlKey);
    promoted += 1;
  }

  return { promoted };
}

/**
 * Before a trip row is deleted, recreate Future Interests for entries
 * that came from FI and were never marked visited.
 */
export async function restoreFutureInterestsFromTrip(tripId: string): Promise<{ restored: number }> {
  const supabase = supabaseServiceRole();

  const { data: rows, error } = await supabase
    .from("entries")
    .select("id, title, url, poster_image, description, lat, lng, country, data, notes, concerns, visited, section_id")
    .eq("trip_id", tripId)
    .eq("promoted_from_future_interest", true)
    .eq("visited", false)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return { restored: 0 };

  const sectionIds = [...new Set(rows.map((r) => r.section_id as string))];
  const { data: sections, error: secError } = await supabase
    .from("sections")
    .select("id, nav_group_id")
    .in("id", sectionIds);
  if (secError) throw new Error(secError.message);

  const navGroupIds = [...new Set((sections || []).map((s) => s.nav_group_id).filter(Boolean))] as string[];
  const { data: navGroups, error: ngError } = await supabase
    .from("nav_groups")
    .select("id, slug")
    .in("id", navGroupIds);
  if (ngError) throw new Error(ngError.message);

  const navById = new Map((navGroups || []).map((g) => [g.id, g.slug as string]));
  const sectionCategory = new Map<string, string>();
  for (const s of sections || []) {
    const slug = s.nav_group_id ? navById.get(s.nav_group_id) : null;
    if (slug) sectionCategory.set(s.id, slug);
  }

  // Avoid recreating a duplicate of an FI row that already exists.
  const { data: existingFi } = await supabase.from("future_interest_items").select("url");
  const fiUrls = new Set(
    (existingFi || []).map((r) => normalizeUrl(r.url as string | null)).filter((u): u is string => !!u)
  );

  let restored = 0;
  for (const row of rows) {
    const categorySlug = sectionCategory.get(row.section_id as string);
    if (!categorySlug) continue;
    const urlKey = normalizeUrl(row.url as string | null);
    if (urlKey && fiUrls.has(urlKey)) continue;

    const data = { ...((row.data || {}) as Record<string, unknown>) };
    if (row.notes) data[NOTES_KEY] = row.notes;
    if (row.concerns) data[CONCERNS_KEY] = row.concerns;

    await createFutureInterestItem({
      categorySlug,
      title: row.title as string | null,
      url: row.url as string | null,
      posterImage: row.poster_image as string | null,
      description: row.description as string | null,
      lat: row.lat as number | null,
      lng: row.lng as number | null,
      country: row.country as string | null,
      data,
    });

    if (urlKey) fiUrls.add(urlKey);
    restored += 1;
  }

  return { restored };
}

/** Best-effort promote after Options/primary section create — never fails the section. */
export async function tryPromoteFutureInterestsForNewSection(
  supabase: SupabaseClient,
  input: {
    sectionId: string;
    sectionSlug: string;
    tripId: string;
    tripCompleted: boolean;
    navGroupId: string | null;
  }
): Promise<void> {
  if (input.tripCompleted) return;
  if (!isFutureInterestPromoteSection(input.sectionSlug)) return;
  if (!input.navGroupId) return;

  const { data: group } = await supabase.from("nav_groups").select("slug").eq("id", input.navGroupId).maybeSingle();
  if (!group?.slug) return;

  try {
    await promoteManualFutureInterestsToSection({
      sectionId: input.sectionId,
      tripId: input.tripId,
      categorySlug: group.slug,
      tripCompleted: input.tripCompleted,
    });
  } catch (err) {
    console.error("Future Interests promote failed:", err);
  }
}
