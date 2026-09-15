import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Admin-only: edits a trip's own top-level fields — name, subtitle,
// date range, and map_config (Points of Interest — see
// TripSettingsForm). There was previously no way to change any of
// these after creation at all.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
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

  const patch: Record<string, unknown> = {};
  if ("name" in body) patch.name = body.name;
  if ("subtitle" in body) patch.subtitle = body.subtitle || null;
  if ("startDate" in body) patch.start_date = body.startDate || null;
  if ("endDate" in body) patch.end_date = body.endDate || null;
  if ("nightsEstimate" in body) patch.nights_estimate = body.nightsEstimate || null;
  if ("mapConfig" in body) patch.map_config = body.mapConfig;

  const { data, error } = await supabase!.from("trips").update(patch).eq("id", trip.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trip: data });
}
