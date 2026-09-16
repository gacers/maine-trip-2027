import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug, getSectionBySlug } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";
import { supabaseServiceRole } from "@/lib/supabaseServer";
import { summarizeRatings, resolveRaterKey } from "@/lib/ratings";
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

// Sets (or replaces) the caller's own score for this entry — identified
// by requireWriteAccess's raterKey (an admin session, or an owner/
// contributor invite token; the same access level the Add form and
// notes/concerns already require). Always writes via the service-role
// client since a contributor's bearer-token identity has no Supabase
// Auth session for RLS to check — entry_ratings has no write policy at
// all, this route is the only door in, same pattern as entries' own
// bearer-token path.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; navGroupSlug: string; sectionSlug: string; entryId: string }> }
) {
  const { tripSlug, navGroupSlug, sectionSlug, entryId } = await params;
  const { trip, section, notFound } = await resolveTripAndSection(tripSlug, navGroupSlug, sectionSlug);
  if (notFound) return notFound;
  if (!section.supports_ratings) {
    return NextResponse.json({ error: "Ratings aren't enabled for this section" }, { status: 400 });
  }

  const { error: authError, raterKey: accessKey } = await requireWriteAccess(request, trip.id, {
    minRole: "editor",
  });
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
  const raterKey = resolveRaterKey(accessKey, request);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = Number(body.score);
  if (!Number.isFinite(raw) || raw < 0.5 || raw > 5) {
    return NextResponse.json({ error: "score must be between 0.5 and 5" }, { status: 400 });
  }
  const score = Math.round(raw * 2) / 2; // snap to the nearest half-star

  const service = supabaseServiceRole();
  const { error: upsertError } = await service
    .from("entry_ratings")
    .upsert(
      { entry_id: entryId, rater_key: raterKey, score, updated_at: new Date().toISOString() },
      { onConflict: "entry_id,rater_key" }
    );
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  const { data: rows, error: readError } = await service
    .from("entry_ratings")
    .select("entry_id, rater_key, score")
    .eq("entry_id", entryId);
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  return NextResponse.json(summarizeRatings(rows, raterKey ?? null));
}

// Clears the caller's own score (e.g. "never mind, I have no opinion") —
// leaves everyone else's ratings and the average untouched. With
// ?all=true, clears *every* rater's score for this entry instead — used
// when an entry's own groupLabel pairing just changed (see SectionPage's
// clearAllRatings/requestPair/handlePatch): a house's score as a solo
// listing and its score as half of a 2-house option aren't the same
// thing, so whatever was rated under the old shape shouldn't silently
// carry over as if it were rated under the new one. Same access level
// as a plain single-rater clear — pairing/unpairing is itself already a
// contributor-level action (see AddEntryDialog/PairEntryDialog).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; navGroupSlug: string; sectionSlug: string; entryId: string }> }
) {
  const { tripSlug, navGroupSlug, sectionSlug, entryId } = await params;
  const { trip, section, notFound } = await resolveTripAndSection(tripSlug, navGroupSlug, sectionSlug);
  if (notFound) return notFound;
  if (!section.supports_ratings) {
    return NextResponse.json({ error: "Ratings aren't enabled for this section" }, { status: 400 });
  }

  const { error: authError, raterKey: accessKey } = await requireWriteAccess(request, trip.id, {
    minRole: "editor",
  });
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
  const raterKey = resolveRaterKey(accessKey, request);

  const clearAll = new URL(request.url).searchParams.get("all") === "true";

  const service = supabaseServiceRole();
  let query = service.from("entry_ratings").delete().eq("entry_id", entryId);
  if (!clearAll) query = query.eq("rater_key", raterKey);
  const { error: delError } = await query;
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  const { data: rows, error: readError } = await service
    .from("entry_ratings")
    .select("entry_id, rater_key, score")
    .eq("entry_id", entryId);
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  return NextResponse.json(summarizeRatings(rows, raterKey ?? null));
}
