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
import { propagateNewEntryFromSource, seedMissingFieldDefsFromSource } from "@/lib/entrySync";
import { resolveEntryCountry } from "@/lib/resolveEntryCountry";
import type { Trip, Section, EntryRow } from "@/lib/types";

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
  // Set by AddEntryForm when the preview route's own findEntryByUrlAnywhere
  // found this exact url already documented elsewhere and the admin
  // kept the match (didn't change the url away from it) — see below.
  const importSourceEntryId = typeof body.importSourceEntryId === "string" ? body.importSourceEntryId.trim() || null : null;
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

    // A completed trip's own non-options sections (no ranking/ratings/
    // pairing — see sectionHasOptionsTraits) are pure documentation:
    // whatever gets added is something that actually happened, not a
    // candidate to weigh, so it comes in already checked off instead of
    // needing a manual Stayed/Visited click for every single entry.
    // Still-deciding sections (an "options" section a documented trip
    // happens to keep around) are left alone — those genuinely need a
    // human decision either way.
    const autoVisited = trip.completed && !sectionHasOptionsTraits(section);

    // Same real place already documented somewhere else — link to it
    // instead of copying its facts into an independent row (see the
    // preview route's own findEntryByUrlAnywhere, which is what found
    // this in the first place). Shared fields come from THAT row's
    // current values, not whatever the client happened to submit for
    // them (locked/disabled in the form for exactly this reason) — an
    // edit there propagates here automatically from here on, same as
    // any other entrySync link (see lib/entrySync.ts). Notes/concerns
    // stay exactly what was typed into this trip's own form: genuinely
    // local commentary, not something to inherit or merge.
    // Walks up to whatever's at the TOP of any import_source_entry_id
    // chain — lib/entries.ts's own search/preview results already
    // resolve to this before ever reaching the client, but a link
    // straight to a live-synced COPY instead of the real original
    // would silently stop receiving updates once more than one hop
    // away (propagation only travels one hop — see lib/entrySync.ts),
    // so this is worth guaranteeing here too regardless of what the
    // client actually sent.
    let matchedSource: EntryRow | null = null;
    if (importSourceEntryId) {
      let nextId: string | null = importSourceEntryId;
      const seen = new Set<string>();
      for (let hops = 0; nextId && hops < 10; hops++) {
        const { data: sourceRow, error: sourceError } = await supabase!.from("entries").select("*").eq("id", nextId).maybeSingle();
        if (sourceError) throw new Error(sourceError.message);
        if (!sourceRow || seen.has(sourceRow.id)) break;
        seen.add(sourceRow.id);
        matchedSource = sourceRow;
        nextId = sourceRow.import_source_entry_id;
      }
    }

    let entry;
    if (matchedSource) {
      // Additive only — brings in any field key the matched entry's own
      // `data` actually uses that this section doesn't already have,
      // without touching (or locking) anything this section already
      // defines.
      await seedMissingFieldDefsFromSource(matchedSource.section_id, section.id);
      const sourceLat = matchedSource.lat;
      const sourceLng = matchedSource.lng;
      const country =
        matchedSource.country ||
        (await resolveEntryCountry(supabase!, sourceLat, sourceLng, trip.country));
      entry = await createEntry(supabase!, {
        id: nanoid(8),
        section_id: section.id,
        rank: maxRank + 1,
        status: "active",
        import_source_entry_id: matchedSource.id,
        title: matchedSource.title,
        url: matchedSource.url,
        poster_image: matchedSource.poster_image,
        description: matchedSource.description,
        lat: matchedSource.lat,
        lng: matchedSource.lng,
        country,
        notes: notes || null,
        concerns: concerns || null,
        group_label: groupLabel || null,
        visited: autoVisited,
        data: matchedSource.data,
      });
    } else {
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

      const entryLat = lat === "" || lat == null ? null : lat;
      const entryLng = lng === "" || lng == null ? null : lng;
      const country = await resolveEntryCountry(supabase!, entryLat, entryLng, trip.country);

      entry = await createEntry(supabase!, {
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
        // alone doesn't catch that, and an empty string sent straight
        // to a double precision column is a real Postgres error, not a
        // silent no-op.
        lat: entryLat,
        lng: entryLng,
        country,
        notes: notes || null,
        concerns: concerns || null,
        group_label: groupLabel || null,
        visited: autoVisited,
        data: filledData,
      });
    }
    await exportSection(supabase!, trip, section);
    // Best-effort — this section might itself be the import source for
    // one or more other sections (see lib/entrySync.ts), each of which
    // gets its own linked copy of a brand-new entry added here too.
    propagateNewEntryFromSource(entry).catch((err) => console.error("New-entry propagation failed:", err));
    return NextResponse.json({ entry: toClientEntry(entry) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
