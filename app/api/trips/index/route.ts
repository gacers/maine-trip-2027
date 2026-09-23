import { NextResponse } from "next/server";
import { getTripsIndexData } from "@/lib/tripsIndex";

/** Trips index payload — app/(home)/page.tsx now calls getTripsIndexData
 * directly (real SSR, no round trip to this same server); kept as a
 * plain route in case anything else ever wants this shape over HTTP. */
export async function GET() {
  try {
    const data = await getTripsIndexData();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
