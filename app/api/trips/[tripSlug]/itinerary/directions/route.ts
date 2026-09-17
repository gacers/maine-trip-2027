import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireAdmin } from "@/lib/auth";
import { getOrComputeRoute } from "@/lib/routeCache";
import type { TravelMode } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_TRAVEL_MODES: TravelMode[] = ["driving", "walking", "transit", "bicycling"];

function isLatLng(v: unknown): v is { lat: number; lng: number } {
  return !!v && typeof v === "object" && typeof (v as { lat: unknown }).lat === "number" && typeof (v as { lng: unknown }).lng === "number";
}

// Backs RouteConnector — same access level as the rest of the
// itinerary (any admin, see requireAdmin), a POST rather than a
// GET since the origin/destination pair is arbitrary input, not a
// resource path. Almost every call hits route_cache instead of Google
// (see getOrComputeRoute) once a trip's stop-pairs have been asked for
// once.
export async function POST(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError, supabase } = await requireAdmin();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { from, to } = body;
  const travelMode = body.travelMode as TravelMode;
  if (!isLatLng(from) || !isLatLng(to)) {
    return NextResponse.json({ error: "from/to lat/lng are required" }, { status: 400 });
  }
  if (!VALID_TRAVEL_MODES.includes(travelMode)) {
    return NextResponse.json({ error: `Invalid travelMode: ${travelMode}` }, { status: 400 });
  }

  try {
    const route = await getOrComputeRoute(supabase!, from, to, travelMode);
    if (!route) return NextResponse.json({ error: "No route found" }, { status: 404 });
    return NextResponse.json(route);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
