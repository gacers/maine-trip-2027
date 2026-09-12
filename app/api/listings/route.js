import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { normalizeAirbnbUrl } from "@/lib/scrape";
import {
  getAllListings,
  appendListing,
  findListingByUrl,
  siteLinkFor,
} from "@/lib/sheets";

export async function GET() {
  try {
    const listings = await getAllListings();
    listings.sort((a, b) => {
      const ra = a.rank ?? Number.MAX_SAFE_INTEGER;
      const rb = b.rank ?? Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });
    return NextResponse.json({ listings });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, title, price, posterImage, lat, lng, notes } = body;
  if (!url || !title) {
    return NextResponse.json({ error: "url and title are required" }, { status: 400 });
  }

  let normalizedUrl;
  try {
    normalizedUrl = normalizeAirbnbUrl(url);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid URL" }, { status: 400 });
  }

  try {
    const existing = await findListingByUrl(normalizedUrl);
    if (existing) {
      return NextResponse.json(
        { error: "duplicate", existing },
        { status: 409 }
      );
    }

    const all = await getAllListings();
    const maxRank = all.reduce((max, l) => (l.rank && l.rank > max ? l.rank : max), 0);

    const id = nanoid(8);
    const listing = {
      id,
      rank: maxRank + 1,
      title,
      price: price || "",
      url: normalizedUrl,
      posterImage: posterImage || "",
      status: "active",
      archiveReason: "",
      lat: lat ?? "",
      lng: lng ?? "",
      notes: notes || "",
      createdAt: new Date().toISOString(),
      siteLink: siteLinkFor(id),
    };

    await appendListing(listing);
    return NextResponse.json({ listing }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
