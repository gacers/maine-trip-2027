import { NextResponse, type NextRequest } from "next/server";
import { scrapeListing, normalizeListingUrl } from "@/lib/scrape";
import { getTripBySlug, getSectionBySlug } from "@/lib/sections";
import { findEntryByUrl } from "@/lib/entries";
import { supabaseServer } from "@/lib/supabaseServer";

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

  const supabase = await supabaseServer();
  const existing = await findEntryByUrl(supabase, section.id, normalizedUrl);
  if (existing) return NextResponse.json({ duplicate: true, existing });

  const scraped = await scrapeListing(url);
  return NextResponse.json({ duplicate: false, scraped });
}
