import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireReadAccess } from "@/lib/auth";
import { getOrComputeRoute } from "@/lib/routeCache";
import type { TravelMode } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_TRAVEL_MODES: TravelMode[] = ["driving", "walking", "transit", "bicycling"];

function isLatLng(v: unknown): v is { lat: number; lng: number } {
  return !!v && typeof v === "object" && typeof (v as { lat: unknown }).lat === "number" && typeof (v as { lng: unknown }).lng === "number";
}

// The general-purpose sibling of /itinerary/directions — same
// getOrComputeRoute/route_cache underneath, but gated at the ordinary
// requireReadAccess level (any trip viewer) rather than requireSuperAdmin,
// since this backs an everyday feature (useListingMap's house-to-town/
// closest-point driving times, shown on regular listing cards) rather
// than the still-private itinerary. Kept as a separate route rather
// than reusing /itinerary/directions itself so the two features' access
// levels can never accidentally leak into each other.
export async function POST(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError, supabase } = await requireReadAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { from, to } = body;
  const travelMode = (body.travelMode as TravelMode) || "driving";
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
