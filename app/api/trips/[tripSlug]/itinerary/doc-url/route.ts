import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Same reasoning as /sheet-url — trip.google_itinerary_doc_url must
// never reach the page's own props for anyone who hasn't proven access
// (see sanitizeTripForClient, which strips it before ItineraryPage ever
// renders). The client fetches it here, with real auth, only once it
// already knows it has access. Gated the same as the rest of the
// itinerary (super admin, see requireSuperAdmin), not the ordinary
// trip-editor level /sheet-url uses.
export async function GET(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError } = await requireSuperAdmin();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  return NextResponse.json({ googleItineraryDocUrl: trip.google_itinerary_doc_url || null });
}
