import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug, getSectionBySlug } from "@/lib/sections";
import { searchEntriesByTitle } from "@/lib/entries";
import { requireReadAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Backs AddEntryForm's live "already on another trip?" dropdown — see
// searchEntriesByTitle. Debounced client-side; this route itself just
// answers whatever it's asked, one request at a time.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; navGroupSlug: string; sectionSlug: string }> }
) {
  const { tripSlug, navGroupSlug, sectionSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });
  const section = await getSectionBySlug(trip.id, navGroupSlug, sectionSlug);
  if (!section) return NextResponse.json({ error: "Unknown section" }, { status: 404 });

  // Same reasoning as the entries GET route — this is real content
  // (other trips' entry titles/descriptions/photos included, since
  // searchEntriesByTitle looks cross-trip for reuse candidates).
  const { error: authError, supabase } = await requireReadAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ matches: [] });

  const matches = await searchEntriesByTitle(supabase!, q, section.id);
  return NextResponse.json({
    matches: matches.map((m) => ({
      id: m.entry.id,
      title: m.entry.title,
      description: m.entry.description,
      posterImage: m.entry.poster_image,
      lat: m.entry.lat,
      lng: m.entry.lng,
      url: m.entry.url,
      tripName: m.tripName,
      sectionLabel: m.sectionLabel,
    })),
  });
}
