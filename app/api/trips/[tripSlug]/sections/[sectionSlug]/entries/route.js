import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getTripBySlug, getSectionBySlug } from "@/lib/sections";
import { getAllEntries, findEntryByUrl, createEntry, toClientEntry } from "@/lib/entries";
import { getRatingsForEntries, summarizeRatings } from "@/lib/ratings";
import { requireWriteAccess } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { normalizeListingUrl } from "@/lib/scrape";
import { extractCount } from "@/lib/fieldTypes/count";
import { exportSection } from "@/lib/sheetsExport";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveTripAndSection(tripSlug, sectionSlug) {
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return { notFound: NextResponse.json({ error: "Unknown trip" }, { status: 404 }) };
  const section = await getSectionBySlug(trip.id, sectionSlug);
  if (!section) return { notFound: NextResponse.json({ error: "Unknown section" }, { status: 404 }) };
  return { trip, section };
}

export async function GET(request, { params }) {
  const { tripSlug, sectionSlug } = await params;
  const { trip, section, notFound } = await resolveTripAndSection(tripSlug, sectionSlug);
  if (notFound) return notFound;

  try {
    const supabase = await supabaseServer();
    const entries = await getAllEntries(supabase, section.id);
    let clientEntries = entries.map(toClientEntry);

    if (section.supports_ratings) {
      const ratingsByEntry = await getRatingsForEntries(
        supabase,
        entries.map((e) => e.id)
      );
      // Best-effort — a visitor with no access at all just gets averages,
      // myScore stays null rather than the request failing.
      const { raterKey } = await requireWriteAccess(request, trip.id, { allowContributor: true });
      clientEntries = clientEntries.map((e) => ({
        ...e,
        ...summarizeRatings(ratingsByEntry[e.id], raterKey),
      }));
    }

    return NextResponse.json({ trip, section, entries: clientEntries });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const { tripSlug, sectionSlug } = await params;
  const { trip, section, notFound } = await resolveTripAndSection(tripSlug, sectionSlug);
  if (notFound) return notFound;

  const { error: authError, supabase } = await requireWriteAccess(request, trip.id, {
    allowContributor: true,
  });
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, title, posterImage, description, lat, lng, notes, concerns, groupLabel, data } = body;
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
    const existing = await findEntryByUrl(supabase, section.id, normalizedUrl);
    if (existing) {
      return NextResponse.json({ error: "duplicate", existing: toClientEntry(existing) }, { status: 409 });
    }

    const all = await getAllEntries(supabase, section.id);
    const maxRank = all.reduce((max, e) => (e.rank && e.rank > max ? e.rank : max), 0);

    // Auto-fill any "count"-type field not explicitly given, from the
    // description text — generalizes today's bedroom/bed/bathroom
    // auto-extraction to whichever count fields this section defines.
    const filledData = { ...(data || {}) };
    for (const fieldDef of section.field_defs) {
      if (fieldDef.field_type === "count" && fieldDef.storage === "jsonb") {
        const has = filledData[fieldDef.key] !== undefined && filledData[fieldDef.key] !== "";
        if (!has) {
          const extracted = extractCount(description, fieldDef);
          if (extracted !== "") filledData[fieldDef.key] = extracted;
        }
      }
    }

    const entry = await createEntry(supabase, {
      id: nanoid(8),
      section_id: section.id,
      rank: maxRank + 1,
      status: "active",
      title,
      url: normalizedUrl,
      poster_image: posterImage || null,
      description: description || null,
      lat: lat ?? null,
      lng: lng ?? null,
      notes: notes || null,
      concerns: concerns || null,
      group_label: groupLabel || null,
      data: filledData,
    });
    await exportSection(supabase, trip, section);
    return NextResponse.json({ entry: toClientEntry(entry) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
