import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { findEntriesForConceptSlug, copyEntriesToSection } from "@/lib/entries";
import { requireWriteAccess } from "@/lib/auth";
import { exportSection } from "@/lib/sheetsExport";
import type { Section } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Bulk-populates a section (identified directly by id, not by nav
// group/section slug — the caller just created it and already has the
// id from that response, no need to re-derive its nav group's own
// slug) from every matching same-concept section on every OTHER trip —
// see lib/entries.ts's findEntriesForConceptSlug/copyEntriesToSection.
// Admin-only (same default as creating the section itself); there's no
// contributor/editor use case for pulling in another trip's whole list
// at once.
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
  const conceptSlug = (body.conceptSlug as string | undefined)?.trim();
  // Set by the client when it already warned the admin this would
  // replace what's currently in the section (see SectionsAdmin's
  // copyIntoExistingSection) — running this again later, after
  // forgetting to check the box the first time, is exactly the point,
  // but re-running it against a section that's since had real entries
  // added by hand needs to actually clear those first or the result is
  // just duplicates sitting next to them, not a clean re-import.
  const overwrite = body.overwrite === true;
  if (!sectionId || !conceptSlug) {
    return NextResponse.json({ error: "sectionId and conceptSlug are required" }, { status: 400 });
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

    if (overwrite) {
      const { error: deleteError } = await supabase!.from("entries").delete().eq("section_id", sectionId);
      if (deleteError) throw new Error(deleteError.message);
    }

    const sourceEntries = await findEntriesForConceptSlug(supabase!, conceptSlug, trip.id);
    const imported = await copyEntriesToSection(supabase!, sourceEntries, sectionId);
    await exportSection(supabase!, trip, section as Section);
    return NextResponse.json({ imported });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
