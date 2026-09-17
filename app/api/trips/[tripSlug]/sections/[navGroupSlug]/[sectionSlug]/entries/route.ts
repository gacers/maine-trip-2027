import { NextResponse, type NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getTripBySlug, getSectionBySlug, sanitizeTripForClient } from "@/lib/sections";
import { getAllEntries, findEntryByUrl, createEntry, toClientEntry } from "@/lib/entries";
import { getRatingsForEntries, summarizeRatings, resolveRaterKey } from "@/lib/ratings";
import { requireWriteAccess, requireReadAccess } from "@/lib/auth";
import { normalizeListingUrl } from "@/lib/scrape";
import { extractCount } from "@/lib/fieldTypes/count";
import { exportSection } from "@/lib/sheetsExport";
import { sectionHasOptionsTraits } from "@/lib/tripCompletion";
import type { Trip, Section } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveTripAndSection(
  tripSlug: string,
  navGroupSlug: string,
  sectionSlug: string
): Promise<{ trip: Trip; section: Section; notFound?: undefined } | { notFound: NextResponse; trip?: undefined; section?: undefined }> {
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return { notFound: NextResponse.json({ error: "Unknown trip" }, { status: 404 }) };
  const section = await getSectionBySlug(trip.id, navGroupSlug, sectionSlug);
  if (!section) return { notFound: NextResponse.json({ error: "Unknown section" }, { status: 404 }) };
  return { trip, section };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; navGroupSlug: string; sectionSlug: string }> }
) {
  const { tripSlug, navGroupSlug, sectionSlug } = await params;
  const { trip, section, notFound } = await resolveTripAndSection(tripSlug, navGroupSlug, sectionSlug);
  if (notFound) return notFound;

  // The actual content — gated so a stranger's browser (blocked by
  // TripAccessGate already, this is the direct-request backstop) can't
  // just fetch it anyway. Every legitimate caller already sends this
  // trip's authToken on this exact request (see useSectionEntries's
  // own authHeaders), so this is a no-op for them.
  const { error: authError, supabase, raterKey: accessKey } = await requireReadAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    const entries = await getAllEntries(supabase!, section.id);
    let clientEntries = entries.map((e) => toClientEntry(e));

    if (section.supports_ratings) {
      const ratingsByEntry = await getRatingsForEntries(
        supabase!,
        entries.map((e) => e.id)
      );
      const raterKey = resolveRaterKey(accessKey, request);
      clientEntries = clientEntries.map((e) => ({
        ...e,
        ...summarizeRatings(ratingsByEntry[e.id], raterKey ?? null),
      }));
    }

    // sanitizeTripForClient — a contributor's invite-link key gets
    // through requireReadAccess above same as an admin/editor does, and
    // that key holder specifically should never see trip.sheet_invite_token
    // (a real, live Sheet-editing secret — see lib/sections.ts).
    return NextResponse.json({ trip: sanitizeTripForClient(trip), section, entries: clientEntries });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; navGroupSlug: string; sectionSlug: string }> }
) {
  const { tripSlug, navGroupSlug, sectionSlug } = await params;
  const { trip, section, notFound } = await resolveTripAndSection(tripSlug, navGroupSlug, sectionSlug);
  if (notFound) return notFound;

  const { error: authError, supabase } = await requireWriteAccess(request, trip.id, {
    minRole: "editor",
  });
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, title, posterImage, description, lat, lng, notes, concerns, groupLabel, data } = body;
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // A "Start blank" entry (see AddEntryForm) has no URL at all, and
  // that's a fine, permanent state for it, not just a placeholder —
  // this route used to require one outright. No normalizing/duplicate-
  // checking to do without a URL either.
  let normalizedUrl: string | null = null;
  if (url) {
    try {
      normalizedUrl = normalizeListingUrl(url);
    } catch {
      return NextResponse.json({ error: "That doesn't look like a valid URL" }, { status: 400 });
    }
  }

  try {
    if (normalizedUrl) {
      const existing = await findEntryByUrl(supabase!, section.id, normalizedUrl);
      if (existing) {
        return NextResponse.json({ error: "duplicate", existing: toClientEntry(existing) }, { status: 409 });
      }
    }

    const all = await getAllEntries(supabase!, section.id);
    const maxRank = all.reduce((max, e) => (e.rank && e.rank > max ? e.rank : max), 0);

    // Auto-fill any "count"-type field not explicitly given, from the
    // description text — generalizes today's bedroom/bed/bathroom
    // auto-extraction to whichever count fields this section defines.
    const filledData: Record<string, unknown> = { ...(data || {}) };
    for (const fieldDef of section.field_defs || []) {
      if (fieldDef.field_type === "count" && fieldDef.storage === "jsonb") {
        const has = filledData[fieldDef.key] !== undefined && filledData[fieldDef.key] !== "";
        if (!has) {
          const extracted = extractCount(description, fieldDef);
          if (extracted !== "") filledData[fieldDef.key] = extracted;
        }
      }
    }

    // A completed trip's own non-options sections (no ranking/ratings/
    // pairing — see sectionHasOptionsTraits) are pure documentation:
    // whatever gets added is something that actually happened, not a
    // candidate to weigh, so it comes in already checked off instead of
    // needing a manual Stayed/Visited click for every single entry.
    // Still-deciding sections (an "options" section a documented trip
    // happens to keep around) are left alone — those genuinely need a
    // human decision either way.
    const autoVisited = trip.completed && !sectionHasOptionsTraits(section);

    const entry = await createEntry(supabase!, {
      id: nanoid(8),
      section_id: section.id,
      rank: maxRank + 1,
      status: "active",
      title,
      url: normalizedUrl,
      poster_image: posterImage || null,
      description: description || null,
      // A "Start blank"/never-geocoded entry sends these as "" (the
      // client's own empty-input default), not undefined — `?? null`
      // alone doesn't catch that, and an empty string sent straight to
      // a double precision column is a real Postgres error, not a
      // silent no-op.
      lat: lat === "" || lat == null ? null : lat,
      lng: lng === "" || lng == null ? null : lng,
      notes: notes || null,
      concerns: concerns || null,
      group_label: groupLabel || null,
      visited: autoVisited,
      data: filledData,
    });
    await exportSection(supabase!, trip, section);
    return NextResponse.json({ entry: toClientEntry(entry) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
