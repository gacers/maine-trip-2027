import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireSuperAdmin } from "@/lib/auth";
import { exportItineraryOrThrow } from "@/lib/itineraryDocExport";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Same gate as the rest of the itinerary (super admin, see
// requireSuperAdmin) — this only ever runs from an explicit button
// click, so a real failure should reach whoever clicked it rather than
// vanish into a server log (same reasoning as /sheet-export using
// exportSectionOrThrow, not the never-throws exportSection).
export async function POST(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError, supabase } = await requireSuperAdmin();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    const result = await exportItineraryOrThrow(supabase!, trip);
    return NextResponse.json({ docUrl: result.docUrl });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || "Export failed" }, { status: 500 });
  }
}
