import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { getAllEntries, copyEntriesToSection } from "@/lib/entries";
import { requireWriteAccess } from "@/lib/auth";
import { exportSection } from "@/lib/sheetsExport";
import type { Section } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Copies one specific source section's entries (chosen from
// SectionsAdmin's own candidate picker — see the import-candidates
// route) into a destination section on this trip, identified directly
// by id (the caller already has it — either just created, or an
// existing row from this trip's own admin list). Admin-only (same
// default as creating the section itself); there's no contributor/
// editor use case for pulling in another trip's whole list at once.
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
  // Omitted entirely means "just clear" — the "toggle off"/undo case in
  // SectionsAdmin's own picker, only meaningful alongside `overwrite`.
  const sourceSectionId = (body.sourceSectionId as string | undefined)?.trim() || null;
  // Set by the client when it already warned the admin this would
  // replace what's currently in the section (see SectionsAdmin's own
  // picker) — re-running this later, after forgetting to pick a source
  // the first time, switching to a different one, or clearing it out
  // entirely, is exactly the point, but doing any of that against a
  // section that's since had real entries in it needs to actually
  // clear those first, or the result is just duplicates sitting next
  // to them, not a clean re-import.
  const overwrite = body.overwrite === true;
  if (!sectionId) return NextResponse.json({ error: "sectionId is required" }, { status: 400 });
  if (sectionId === sourceSectionId) {
    return NextResponse.json({ error: "Source and destination can't be the same section" }, { status: 400 });
  }
  if (!sourceSectionId && !overwrite) {
    return NextResponse.json({ error: "Nothing to do — pass a sourceSectionId, or overwrite to just clear" }, { status: 400 });
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

    let imported = 0;
    if (sourceSectionId) {
      const sourceEntries = await getAllEntries(supabase!, sourceSectionId);
      imported = await copyEntriesToSection(supabase!, sourceEntries, sectionId);
    }
    await exportSection(supabase!, trip, section as Section);
    return NextResponse.json({ imported });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
