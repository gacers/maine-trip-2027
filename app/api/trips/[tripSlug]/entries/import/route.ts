import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { getAllEntries, linkEntriesFromSource } from "@/lib/entries";
import { requireWriteAccess } from "@/lib/auth";
import { exportSection } from "@/lib/sheetsExport";
import { propagateFieldDefsFromSource, getImportSourcesForSection } from "@/lib/entrySync";
import type { Section } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Every source currently feeding this one section — backs PrefillPanel's
// own "currently synced from" list (so it knows what's already linked,
// both to render it and to exclude those from the "add another
// source" picker).
export async function GET(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  const sectionId = (new URL(request.url).searchParams.get("sectionId") || "").trim();
  if (!sectionId) return NextResponse.json({ error: "sectionId is required" }, { status: 400 });

  try {
    const sources = await getImportSourcesForSection(sectionId);
    return NextResponse.json({ sources });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// Adds or removes ONE source link at a time (section_import_sources —
// see migration 0033_multi_source_import.sql) — a destination can pull
// from several sources at once, added and removed independently
// without disturbing entries already synced in from the others. This
// is an ONGOING sync from here on, not a one-time copy (see
// lib/entrySync.ts): the destination's own field_defs mirror every
// linked source's (assumed structurally identical — see
// lib/customSectionTemplates.ts's own comment), and every entry copied
// in stays linked to its own source row, picking up that source's own
// future edits automatically. Admin-only (same default as creating the
// section itself); there's no contributor/editor use case for pulling
// in another trip's whole list at once.
export async function POST(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError, supabase } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const sectionId = (body.sectionId as string | undefined)?.trim();
  const sourceSectionId = (body.sourceSectionId as string | undefined)?.trim();
  const action = body.action === "remove" ? "remove" : "add";
  // Set by the client when it already warned the admin this would
  // delete what's currently in the section that ISN'T linked to any
  // source (see PrefillPanel's own confirm dialog) — a first source
  // added to a section that already has plain, never-synced entries in
  // it needs those cleared first, or the result is duplicates sitting
  // next to them, not a clean sync.
  const clearUnsynced = body.clearUnsynced === true;
  if (!sectionId || !sourceSectionId) {
    return NextResponse.json({ error: "sectionId and sourceSectionId are required" }, { status: 400 });
  }
  if (sectionId === sourceSectionId) {
    return NextResponse.json({ error: "Source and destination can't be the same section" }, { status: 400 });
  }

  try {
    // Belt and suspenders — confirms `sectionId` actually belongs to
    // this trip rather than trusting the client's own claim, same as
    // every other route here that takes an id straight from the body.
    const { data: section, error: sectionError } = await supabase!
      .from("sections")
      .select("*, field_defs(*)")
      .eq("id", sectionId)
      .eq("trip_id", trip.id)
      .maybeSingle();
    if (sectionError) throw new Error(sectionError.message);
    if (!section) return NextResponse.json({ error: "Unknown section" }, { status: 404 });

    if (action === "remove") {
      const { error: unlinkError } = await supabase!
        .from("section_import_sources")
        .delete()
        .eq("destination_section_id", sectionId)
        .eq("source_section_id", sourceSectionId);
      if (unlinkError) throw new Error(unlinkError.message);

      // Only this source's own linked entries go — anything synced in
      // from a different, still-linked source (or plain manual
      // entries) stays exactly as it was.
      const { data: sourceEntryIds, error: sourceEntriesError } = await supabase!
        .from("entries")
        .select("id")
        .eq("section_id", sourceSectionId);
      if (sourceEntriesError) throw new Error(sourceEntriesError.message);
      const ids = (sourceEntryIds || []).map((e) => e.id);
      let removed = 0;
      if (ids.length > 0) {
        const { data: deleted, error: deleteError } = await supabase!
          .from("entries")
          .delete()
          .eq("section_id", sectionId)
          .in("import_source_entry_id", ids)
          .select("id");
        if (deleteError) throw new Error(deleteError.message);
        removed = (deleted || []).length;
      }

      const { data: freshSection, error: freshError } = await supabase!
        .from("sections")
        .select("*, field_defs(*)")
        .eq("id", sectionId)
        .single();
      if (freshError) throw new Error(freshError.message);
      await exportSection(supabase!, trip, freshSection as Section);
      return NextResponse.json({ removed });
    }

    // action === "add"
    if (clearUnsynced) {
      const { error: deleteError } = await supabase!
        .from("entries")
        .delete()
        .eq("section_id", sectionId)
        .is("import_source_entry_id", null);
      if (deleteError) throw new Error(deleteError.message);
    }

    const { error: linkError } = await supabase!
      .from("section_import_sources")
      .upsert({ destination_section_id: sectionId, source_section_id: sourceSectionId }, { onConflict: "destination_section_id,source_section_id" });
    if (linkError) throw new Error(linkError.message);

    // Mirrors every linked destination's field_defs to this source's
    // (looks up every destination pointing at sourceSectionId — this
    // one, now, plus any others already linked to it — and applies
    // them all in one pass, rather than duplicating that logic here).
    await propagateFieldDefsFromSource(sourceSectionId);
    const sourceEntries = await getAllEntries(supabase!, sourceSectionId);
    const imported = await linkEntriesFromSource(supabase!, sourceEntries, sectionId);

    // Re-fetched, not the `section` looked up at the top — its own
    // field_defs just got overwritten (mirrored from the source)
    // above, and exportSection needs the current ones to build the
    // Sheet tab's actual columns, not whatever they were before this
    // request started.
    const { data: freshSection, error: freshError } = await supabase!
      .from("sections")
      .select("*, field_defs(*)")
      .eq("id", sectionId)
      .single();
    if (freshError) throw new Error(freshError.message);
    await exportSection(supabase!, trip, freshSection as Section);
    return NextResponse.json({ imported });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
