import { NextResponse } from "next/server";
import { scrapeListing, normalizeListingUrl } from "@/lib/scrape";
import { getCollectionBySlug } from "@/lib/collections";
import { findItemByUrl } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request, { params }) {
  const { collection: slug } = await params;
  const collection = getCollectionBySlug(slug);
  if (!collection) {
    return NextResponse.json({ error: "Unknown collection" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url } = body;
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let normalizedUrl;
  try {
    normalizedUrl = normalizeListingUrl(url);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid URL" }, { status: 400 });
  }

  const existing = await findItemByUrl(collection, normalizedUrl);
  if (existing) {
    return NextResponse.json({ duplicate: true, existing });
  }

  const scraped = await scrapeListing(url);
  return NextResponse.json({ duplicate: false, scraped });
}
