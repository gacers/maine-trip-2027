import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { searchEntriesForItinerary } from "@/lib/itineraryStops";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Backs the "+ Add stop" dialog's "Link an existing entry" search —
// scoped to this trip only, same debounced-live-query shape as
// AddEntryForm's own cross-trip search (entries/search/route.ts).
export async function GET(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ matches: [] });

  try {
    const supabase = await supabaseServer();
    const matches = await searchEntriesForItinerary(supabase, trip.id, q);
    return NextResponse.json({ matches });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
