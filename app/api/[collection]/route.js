import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { normalizeListingUrl } from "@/lib/scrape";
import { getCollectionBySlug } from "@/lib/collections";
import { extractCounts } from "@/lib/extractCounts";
import {
  getAllItems,
  appendItem,
  findItemByUrl,
  siteLinkFor,
  getOverviewSheetUrl,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request, { params }) {
  const { collection: slug } = await params;
  const collection = getCollectionBySlug(slug);
  if (!collection) {
    return NextResponse.json({ error: "Unknown collection" }, { status: 404 });
  }

  try {
    const listings = await getAllItems(collection);
    listings.sort((a, b) => {
      const ra = a.rank ?? Number.MAX_SAFE_INTEGER;
      const rb = b.rank ?? Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });
    const sheetUrl = await getOverviewSheetUrl(collection, listings);
    return NextResponse.json({ listings, sheetUrl });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

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

  const {
    url,
    title,
    price,
    posterImage,
    description,
    lat,
    lng,
    notes,
    concerns,
    bedrooms,
    beds,
    bathrooms,
    groupLabel,
  } = body;
  if (!url || !title) {
    return NextResponse.json({ error: "url and title are required" }, { status: 400 });
  }

  let normalizedUrl;
  try {
    normalizedUrl = normalizeListingUrl(url);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid URL" }, { status: 400 });
  }

  try {
    const existing = await findItemByUrl(collection, normalizedUrl);
    if (existing) {
      return NextResponse.json({ error: "duplicate", existing }, { status: 409 });
    }

    const all = await getAllItems(collection);
    const maxRank = all.reduce((max, l) => (l.rank && l.rank > max ? l.rank : max), 0);

    // Fall back to parsing bedroom/bed/bathroom counts out of the
    // description when they aren't given explicitly.
    const counts = extractCounts(description);

    const id = nanoid(8);
    const listing = {
      id,
      rank: maxRank + 1,
      title,
      price: price || "",
      url: normalizedUrl,
      posterImage: posterImage || "",
      description: description || "",
      status: "active",
      archiveReason: "",
      lat: lat ?? "",
      lng: lng ?? "",
      extraMarkers: "",
      notes: notes || "",
      concerns: concerns || "",
      bedrooms: bedrooms !== undefined && bedrooms !== "" ? bedrooms : counts.bedrooms,
      beds: beds !== undefined && beds !== "" ? beds : counts.beds,
      bathrooms: bathrooms !== undefined && bathrooms !== "" ? bathrooms : counts.bathrooms,
      createdAt: new Date().toISOString(),
      siteLink: siteLinkFor(collection, id),
      groupLabel: groupLabel || "",
    };

    await appendItem(collection, listing);
    return NextResponse.json({ listing }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
