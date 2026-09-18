import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireAdmin } from "@/lib/auth";
import { supabaseServiceRole } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Admin-only wipe of every rater's score on every entry in every
// ratings-enabled section for this trip (Stay Options and any other
// section with supports_ratings). Used from Trip Settings — the
// per-option reset lives on the entry edit footer instead.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError } = await requireAdmin();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  const service = supabaseServiceRole();

  const { data: sections, error: sectionsError } = await service
    .from("sections")
    .select("id")
    .eq("trip_id", trip.id)
    .eq("supports_ratings", true);
  if (sectionsError) return NextResponse.json({ error: sectionsError.message }, { status: 500 });

  const sectionIds = (sections || []).map((s) => s.id as string);
  if (sectionIds.length === 0) {
    return NextResponse.json({ deletedCount: 0 });
  }

  const { data: entries, error: entriesError } = await service.from("entries").select("id").in("section_id", sectionIds);
  if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 });

  const entryIds = (entries || []).map((e) => e.id as string);
  if (entryIds.length === 0) {
    return NextResponse.json({ deletedCount: 0 });
  }

  // Count first so we can report how many rows were wiped — delete().
  // select() isn't available the same way for a bulk in() delete.
  const { count: beforeCount, error: countError } = await service
    .from("entry_ratings")
    .select("id", { count: "exact", head: true })
    .in("entry_id", entryIds);
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

  const { error: delError } = await service.from("entry_ratings").delete().in("entry_id", entryIds);
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  return NextResponse.json({ deletedCount: beforeCount ?? 0 });
}
