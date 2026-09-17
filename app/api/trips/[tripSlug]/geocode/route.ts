import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireReadAccess } from "@/lib/auth";
import { getOrComputeReverseAddress, getOrComputeTown, getOrComputeForwardGeocode } from "@/lib/geocodeCache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Mode = "reverse-address" | "town" | "forward";
const VALID_MODES: Mode[] = ["reverse-address", "town", "forward"];

// Backs every geocoding lookup a trip's own pages make — EntryCard's
// address line, useListingMap's "Closest Town", and the various
// "type an address, find its coordinates" flows (AddEntryForm, the
// entry editor, trip settings' point-of-interest picker). Same access
// level as any other real content read (requireReadAccess), same
// reasoning as the sibling /directions route: cheap to compute once
// this app has real access to a trip, but still real Google API calls
// that shouldn't be runnable by a total stranger just because the
// endpoint exists.
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

  const mode = body.mode as Mode;
  if (!VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: `Invalid mode: ${mode}` }, { status: 400 });
  }

  try {
    if (mode === "forward") {
      const address = typeof body.address === "string" ? body.address.trim() : "";
      if (!address) return NextResponse.json({ error: "address is required" }, { status: 400 });
      const result = await getOrComputeForwardGeocode(supabase!, address);
      if (!result) return NextResponse.json({ error: "Couldn't find that address" }, { status: 404 });
      return NextResponse.json(result);
    }

    const lat = typeof body.lat === "number" ? body.lat : NaN;
    const lng = typeof body.lng === "number" ? body.lng : NaN;
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: "lat/lng are required" }, { status: 400 });
    }

    const result =
      mode === "town" ? await getOrComputeTown(supabase!, lat, lng) : await getOrComputeReverseAddress(supabase!, lat, lng);
    if (!result) return NextResponse.json({ error: "No result found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
