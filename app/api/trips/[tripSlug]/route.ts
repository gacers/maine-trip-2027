import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug, getAllSectionsForTrip } from "@/lib/sections";
import { requireWriteAccess, getAdminUser } from "@/lib/auth";
import { supabaseServiceRole } from "@/lib/supabaseServer";
import { exportSection } from "@/lib/sheetsExport";

export const dynamic = "force-dynamic";

// Admin-only: edits a trip's own top-level fields — name, subtitle,
// date range, and map_config (Points of Interest — see
// TripSettingsForm). There was previously no way to change any of
// these after creation at all.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError, supabase } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ("name" in body) patch.name = body.name;
  if ("subtitle" in body) patch.subtitle = body.subtitle || null;
  if ("startDate" in body) patch.start_date = body.startDate || null;
  if ("endDate" in body) patch.end_date = body.endDate || null;
  if ("altStartDate" in body) patch.alt_start_date = body.altStartDate || null;
  if ("altEndDate" in body) patch.alt_end_date = body.altEndDate || null;
  if ("nightsEstimate" in body) patch.nights_estimate = body.nightsEstimate || null;
  if ("mapConfig" in body) patch.map_config = body.mapConfig;
  if ("coverImage" in body) patch.cover_image = body.coverImage || null;
  if ("country" in body) patch.country = typeof body.country === "string" && body.country.trim() ? body.country.trim() : null;
  if ("completed" in body) patch.completed = !!body.completed;
  // Hides the trip from the public trips index (getAllTrips filters on
  // this) without touching any of its data — reversible, unlike
  // DELETE below. For a trip you don't want cluttering the list
  // anymore (a duplicate, one you decided not to take) but might
  // still want to look back at.
  if ("archived" in body) patch.archived = !!body.archived;

  const { data, error } = await supabase!.from("trips").update(patch).eq("id", trip.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Stamp entries that never got a country of their own — creation
  // stamps trip.country going forward; this covers the "just set country
  // on an existing trip" case without overwriting a place that already
  // has one.
  if ("country" in patch && patch.country) {
    await supabase!
      .from("entries")
      .update({ country: patch.country })
      .eq("trip_id", trip.id)
      .or("country.is.null,country.eq.");
  }

  // Completed status changes what every tab's own header/highlighting/
  // row order looks like (see lib/sheetsExport.ts's unitTier/
  // applyActiveRowHighlight) — without re-exporting here, a Sheet that
  // had already picked up "completed" styling (green Visited rows)
  // stayed stuck that way after un-completing the trip, since nothing
  // else re-triggers a Sheet refresh until some unrelated entry write
  // eventually does (confirmed live). Best-effort, same as every other
  // auto-export call site — a Sheets hiccup here can't fail this save.
  if ("completed" in body) {
    const sections = await getAllSectionsForTrip(trip.id);
    for (const section of sections) {
      await exportSection(supabase!, data, section);
    }
  }

  return NextResponse.json({ trip: data });
}

// Admin session only — deliberately NOT reachable via an API key/bearer
// token the way PATCH is (see requireWriteAccess): those exist for
// Claude Desktop/automation to manage entries, not to permanently wipe
// an entire trip. Cascades through nav_groups/sections/field_defs/
// entries/api_keys (all `on delete cascade` — see
// supabase/migrations/0001_init.sql) but does NOT touch the trip's
// Google Sheet/Drive file, if it has one — that's a separate Google
// resource this app doesn't own the lifecycle of; deleting it here
// would need the OAuth Drive client and could fail independently of
// the actual trip deletion, which shouldn't be held hostage to that.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { error } = await supabaseServiceRole().from("trips").delete().eq("id", trip.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
