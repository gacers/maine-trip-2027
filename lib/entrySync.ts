import { nanoid } from "nanoid";
import { supabaseServiceRole } from "@/lib/supabaseServer";
import type { EntryRow, FieldDef } from "@/lib/types";

// One-way sync for a section/entry imported from another one (see
// migration 0032_entry_import_sync.sql and PrefillPanel's own "Sync
// from another section" flow). A destination keeps pointing at its
// own source row via import_source_section_id/import_source_entry_id;
// these functions are what actually push a source's own changes out
// to every destination whenever it changes. Always run as the service
// role, not whatever client the triggering request happened to be
// authorized as — a source and its destinations routinely belong to
// DIFFERENT trips, and propagating an edit there is a system
// consequence of the source's own edit, not something the editing
// trip's own session has (or needs) direct RLS permission for.
// Deliberately never throws to a CALLER that isn't itself an explicit
// sync operation — every call site below treats this as best-effort
// (same convention as the custom template capture calls elsewhere),
// so a propagation hiccup can't block the source's own edit from
// saving.

// The "shared, objective facts about the place" — flows one-way from
// a source entry into every entry synced from it. Trip-specific
// commentary (notes, concerns, visited/visitedDate, status) stays
// local to each trip even once linked, since those are genuinely
// about THIS trip's own relationship to the place, not the place
// itself.
const SYNCED_ENTRY_FIELDS = ["title", "url", "poster_image", "description", "lat", "lng", "data"] as const;

export function isSyncedEntryFieldPatch(patch: Record<string, unknown>): boolean {
  return SYNCED_ENTRY_FIELDS.some((f) => f in patch);
}

// Overwrites every destination section's own field_defs to mirror the
// source's exactly — called after a source section's own field_defs
// are saved. A synced entry's own `data` is keyed by field `key`, so
// every destination genuinely needs the same fields, not just
// similar ones, for that data to stay meaningful.
export async function propagateFieldDefsFromSource(sourceSectionId: string): Promise<void> {
  const supabase = supabaseServiceRole();
  const { data: destSections, error } = await supabase
    .from("sections")
    .select("id")
    .eq("import_source_section_id", sourceSectionId);
  if (error) throw new Error(error.message);
  if (!destSections || destSections.length === 0) return;

  const { data: sourceFieldDefs, error: fdError } = await supabase
    .from("field_defs")
    .select("key, label, field_type, storage, core_column, show_on_overview, required, options, sort_order")
    .eq("section_id", sourceSectionId)
    .order("sort_order");
  if (fdError) throw new Error(fdError.message);

  for (const dest of destSections) {
    const { error: delError } = await supabase.from("field_defs").delete().eq("section_id", dest.id);
    if (delError) throw new Error(delError.message);
    if (sourceFieldDefs && sourceFieldDefs.length > 0) {
      const rows = sourceFieldDefs.map((f: Partial<FieldDef>) => ({ ...f, section_id: dest.id }));
      const { error: insError } = await supabase.from("field_defs").insert(rows);
      if (insError) throw new Error(insError.message);
    }
  }
}

// Copies a source entry's own current shared fields into every entry
// synced from it — called after the source entry itself is saved.
export async function propagateEntryUpdateFromSource(sourceEntryId: string): Promise<void> {
  const supabase = supabaseServiceRole();
  const { data: source, error } = await supabase.from("entries").select("*").eq("id", sourceEntryId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!source) return;

  const patch: Record<string, unknown> = {};
  for (const field of SYNCED_ENTRY_FIELDS) patch[field] = (source as unknown as Record<string, unknown>)[field];

  const { error: updError } = await supabase.from("entries").update(patch).eq("import_source_entry_id", sourceEntryId);
  if (updError) throw new Error(updError.message);
}

// Creates a linked copy of a brand-new source entry in every section
// that imports from its own section — called after a new entry is
// created directly in a section that turns out to be someone else's
// import source. Same shape lib/entries.ts's linkEntriesFromSource
// establishes at initial-import time (already-Visited, no pairing).
export async function propagateNewEntryFromSource(sourceEntry: EntryRow): Promise<void> {
  const supabase = supabaseServiceRole();
  const { data: destSections, error } = await supabase
    .from("sections")
    .select("id")
    .eq("import_source_section_id", sourceEntry.section_id);
  if (error) throw new Error(error.message);
  if (!destSections || destSections.length === 0) return;

  for (const dest of destSections) {
    const { data: existingRows, error: ranksError } = await supabase.from("entries").select("rank").eq("section_id", dest.id);
    if (ranksError) throw new Error(ranksError.message);
    const maxRank = (existingRows || []).reduce((max, r) => (r.rank && r.rank > max ? r.rank : max), 0);

    const { error: insError } = await supabase.from("entries").insert({
      id: nanoid(8),
      section_id: dest.id,
      import_source_entry_id: sourceEntry.id,
      rank: maxRank + 1,
      status: "active",
      title: sourceEntry.title,
      url: sourceEntry.url,
      poster_image: sourceEntry.poster_image,
      description: sourceEntry.description,
      lat: sourceEntry.lat,
      lng: sourceEntry.lng,
      notes: sourceEntry.notes,
      concerns: sourceEntry.concerns,
      visited: true,
      data: sourceEntry.data,
    });
    if (insError) throw new Error(insError.message);
  }
}

export interface ImportSourceInfo {
  tripSlug: string;
  tripName: string;
  navGroupSlug: string;
  sectionSlug: string;
  sectionLabel: string;
}

// Resolves a locked section/entry's own source into everything
// SectionForm/the entry edit form need to show "synced from X" and
// link straight to it — a plain join, not itself part of the sync
// mechanism above.
export async function getImportSourceSectionInfo(sourceSectionId: string): Promise<ImportSourceInfo | null> {
  const supabase = supabaseServiceRole();
  const { data, error } = await supabase
    .from("sections")
    .select("slug, label, nav_groups(slug), trips(slug, name)")
    .eq("id", sourceSectionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const navGroup = data.nav_groups as unknown as { slug: string } | null;
  const trip = data.trips as unknown as { slug: string; name: string } | null;
  if (!navGroup || !trip) return null;
  return {
    tripSlug: trip.slug,
    tripName: trip.name,
    navGroupSlug: navGroup.slug,
    sectionSlug: data.slug,
    sectionLabel: data.label,
  };
}

export interface ImportSourceEntryInfo extends ImportSourceInfo {
  /** Anchor to jump straight to the source entry's own card — same
   * "#listing-<id>" convention every entry-linking href already uses
   * (see StopCard's own href builder). */
  entryId: string;
}

// Same idea as getImportSourceSectionInfo, one level down — resolves a
// locked entry's own source entry into everything the entry edit
// form needs to link straight to it.
export async function getImportSourceEntryInfo(sourceEntryId: string): Promise<ImportSourceEntryInfo | null> {
  const supabase = supabaseServiceRole();
  const { data, error } = await supabase
    .from("entries")
    .select("id, sections(slug, label, nav_groups(slug), trips(slug, name))")
    .eq("id", sourceEntryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const section = data.sections as unknown as {
    slug: string;
    label: string;
    nav_groups: { slug: string } | null;
    trips: { slug: string; name: string } | null;
  } | null;
  if (!section?.nav_groups || !section.trips) return null;
  return {
    tripSlug: section.trips.slug,
    tripName: section.trips.name,
    navGroupSlug: section.nav_groups.slug,
    sectionSlug: section.slug,
    sectionLabel: section.label,
    entryId: data.id,
  };
}
