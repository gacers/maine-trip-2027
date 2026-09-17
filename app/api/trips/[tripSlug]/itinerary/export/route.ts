import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";
import { exportItineraryOrThrow } from "@/lib/itineraryDocExport";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Editor-level, same as building the itinerary itself (see the stops
// routes) — whoever can add/edit stops should be able to export them,
// not just an admin. Always the throwing version: this only ever runs
// from an explicit button click, so a real failure should reach
// whoever clicked it rather than vanish into a server log (same
// reasoning as /sheet-export using exportSectionOrThrow, not the
// never-throws exportSection).
export async function POST(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError, supabase } = await requireWriteAccess(request, trip.id, { minRole: "editor" });
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    const result = await exportItineraryOrThrow(supabase!, trip);
    return NextResponse.json({ docUrl: result.docUrl });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || "Export failed" }, { status: 500 });
  }
}
