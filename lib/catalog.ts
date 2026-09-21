import { supabaseServiceRole } from "@/lib/supabaseServer";
import { getAdminUser } from "@/lib/auth";
import { getEditorTripIds } from "@/lib/tripEditors";
import { getAllTrips } from "@/lib/sections";
import { toClientEntry } from "@/lib/entries";
import type { ClientEntry, EntryRow } from "@/lib/types";
import type { SiteCategorySlug } from "@/lib/siteCategories";

export type SectionTier = "options" | "previously-visited" | "other";

export interface CatalogItem {
  entry: ClientEntry;
  tripId: string;
  tripSlug: string;
  tripName: string;
  country: string | null;
  navGroupSlug: string;
  sectionSlug: string;
  sectionLabel: string;
  sectionTier: SectionTier;
  href: string;
}

function tierForSectionSlug(slug: string): SectionTier {
  if (slug === "options") return "options";
  if (slug === "previously-visited" || slug.endsWith("-visited")) return "previously-visited";
  return "other";
}

async function accessibleTripIds(): Promise<string[] | "all"> {
  if (await getAdminUser()) return "all";
  const editorIds = await getEditorTripIds();
  return editorIds;
}

// Every active entry in enabled sections whose nav group slug matches
// `categorySlug`, across trips the current session can access.
export async function getCatalogForCategory(categorySlug: SiteCategorySlug): Promise<CatalogItem[]> {
  const access = await accessibleTripIds();
  if (access !== "all" && access.length === 0) return [];

  const trips = await getAllTrips();
  const tripList = access === "all" ? trips : trips.filter((t) => access.includes(t.id));
  if (tripList.length === 0) return [];
  const tripById = new Map(tripList.map((t) => [t.id, t]));
  const tripIds = tripList.map((t) => t.id);

  const supabase = supabaseServiceRole();
  const { data: navGroups, error: ngError } = await supabase
    .from("nav_groups")
    .select("id, slug, trip_id")
    .eq("slug", categorySlug)
    .in("trip_id", tripIds);
  if (ngError) throw new Error(ngError.message);
  if (!navGroups || navGroups.length === 0) return [];

  const navGroupIds = navGroups.map((g) => g.id);
  const navById = new Map(navGroups.map((g) => [g.id, g]));

  const { data: sections, error: secError } = await supabase
    .from("sections")
    .select("id, slug, label, trip_id, nav_group_id, enabled")
    .in("nav_group_id", navGroupIds)
    .eq("enabled", true);
  if (secError) throw new Error(secError.message);
  if (!sections || sections.length === 0) return [];

  const sectionIds = sections.map((s) => s.id);
  const sectionById = new Map(sections.map((s) => [s.id, s]));

  const { data: entries, error: entError } = await supabase
    .from("entries")
    .select("*")
    .in("section_id", sectionIds)
    .eq("status", "active")
    .order("rank", { ascending: true, nullsFirst: false });
  if (entError) throw new Error(entError.message);

  const items: CatalogItem[] = [];
  for (const row of (entries || []) as EntryRow[]) {
    const section = sectionById.get(row.section_id);
    if (!section) continue;
    const nav = navById.get(section.nav_group_id);
    if (!nav) continue;
    const trip = tripById.get(section.trip_id);
    if (!trip) continue;
    const tier = tierForSectionSlug(section.slug);
    items.push({
      entry: toClientEntry(row),
      tripId: trip.id,
      tripSlug: trip.slug,
      tripName: trip.name,
      country: (row.country as string | null) || trip.country || null,
      navGroupSlug: nav.slug,
      sectionSlug: section.slug,
      sectionLabel: section.label,
      sectionTier: tier,
      href: `/${trip.slug}/${nav.slug}/${section.slug}#listing-${row.id}`,
    });
  }
  return items;
}
