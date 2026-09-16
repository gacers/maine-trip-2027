import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { getStopsForTrip, createStop } from "@/lib/itineraryStops";
import { requireWriteAccess } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  try {
    const supabase = await supabaseServer();
    const stops = await getStopsForTrip(supabase, trip.id);
    return NextResponse.json({ stops });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// Same access level as adding an entry (minRole: "editor") — building
// the itinerary is trip content, not an admin-only action.
export async function POST(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError, supabase } = await requireWriteAccess(request, trip.id, { minRole: "editor" });
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { entryId, title, url, lat, lng } = body;
  if (!entryId && !title) {
    return NextResponse.json({ error: "Either entryId or title is required" }, { status: 400 });
  }

  try {
    const stop = await createStop(supabase!, trip.id, {
      entryId: entryId || null,
      title: title || null,
      url: url || null,
      lat: lat === "" || lat == null ? null : lat,
      lng: lng === "" || lng == null ? null : lng,
      kind: body.kind,
      status: body.status,
      date: body.date || null,
      time: body.time || null,
      durationMinutes: body.durationMinutes ?? null,
      travelMode: body.travelMode,
      notes: body.notes || null,
    });
    return NextResponse.json({ stop }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
