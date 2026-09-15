import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntryRow, ClientEntry } from "@/lib/types";

// Entries CRUD — replaces the appendItem/getAllItems/updateItemByRow/
// deleteItemByRow half of lib/sheets.js. Every function takes a Supabase
// client as its first argument rather than constructing one itself: GET
// routes pass the request-scoped RLS client (public reads are allowed),
// write routes pass whichever client lib/auth.ts's requireWriteAccess()
// decided was authorized (the interactive user's own session, or the
// service-role client after an API-key bearer token was verified).

export async function getAllEntries(supabase: SupabaseClient, sectionId: string): Promise<EntryRow[]> {
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .eq("section_id", sectionId)
    .order("rank", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function findEntryByUrl(
  supabase: SupabaseClient,
  sectionId: string,
  url: string
): Promise<EntryRow | null> {
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .eq("section_id", sectionId)
    .eq("url", url)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export interface ReusableEntryMatch {
  entry: EntryRow;
  tripName: string;
  sectionLabel: string;
}

// The same spot referenced in a *different* trip or section — entries
// has no unique constraint on url on purpose (the same restaurant
// legitimately shows up in more than one trip, or in both a trip's
// Options and Past tiers), so this is deliberately a *suggestion* to
// reuse, not a duplicate block the way findEntryByUrl's same-section
// match is. Only ever consulted after that same-section check already
// came back empty (see the preview route). Public read (entries' own
// RLS: `select using (true)`) — this app has one owner across every
// trip, no per-user isolation to respect here.
export async function findEntryByUrlAnywhere(
  supabase: SupabaseClient,
  url: string,
  excludeSectionId: string
): Promise<ReusableEntryMatch | null> {
  const { data, error } = await supabase
    .from("entries")
    .select("*, sections!inner(label, trips!inner(name))")
    .eq("url", url)
    .neq("section_id", excludeSectionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { sections, ...entry } = data as EntryRow & { sections: { label: string; trips: { name: string } } };
  return { entry: entry as EntryRow, tripName: sections.trips.name, sectionLabel: sections.label };
}

export async function createEntry(
  supabase: SupabaseClient,
  entry: Partial<EntryRow> & { id: string; section_id: string }
): Promise<EntryRow> {
  const { data, error } = await supabase.from("entries").insert(entry).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateEntry(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<EntryRow>
): Promise<EntryRow> {
  const { data, error } = await supabase.from("entries").update(patch).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteEntry(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Flattens a raw Supabase row into the shape the UI (and the generic,
// collection-shape-agnostic lib/groupUnits.ts and lib/listingUtils.ts)
// expect: camelCase core fields, and every section-specific `data` key
// (price, bedrooms, whatever a section defines) spread to the top level
// — matching how a plain listing object used to look pre-Supabase.
export function toClientEntry(row: EntryRow): ClientEntry;
export function toClientEntry(row: null | undefined): null | undefined;
export function toClientEntry(row: EntryRow | null | undefined): ClientEntry | null | undefined {
  if (!row) return row;
  const {
    poster_image,
    archive_reason,
    group_label,
    created_at,
    updated_at,
    section_id,
    trip_id,
    extra_markers,
    data,
    ...rest
  } = row;
  return {
    ...rest,
    posterImage: poster_image,
    archiveReason: archive_reason || "",
    groupLabel: group_label || "",
    createdAt: created_at,
    updatedAt: updated_at,
    sectionId: section_id,
    tripId: trip_id,
    extraMarkers: extra_markers || [],
    ...(data || {}),
  } as ClientEntry;
}
