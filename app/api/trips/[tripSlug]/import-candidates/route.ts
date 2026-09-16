import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { findCandidateSectionsForConceptSlug } from "@/lib/entries";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Backs SectionsAdmin's "copy in existing entries" picker — every real
// candidate section an admin could choose to prefill from (not a
// single blended count across everything matching the section's own
// slug, which gave no way to tell which trip's own list was actually
// contributing what, and could blend in a totally unrelated category
// that just happens to share the same bare slug — see
// findCandidateSectionsForConceptSlug for why navGroupSlug matters
// just as much as the section's own slug here).
export async function GET(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const searchParams = new URL(request.url).searchParams;
  const navGroupSlug = (searchParams.get("navGroupSlug") || "").trim();
  const slug = (searchParams.get("slug") || "").trim();
  if (!navGroupSlug || !slug) {
    return NextResponse.json({ error: "navGroupSlug and slug are required" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const candidates = await findCandidateSectionsForConceptSlug(supabase, navGroupSlug, slug, trip.id);
  return NextResponse.json({ candidates });
}
