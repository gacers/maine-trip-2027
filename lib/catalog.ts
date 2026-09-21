import { supabaseServiceRole } from "@/lib/supabaseServer";
import { getAdminUser } from "@/lib/auth";
import { getEditorTripIds } from "@/lib/tripEditors";
import { getAllTrips } from "@/lib/sections";
import { toClientEntry } from "@/lib/entries";
import { listPlaces } from "@/lib/places";
import { placeToClientEntry, type PlaceItem } from "@/lib/placesShared";
import type { ClientEntry, EntryRow } from "@/lib/types";

export type SectionTier = "options" | "previously-visited" | "other";

/** One trip/section appearance of a catalog place. */
export interface CatalogTripRef {
  tripId: string;
  tripSlug: string;
  tripName: string;
  sectionLabel: string;
  sectionTier: SectionTier;
  href: string;
}

export interface CatalogItem {
  /** The original entry (never a live-synced copy). */
  entry: ClientEntry;
  country: string | null;
  /** Every section tier this place appears in (for filters). */
  tiers: SectionTier[];
  /** Every trip this place appears in (original + synced copies). */
  trips: CatalogTripRef[];
  /** Href into the original's trip section, Places, or Future Interests. */
  href: string;
  /** Where this catalog card came from (drives Open link + FI Options merge). */
  origin: "trip" | "places" | "future-interests";
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

function resolveRootId(row: EntryRow, byId: Map<string, EntryRow>): string {
  let current = row;
  const seen = new Set<string>([current.id]);
  while (current.import_source_entry_id) {
    const parent = byId.get(current.import_source_entry_id);
    if (!parent) return current.import_source_entry_id;
    if (seen.has(parent.id)) break;
    seen.add(parent.id);
    current = parent;
  }
  return current.id;
}

function placeToCatalogItem(place: PlaceItem, categorySlug: string): CatalogItem {
  const entry = placeToClientEntry(place);
  return {
    entry,
    country: place.country,
    tiers: place.visited ? ["previously-visited"] : ["other"],
    trips: [],
    href: `/places/${categorySlug}#listing-${place.id}`,
    origin: "places",
  };
}

/** Same column shape as place_items — reuse placeToClientEntry. */
interface FutureInterestRow {
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

function futureInterestToCatalogItem(row: FutureInterestRow, categorySlug: string): CatalogItem {
  const entry = placeToClientEntry(row);
  return {
    entry,
    country: row.country,
    // Wishlist → Option; checked-off FI → Visited.
    tiers: row.visited ? ["previously-visited"] : ["options"],
    trips: [],
    href: `/future-interests/${categorySlug}#listing-${row.id}`,
    origin: "future-interests",
  };
}

async function listFutureInterestRows(categorySlug: string): Promise<FutureInterestRow[]> {
  const supabase = supabaseServiceRole();
  const { data, error } = await supabase
    .from("future_interest_items")
    .select("*")
    .eq("category_slug", categorySlug)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as FutureInterestRow[];
}

async function getTripCatalogItems(categorySlug: string): Promise<CatalogItem[]> {
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

  const rows = (entries || []) as EntryRow[];
  const byId = new Map(rows.map((r) => [r.id, r]));

  // Pull any roots that live outside this category fetch (e.g. archived
  // source section) so we can still show the original card once.
  const missingRootIds = new Set<string>();
  for (const row of rows) {
    const rootId = resolveRootId(row, byId);
    if (!byId.has(rootId)) missingRootIds.add(rootId);
  }
  if (missingRootIds.size > 0) {
    const { data: roots, error: rootError } = await supabase
      .from("entries")
      .select("*")
      .in("id", [...missingRootIds]);
    if (rootError) throw new Error(rootError.message);
    for (const root of (roots || []) as EntryRow[]) {
      byId.set(root.id, root);
    }
  }

  type Appearance = { row: EntryRow; ref: CatalogTripRef };
  const groups = new Map<string, Appearance[]>();

  for (const row of rows) {
    const section = sectionById.get(row.section_id);
    if (!section) continue;
    const nav = navById.get(section.nav_group_id);
    if (!nav) continue;
    const trip = tripById.get(section.trip_id);
    if (!trip) continue;
    const tier = tierForSectionSlug(section.slug);
    const ref: CatalogTripRef = {
      tripId: trip.id,
      tripSlug: trip.slug,
      tripName: trip.name,
      sectionLabel: section.label,
      sectionTier: tier,
      href: `/${trip.slug}/${nav.slug}/${section.slug}#listing-${row.id}`,
    };
    const rootId = resolveRootId(row, byId);
    const list = groups.get(rootId) || [];
    list.push({ row, ref });
    groups.set(rootId, list);
  }

  const items: CatalogItem[] = [];
  for (const [rootId, appearances] of groups) {
    const root = byId.get(rootId);
    if (!root) continue;
    // Skip if this root is itself a synced copy of something we couldn't
    // resolve — only surface true originals.
    if (root.import_source_entry_id) continue;

    const rootSection = sectionById.get(root.section_id);
    const rootNav = rootSection ? navById.get(rootSection.nav_group_id) : undefined;
    const rootTrip = rootSection ? tripById.get(rootSection.trip_id) : undefined;

    // Deduplicate by trip (one link per trip; prefer the original's section).
    const trips: CatalogTripRef[] = [];
    const seenTripIds = new Set<string>();
    const tierSet = new Set<SectionTier>();
    const ordered = [...appearances].sort((a, b) => {
      if (a.row.id === rootId) return -1;
      if (b.row.id === rootId) return 1;
      return 0;
    });
    for (const { ref } of ordered) {
      tierSet.add(ref.sectionTier);
      if (seenTripIds.has(ref.tripId)) continue;
      seenTripIds.add(ref.tripId);
      trips.push(ref);
    }

    const href =
      rootTrip && rootNav && rootSection
        ? `/${rootTrip.slug}/${rootNav.slug}/${rootSection.slug}#listing-${root.id}`
        : trips[0]?.href || "#";

    items.push({
      entry: toClientEntry(root),
      country:
        (root.country as string | null) ||
        (rootTrip?.country ?? null) ||
        (ordered.find((a) => a.row.country)?.row.country as string | null) ||
        null,
      tiers: [...tierSet],
      trips,
      href,
      origin: "trip",
    });
  }

  return items;
}

// Trip entries in this category (across accessible trips) plus manual
// Places and Future Interests rows — fills in spots that aren't on any
// trip yet. Synced entry copies collapse to the original; Places / FI
// that already match a trip entry (same source_entry_id or URL) are skipped.
export async function getCatalogForCategory(categorySlug: string): Promise<CatalogItem[]> {
  const [tripItems, places, futureInterest] = await Promise.all([
    getTripCatalogItems(categorySlug),
    listPlaces(categorySlug),
    listFutureInterestRows(categorySlug),
  ]);

  const items = [...tripItems];
  const seenIds = new Set(items.map((i) => i.entry.id));
  const seenUrls = new Set(items.map((i) => i.entry.url).filter((u): u is string => !!u));

  function absorb(extra: CatalogItem, sourceEntryId: string | null, url: string | null, id: string) {
    if (sourceEntryId && seenIds.has(sourceEntryId)) return;
    if (url && seenUrls.has(url)) return;
    if (seenIds.has(id)) return;
    items.push(extra);
    seenIds.add(id);
    if (url) seenUrls.add(url);
  }

  for (const place of places) {
    absorb(placeToCatalogItem(place, categorySlug), place.source_entry_id, place.url, place.id);
  }
  for (const row of futureInterest) {
    absorb(futureInterestToCatalogItem(row, categorySlug), row.source_entry_id, row.url, row.id);
  }

  items.sort((a, b) => (a.entry.title || "").localeCompare(b.entry.title || ""));
  return items;
}
