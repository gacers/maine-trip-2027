import { nanoid } from "nanoid";
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

// Live search-as-you-type across every trip/section's entries by title
// — same "suggestion to reuse" idea as findEntryByUrlAnywhere above,
// just keyed by name instead of a pasted link (for someone typing a
// place from memory rather than pasting its URL). Same "never blocks,
// just offers" semantics: picking a match still creates a genuinely
// independent row (see the preview route's own comment on why notes/
// rank/section-specific fields are never carried over either way).
// Its own route requires read access to the *calling* trip (see
// requireReadAccess) — once past that, the results themselves are
// still cross-trip on purpose, same as findEntryByUrlAnywhere.
export async function searchEntriesByTitle(
  supabase: SupabaseClient,
  query: string,
  excludeSectionId: string,
  limit = 8
): Promise<ReusableEntryMatch[]> {
  const { data, error } = await supabase
    .from("entries")
    .select("*, sections!inner(label, trips!inner(name))")
    .ilike("title", `%${query}%`)
    .neq("section_id", excludeSectionId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as (EntryRow & { sections: { label: string; trips: { name: string } } })[]).map((row) => {
    const { sections, ...entry } = row;
    return { entry: entry as EntryRow, tripName: sections.trips.name, sectionLabel: sections.label };
  });
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
  // A plain DELETE that RLS blocks doesn't error — Postgres just filters
  // the row out of the operation entirely, so a delete with 0 rows
  // actually affected still reports "success" with nothing to show for
  // it, and this call would silently do nothing while callers believed
  // it worked (confirmed live: a signed-in-but-unauthorized session got
  // a 200 back from the DELETE route with the entry still there
  // afterward). Asking for the deleted row back and checking it's
  // actually present catches both that and a plain "no such id".
  const { data, error } = await supabase.from("entries").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Delete failed — not found, or you don't have permission to delete this");
  }
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
    visited_date,
    import_source_entry_id,
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
    visitedDate: visited_date,
    importSourceEntryId: import_source_entry_id,
    ...(data || {}),
  } as ClientEntry;
}

export interface CandidateSection {
  sectionId: string;
  sectionLabel: string;
  tripId: string;
  tripName: string;
  tripCompleted: boolean;
  entryCount: number;
}

// Every section that plausibly holds "the same kind of place" —
// including this same trip's own other sections, so a past tier can
// "nest" a prefill from a differently-organized section right here on
// this trip too, not just from elsewhere — backs the Prefill panel on
// a section's own edit page (see the entries/import route), so an
// admin can see and choose exactly which section they're pulling from
// instead of a single opaque blended count across everything
// (confirmed live as genuinely confusing: e.g. "Food & Drink" matching
// 113 entries blended in from every other trip's own Food & Drink,
// with no way to tell whose was whose). Scoped by NAV GROUP slug, not
// just the section's own slug — every built-in category's own two tiers
// are always literally slugged "options"/"previously-visited"
// regardless of which category they're actually in (confirmed live as
// a real bug: Scotland's own "Food & Drink Options" matched Maine's
// "Stay Options" and "Activity Options" too, since all 3 happen to
// share that same bare section slug — the nav group they live in
// is what actually tells them apart, e.g. "food-drink" vs "houses"). A
// custom nav group's own slug is already unique to its concept, so
// this scoping is a no-op there. Matches both a plain concept slug and
// its own "-visited" counterpart (either tier counts as "documented
// somewhere"), excluding only the exact destination section itself
// (`excludeSectionId`) so it never offers to prefill a section from
// itself. Completed trips sort first since a "previously visited" list
// is only really meaningful pulled from a trip that's actually already
// happened, but an in-progress trip's own version still shows further
// down rather than being hidden outright (a trip like an old
// undocumented reference trip that was never formally marked Completed
// shouldn't just disappear from the list).
export async function findCandidateSectionsForConceptSlug(
  supabase: SupabaseClient,
  navGroupSlug: string,
  sectionSlug: string,
  excludeSectionId: string
): Promise<CandidateSection[]> {
  const conceptSlug = sectionSlug.replace(/-visited$/, "");

  const { data: groups, error: groupsError } = await supabase.from("nav_groups").select("id").eq("slug", navGroupSlug);
  if (groupsError) throw new Error(groupsError.message);
  if (!groups || groups.length === 0) return [];

  const { data: sections, error: sectionsError } = await supabase
    .from("sections")
    .select("id, label, trip_id, trips!inner(name, completed)")
    .in(
      "nav_group_id",
      groups.map((g) => g.id)
    )
    .in("slug", [conceptSlug, `${conceptSlug}-visited`])
    .neq("id", excludeSectionId);
  if (sectionsError) throw new Error(sectionsError.message);
  if (!sections || sections.length === 0) return [];

  const { data: counts, error: countError } = await supabase
    .from("entries")
    .select("section_id")
    .in(
      "section_id",
      sections.map((s) => s.id)
    );
  if (countError) throw new Error(countError.message);
  const countBySection = new Map<string, number>();
  for (const row of counts || []) {
    countBySection.set(row.section_id, (countBySection.get(row.section_id) || 0) + 1);
  }

  return sections
    .map((s) => {
      const trip = s.trips as unknown as { name: string; completed: boolean };
      return {
        sectionId: s.id,
        sectionLabel: s.label,
        tripId: s.trip_id,
        tripName: trip.name,
        tripCompleted: trip.completed,
        entryCount: countBySection.get(s.id) || 0,
      };
    })
    .filter((c) => c.entryCount > 0)
    .sort((a, b) => {
      if (a.tripCompleted !== b.tripCompleted) return a.tripCompleted ? -1 : 1;
      return a.tripName.localeCompare(b.tripName);
    });
}

// Clones the given entries into `destSectionId` as new rows LINKED
// back to their own source (import_source_entry_id — see
// lib/entrySync.ts, which keeps them synced from here on: an edit to
// the source's own shared fields propagates into these automatically,
// and a brand-new entry added to the source later gets its own linked
// copy created here too). No pairing carried over (the destination
// tier never supports pairing, and carrying an old pairing across
// trips would risk a nonsensical cross-trip re-pair later); lands as
// already-Visited (that's the whole point of importing into a
// Previously Visited tier) with notes/concerns seeded from the source
// as a starting point — both are local-only from here on, editable
// independently even though the entry itself is otherwise locked (see
// entrySync's own SYNCED_ENTRY_FIELDS). Ranks continue after whatever
// this section's own highest rank already is, rather than restarting
// at 1 — a destination fed by more than one source calls this once per
// source, and restarting would collide with (and visually reorder)
// entries a previous source already linked in.
//
// Skips a source entry whose url already matches something already
// sitting in this section — a plain manual entry, or one already
// synced in from a DIFFERENT source (the same real place turning up
// in more than one of a multi-source destination's own sources, e.g.
// the same distillery on two different past trips' own lists). Same
// same-section match findEntryByUrl already uses for the manual add-
// entry flow, applied here so adding a 2nd/3rd/4th source doesn't pile
// up literal duplicates of anything the others already brought in.
// The skipped entry keeps whichever source it's already linked to (or
// stays a plain unlinked entry) — this never reassigns/merges an
// existing row onto the new source, just declines to create a second
// one.
export async function linkEntriesFromSource(
  supabase: SupabaseClient,
  sourceEntries: EntryRow[],
  destSectionId: string
): Promise<{ imported: number; skipped: number }> {
  if (sourceEntries.length === 0) return { imported: 0, skipped: 0 };
  const { data: existingRows, error: existingError } = await supabase
    .from("entries")
    .select("rank, url")
    .eq("section_id", destSectionId);
  if (existingError) throw new Error(existingError.message);
  const startRank = (existingRows || []).reduce((max, r) => (r.rank && r.rank > max ? r.rank : max), 0);
  const existingUrls = new Set((existingRows || []).filter((r) => r.url).map((r) => r.url));

  const toInsert = sourceEntries.filter((e) => !e.url || !existingUrls.has(e.url));
  const skipped = sourceEntries.length - toInsert.length;
  if (toInsert.length === 0) return { imported: 0, skipped };

  const rows = toInsert.map((e, i) => ({
    id: nanoid(8),
    section_id: destSectionId,
    import_source_entry_id: e.id,
    rank: startRank + i + 1,
    status: "active" as const,
    title: e.title,
    url: e.url,
    poster_image: e.poster_image,
    description: e.description,
    lat: e.lat,
    lng: e.lng,
    notes: e.notes,
    concerns: e.concerns,
    group_label: null,
    visited: true,
    visited_date: e.visited_date,
    data: e.data,
  }));
  const { error } = await supabase.from("entries").insert(rows);
  if (error) throw new Error(error.message);
  return { imported: rows.length, skipped };
}
