import { nanoid } from "nanoid";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServiceRole } from "@/lib/supabaseServer";
import { exportSection } from "@/lib/sheetsExport";
import { upsertCustomFieldTemplate } from "@/lib/customFieldTemplates";
import type { EntryRow, FieldDef, Section, Trip } from "@/lib/types";

// One-way sync for a section/entry imported from another one (see
// migration 0033_multi_source_import.sql and PrefillPanel's own "Sync
// from another section" flow). A destination can pull from more than
// one source at once (section_import_sources is one-destination-to-
// many-sources) — e.g. one trip's "Past Distilleries" fed by 4 earlier
// trips' own Distilleries lists side by side, added one at a time
// without disturbing entries already synced in from the others.
// entries.import_source_entry_id still links each individual entry to
// exactly one specific source entry regardless of how many total
// sources feed its own section. These functions are what actually push
// a source's own changes out to every destination whenever it
// changes. Always run as the service role, not whatever client the
// triggering request happened to be authorized as — a source and its
// destinations routinely belong to DIFFERENT trips, and propagating an
// edit there is a system consequence of the source's own edit, not
// something the editing trip's own session has (or needs) direct RLS
// permission for. Deliberately never throws to a CALLER that isn't
// itself an explicit sync operation — every call site below treats
// this as best-effort (same convention as the custom template capture
// calls elsewhere), so a propagation hiccup can't block the source's
// own edit from saving.

// The "shared, objective facts about the place" — flows one-way from
// a source entry into every entry synced from it. Trip-specific
// commentary (notes, concerns, visited/visitedDate, status) stays
// local to each trip even once linked, since those are genuinely
// about THIS trip's own relationship to the place, not the place
// itself.
const SYNCED_ENTRY_FIELDS = ["title", "url", "poster_image", "description", "lat", "lng", "country", "data"] as const;

export function isSyncedEntryFieldPatch(patch: Record<string, unknown>): boolean {
  return SYNCED_ENTRY_FIELDS.some((f) => f in patch);
}

// Re-exports one destination section's own Sheet after a sync
// propagation touched it — without this, a destination trip's website
// view updates live but its Sheet (a completely separate, request-
// scoped write everywhere else in this app) silently goes stale until
// someone happens to edit that section directly. exportSection itself
// never throws (see its own comment), so this is already best-effort;
// a missing trip/section (already deleted mid-propagation) just no-ops
// rather than erroring the whole propagation.
async function reExportSection(supabase: SupabaseClient, sectionId: string): Promise<void> {
  const { data } = await supabase.from("sections").select("*, field_defs(*), trips(*)").eq("id", sectionId).maybeSingle();
  if (!data) return;
  const { trips, ...section } = data as Section & { trips: Trip | null };
  if (!trips) return;
  await exportSection(supabase, trips, section as Section);
}

export async function isImportDestination(sectionId: string): Promise<boolean> {
  const supabase = supabaseServiceRole();
  const { data, error } = await supabase
    .from("section_import_sources")
    .select("id")
    .eq("destination_section_id", sectionId)
    .limit(1);
  if (error) throw new Error(error.message);
  return !!data && data.length > 0;
}

// Every destination section id currently pulling from this one source
// — shared by the field_defs/new-entry propagation below.
async function getDestinationSectionIds(supabase: SupabaseClient, sourceSectionId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("section_import_sources")
    .select("destination_section_id")
    .eq("source_section_id", sourceSectionId);
  if (error) throw new Error(error.message);
  return (data || []).map((r) => r.destination_section_id);
}

// Rebuilds one destination's own field_defs as the UNION of every
// source currently feeding it, not just whichever one changed —
// confirmed live as a real gap: a multi-source destination (e.g. Food
// & Drink fed by several past trips) lost fields that only existed on
// ONE of its sources (a trip-specific type tag like "Seafood Shack",
// added by hand on just that trip — see lib/sectionTemplates.ts's own
// comment) the moment any OTHER source's own change re-propagated,
// silently orphaning that field's own data on every entry synced in
// from the source that actually had it. Sources are merged in link
// order (section_import_sources.created_at — i.e. the order they were
// added to this destination); the first source to define a given key
// wins that key's exact definition, later sources only contribute keys
// not already covered. A synced entry's own `data` is keyed by field
// `key`, so every destination genuinely needs a field for every key
// any of its sources actually uses, not just the ones the most-
// recently-changed source happens to have.
// Best-effort — same convention as the sections POST/PATCH routes'
// own capture, applied here too so a field that only ever arrived at
// a section via propagation (never through the ordinary New/Edit
// Section form directly) still ends up pickable everywhere else via
// FieldDefsEditor's "+ Add existing field..." (confirmed live as a
// real gap: several fields — Ferry, Oyster Farm, Seafood Shack, Tea,
// Tour — existed on real sections for a long time without ever
// reaching custom_field_templates, since nothing had captured them
// when they were first added; backfilled once directly, this call is
// what keeps it from happening again for anything the *sync* paths
// bring in.
async function captureFieldTemplates(supabase: SupabaseClient, sectionId: string, fields: Partial<FieldDef>[]): Promise<void> {
  if (fields.length === 0) return;
  const { data: section } = await supabase.from("sections").select("trip_id").eq("id", sectionId).maybeSingle();
  if (!section) return;
  for (const f of fields) {
    if (!f.key || !f.label || !f.field_type) continue;
    await upsertCustomFieldTemplate(supabase, section.trip_id, {
      key: f.key,
      label: f.label,
      field_type: f.field_type,
      show_on_overview: !!f.show_on_overview,
      required: !!f.required,
      options: f.options || undefined,
    }).catch((err) => console.error("Field template capture failed:", err));
  }
}

async function syncFieldDefsForDestination(supabase: SupabaseClient, destinationSectionId: string): Promise<void> {
  const { data: links, error: linksError } = await supabase
    .from("section_import_sources")
    .select("source_section_id")
    .eq("destination_section_id", destinationSectionId)
    .order("created_at");
  if (linksError) throw new Error(linksError.message);
  const sourceIds = (links || []).map((l) => l.source_section_id);
  if (sourceIds.length === 0) return;

  const { data: allFieldDefs, error: fdError } = await supabase
    .from("field_defs")
    .select("key, label, field_type, storage, core_column, show_on_overview, required, options, sort_order, section_id")
    .in("section_id", sourceIds);
  if (fdError) throw new Error(fdError.message);

  const sourceRank = new Map(sourceIds.map((id, i) => [id, i]));
  const bySource = [...(allFieldDefs || [])].sort((a, b) => {
    const rankDiff = (sourceRank.get(a.section_id) ?? 0) - (sourceRank.get(b.section_id) ?? 0);
    return rankDiff !== 0 ? rankDiff : (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  const merged = new Map<string, Partial<FieldDef> & { section_id: string }>();
  for (const f of bySource) {
    if (!merged.has(f.key)) merged.set(f.key, f);
  }

  const { error: delError } = await supabase.from("field_defs").delete().eq("section_id", destinationSectionId);
  if (delError) throw new Error(delError.message);
  const mergedDefs = [...merged.values()];
  if (mergedDefs.length > 0) {
    const rows = mergedDefs.map(({ section_id: _sourceId, ...f }, i) => ({ ...f, section_id: destinationSectionId, sort_order: i }));
    const { error: insError } = await supabase.from("field_defs").insert(rows);
    if (insError) throw new Error(insError.message);
    await captureFieldTemplates(supabase, destinationSectionId, rows);
  }
  await reExportSection(supabase, destinationSectionId);
}

// Called after a source section's own field_defs are saved (or a new
// source link is added/removed) — re-syncs every destination
// currently pointing at this source, each recomputed from ALL of its
// own sources (see syncFieldDefsForDestination), not just this one.
export async function propagateFieldDefsFromSource(sourceSectionId: string): Promise<void> {
  const supabase = supabaseServiceRole();
  const destSectionIds = await getDestinationSectionIds(supabase, sourceSectionId);
  for (const destId of destSectionIds) {
    await syncFieldDefsForDestination(supabase, destId);
  }
}

// Additive-only counterpart for a hand-picked, non-ongoing import (see
// PrefillPanel's "pick specific spots" — the picked entries stay live-
// synced individually via their own import_source_entry_id, same as a
// whole-section sync, but this destination never becomes a real
// section_import_sources destination: no field_defs lock, no auto-
// pulling in whatever the source adds next). Adds any of the source
// section's own field keys the destination doesn't already have, so
// the picked entries' own `data` (keyed by those fields) is actually
// visible/editable — never deletes or reorders a field the
// destination already has, unlike syncFieldDefsForDestination's own
// full rebuild for a real ongoing source.
export async function seedMissingFieldDefsFromSource(sourceSectionId: string, destinationSectionId: string): Promise<void> {
  const supabase = supabaseServiceRole();
  const { data: destFieldDefs, error: destError } = await supabase
    .from("field_defs")
    .select("key, sort_order")
    .eq("section_id", destinationSectionId);
  if (destError) throw new Error(destError.message);
  const existingKeys = new Set((destFieldDefs || []).map((f) => f.key));
  let nextSortOrder = (destFieldDefs || []).reduce((max, f) => (f.sort_order > max ? f.sort_order : max), -1) + 1;

  const { data: sourceFieldDefs, error: sourceError } = await supabase
    .from("field_defs")
    .select("key, label, field_type, storage, core_column, show_on_overview, required, options")
    .eq("section_id", sourceSectionId)
    .order("sort_order");
  if (sourceError) throw new Error(sourceError.message);
  const missing = (sourceFieldDefs || []).filter((f) => !existingKeys.has(f.key));
  if (missing.length === 0) return;

  const rows = missing.map((f) => ({ ...f, section_id: destinationSectionId, sort_order: nextSortOrder++ }));
  const { error: insError } = await supabase.from("field_defs").insert(rows);
  if (insError) throw new Error(insError.message);
  await captureFieldTemplates(supabase, destinationSectionId, rows);
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

  const { data: updated, error: updError } = await supabase
    .from("entries")
    .update(patch)
    .eq("import_source_entry_id", sourceEntryId)
    .select("section_id");
  if (updError) throw new Error(updError.message);

  // One linked entry per destination SECTION (not per trip — two
  // sections in the same trip could each import this same source
  // independently), so re-export each one actually touched.
  const sectionIds = new Set((updated || []).map((e) => e.section_id));
  for (const sectionId of sectionIds) await reExportSection(supabase, sectionId);
}

// Creates a linked copy of a brand-new source entry in every section
// that imports from its own section — called after a new entry is
// created directly in a section that turns out to be someone else's
// import source. Same shape lib/entries.ts's linkEntriesFromSource
// establishes at initial-import time (already-Visited, no pairing),
// including the same url-based duplicate skip: a destination fed by
// more than one source can already have this same real place synced
// in from a DIFFERENT source (or added there manually) by the time
// this one gets it too.
export async function propagateNewEntryFromSource(sourceEntry: EntryRow): Promise<void> {
  const supabase = supabaseServiceRole();
  const destSectionIds = await getDestinationSectionIds(supabase, sourceEntry.section_id);
  if (destSectionIds.length === 0) return;

  for (const destId of destSectionIds) {
    const { data: existingRows, error: ranksError } = await supabase.from("entries").select("rank, url").eq("section_id", destId);
    if (ranksError) throw new Error(ranksError.message);
    if (sourceEntry.url && (existingRows || []).some((r) => r.url === sourceEntry.url)) continue;
    const maxRank = (existingRows || []).reduce((max, r) => (r.rank && r.rank > max ? r.rank : max), 0);

    const { error: insError } = await supabase.from("entries").insert({
      id: nanoid(8),
      section_id: destId,
      import_source_entry_id: sourceEntry.id,
      rank: maxRank + 1,
      status: "active",
      title: sourceEntry.title,
      url: sourceEntry.url,
      poster_image: sourceEntry.poster_image,
      description: sourceEntry.description,
      lat: sourceEntry.lat,
      lng: sourceEntry.lng,
      country: sourceEntry.country,
      notes: sourceEntry.notes,
      concerns: sourceEntry.concerns,
      visited: true,
      data: sourceEntry.data,
    });
    if (insError) throw new Error(insError.message);
    await reExportSection(supabase, destId);
  }
}

export interface ImportSourceInfo {
  sourceSectionId: string;
  tripSlug: string;
  tripName: string;
  navGroupSlug: string;
  sectionSlug: string;
  sectionLabel: string;
}

// Resolves every source currently feeding one destination section into
// everything SectionForm needs to show "synced from X, Y, Z" and link
// straight to each — a plain join, not itself part of the sync
// mechanism above. Empty array (not null) when the section isn't a
// destination at all, so callers can treat "locked" as simply
// `sources.length > 0`.
export async function getImportSourcesForSection(destinationSectionId: string): Promise<ImportSourceInfo[]> {
  const supabase = supabaseServiceRole();
  const { data: links, error: linksError } = await supabase
    .from("section_import_sources")
    .select("source_section_id")
    .eq("destination_section_id", destinationSectionId)
    .order("created_at");
  if (linksError) throw new Error(linksError.message);
  if (!links || links.length === 0) return [];

  const { data, error } = await supabase
    .from("sections")
    .select("id, slug, label, nav_groups(slug), trips(slug, name)")
    .in(
      "id",
      links.map((l) => l.source_section_id)
    );
  if (error) throw new Error(error.message);

  // Preserve section_import_sources' own created-at order (the order
  // sources were added in), not whatever order the `in(...)` query
  // happens to return.
  const byId = new Map((data || []).map((d) => [d.id, d]));
  const infos: ImportSourceInfo[] = [];
  for (const link of links) {
    const d = byId.get(link.source_section_id);
    if (!d) continue;
    const navGroup = d.nav_groups as unknown as { slug: string } | null;
    const trip = d.trips as unknown as { slug: string; name: string } | null;
    if (!navGroup || !trip) continue;
    infos.push({
      sourceSectionId: d.id,
      tripSlug: trip.slug,
      tripName: trip.name,
      navGroupSlug: navGroup.slug,
      sectionSlug: d.slug,
      sectionLabel: d.label,
    });
  }
  return infos;
}

export interface ImportSourceEntryInfo extends Omit<ImportSourceInfo, "sourceSectionId"> {
  /** Anchor to jump straight to the source entry's own card — same
   * "#listing-<id>" convention every entry-linking href already uses
   * (see StopCard's own href builder). */
  entryId: string;
}

// Same idea as getImportSourcesForSection, one level down — resolves a
// locked entry's own ONE source entry (an entry is always linked to a
// single specific row, never several, regardless of how many total
// sources feed its section) into everything the entry edit form needs
// to link straight to it.
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
