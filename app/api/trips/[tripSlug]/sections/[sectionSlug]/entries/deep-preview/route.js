import { NextResponse } from "next/server";
import { getTripBySlug, getSectionBySlug } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";
import { triggerBrightDataAirbnbScrape, pollBrightDataSnapshot } from "@/lib/brightdataAirbnb";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// A slower, heavier-duty fallback for an Airbnb listing that beat both
// the fast /preview scraper and its own Apify attempt — see
// lib/brightdataAirbnb.js for why this is trigger+poll (client-driven)
// rather than one call: a real run has taken anywhere from ~8s to 135s
// in testing, too long for a single request/response cycle. Same auth
// as adding an entry (allowContributor: true) since it's only ever
// reached from the same Add form contributors already have access to.

async function resolveTripAndSection(tripSlug, sectionSlug) {
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return { notFound: NextResponse.json({ error: "Unknown trip" }, { status: 404 }) };
  const section = await getSectionBySlug(trip.id, sectionSlug);
  if (!section) return { notFound: NextResponse.json({ error: "Unknown section" }, { status: 404 }) };
  return { trip, section };
}

export async function POST(request, { params }) {
  const { tripSlug, sectionSlug } = await params;
  const { trip, notFound } = await resolveTripAndSection(tripSlug, sectionSlug);
  if (notFound) return notFound;

  const { error: authError } = await requireWriteAccess(request, trip.id, { allowContributor: true });
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  const snapshotId = await triggerBrightDataAirbnbScrape(body.url);
  if (!snapshotId) {
    return NextResponse.json(
      { error: "Deeper search isn't set up right now — fill in the fields manually instead." },
      { status: 503 }
    );
  }
  return NextResponse.json({ snapshotId });
}

export async function GET(request, { params }) {
  const { tripSlug, sectionSlug } = await params;
  const { trip, notFound } = await resolveTripAndSection(tripSlug, sectionSlug);
  if (notFound) return notFound;

  const { error: authError } = await requireWriteAccess(request, trip.id, { allowContributor: true });
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  const snapshotId = new URL(request.url).searchParams.get("snapshotId");
  if (!snapshotId) return NextResponse.json({ error: "snapshotId is required" }, { status: 400 });

  const result = await pollBrightDataSnapshot(snapshotId);
  return NextResponse.json(result);
}
