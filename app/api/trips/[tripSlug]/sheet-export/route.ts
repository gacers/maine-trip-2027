import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";
import { exportSectionOrThrow } from "@/lib/sheetsExport";
import type { Section } from "@/lib/types";

export const dynamic = "force-dynamic";

// Admin-only: exports every section of this trip right now, instead of
// waiting for the first real entry write to lazily create the
// spreadsheet (see lib/sheetsExport.ts's exportSection) — lets an
// admin get a live, shareable Sheet link right after setting up a
// trip, even with zero entries yet (an empty section still gets its
// own tab, just with a header row). Also doubles as "re-export
// everything now" once a Sheet already exists (see InviteLinksManager).
export async function POST(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError, supabase } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  const { data: sections, error: sectionsError } = await supabase
    .from("sections")
    .select("*, field_defs(*)")
    .eq("trip_id", trip.id);
  if (sectionsError) return NextResponse.json({ error: sectionsError.message }, { status: 500 });

  let result: { spreadsheetId: string; spreadsheetUrl: string } | null = null;
  try {
    // exportSectionOrThrow, not exportSection — this is the one place
    // a real failure needs to actually reach the person who clicked
    // the button, instead of silently logging server-side where they
    // have no way to look (confirmed live: a brand-new trip's export
    // failed with nothing but "Export failed — check server logs" to
    // go on, no logs the admin could actually see).
    for (const section of (sections as Section[]) || []) {
      const r = await exportSectionOrThrow(supabase, trip, section);
      if (r) {
        result = r;
        // exportSectionOrThrow reads trip.google_sheet_id/_url but
        // doesn't mutate the object it was passed — without this,
        // every section after the first would still see it as null
        // and each try to create its own spreadsheet.
        trip.google_sheet_id = r.spreadsheetId;
        trip.google_sheet_url = r.spreadsheetUrl;
      }
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || "Export failed" }, { status: 500 });
  }

  if (!result) {
    return NextResponse.json(
      { error: "Nothing to export yet — every section is either disabled or has no items in it." },
      { status: 400 }
    );
  }
  return NextResponse.json(result);
}
