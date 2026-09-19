import { NextResponse, type NextRequest } from "next/server";
import { scrapeListing, normalizeListingUrl } from "@/lib/scrape";
import { getTripBySlug, getSectionBySlug } from "@/lib/sections";
import { findEntryByUrl, findEntryByUrlAnywhere } from "@/lib/entries";
import { requireReadAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; navGroupSlug: string; sectionSlug: string }> }
) {
  const { tripSlug, navGroupSlug, sectionSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });
  const section = await getSectionBySlug(trip.id, navGroupSlug, sectionSlug);
  if (!section) return NextResponse.json({ error: "Unknown section" }, { status: 404 });

  // findEntryByUrlAnywhere below can hand back another trip's entry's
  // title/description/photo/location — same access level as the
  // search route this mirrors (see requireReadAccess's own comment).
  const { error: authError, supabase } = await requireReadAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url } = body;
  if (!url || typeof url !== "string") return NextResponse.json({ error: "url is required" }, { status: 400 });

  let normalizedUrl;
  try {
    normalizedUrl = normalizeListingUrl(url);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid URL" }, { status: 400 });
  }

  const existing = await findEntryByUrl(supabase!, section.id, normalizedUrl);
  if (existing) return NextResponse.json({ duplicate: true, existing });

  // Someone's already documented this exact place in another trip or
  // section — link to it (see the entries POST route's own
  // importSourceEntryId handling) instead of re-scraping (which might
  // not even work a second time against a site that blocks repeat
  // automated requests) or making the visitor retype everything by
  // hand. Shared fields (title/description/photo/location/section
  // fields) stay locked to that row and update automatically when it
  // does; notes/concerns are the one thing that's genuinely local to
  // this trip, left for the form itself to collect.
  const reused = await findEntryByUrlAnywhere(supabase!, normalizedUrl, section.id);
  if (reused) {
    return NextResponse.json({
      duplicate: false,
      scraped: {
        normalizedUrl,
        title: reused.entry.title,
        description: reused.entry.description,
        price: null,
        posterImage: reused.entry.poster_image,
        lat: reused.entry.lat,
        lng: reused.entry.lng,
        warnings: [],
        cookieWarning: null,
      },
      reusedFrom: { entryId: reused.entry.id, tripName: reused.tripName, sectionLabel: reused.sectionLabel },
    });
  }

  const scraped = await scrapeListing(url);
  return NextResponse.json({ duplicate: false, scraped });
}
