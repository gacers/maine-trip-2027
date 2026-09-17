import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { getAllEntriesForItinerary } from "@/lib/itineraryStops";
import { requireReadAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Backs the "+ Add stop" dialog's "Link an existing entry" picker —
// every entry in this trip, grouped client-side into a type ("which
// section") dropdown and then a "which one" dropdown, rather than a
// name search (you often remember which list something's on before
// its exact name). Same access level as the itinerary itself.
export async function GET(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError, supabase } = await requireReadAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    const entries = await getAllEntriesForItinerary(supabase!, trip.id);
    return NextResponse.json({ entries });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
