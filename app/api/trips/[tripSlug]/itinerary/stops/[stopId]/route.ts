import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { updateStop, deleteStop } from "@/lib/itineraryStops";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Updates any subset of a stop's own fields, or just its sortOrder —
// same "submit whichever fields you're changing" shape as the sections
// PATCH route. Backs both the edit-stop dialog and drag-to-reorder.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; stopId: string }> }
) {
  const { tripSlug, stopId } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError, supabase } = await requireSuperAdmin();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const stop = await updateStop(supabase!, trip.id, stopId, {
      title: body.title,
      url: body.url,
      lat: body.lat === "" ? null : body.lat,
      lng: body.lng === "" ? null : body.lng,
      kind: body.kind,
      status: body.status,
      date: body.date,
      time: body.time,
      durationMinutes: body.durationMinutes,
      travelMode: body.travelMode,
      notes: body.notes,
      sortOrder: body.sortOrder,
    });
    if (!stop) return NextResponse.json({ error: "Unknown stop" }, { status: 404 });
    return NextResponse.json({ stop });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; stopId: string }> }
) {
  const { tripSlug, stopId } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError, supabase } = await requireSuperAdmin();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    await deleteStop(supabase!, trip.id, stopId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
