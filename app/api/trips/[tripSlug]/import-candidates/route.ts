import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { findCandidateSectionsForConceptSlug } from "@/lib/entries";
import { requireWriteAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Backs the Prefill panel on a section's own edit page — every real
// candidate section an admin could choose to prefill from (not a
// single blended count across everything matching the section's own
// slug, which gave no way to tell which section's own list was
// actually contributing what, and could blend in a totally unrelated
// category that just happens to share the same bare slug — see
// findCandidateSectionsForConceptSlug for why navGroupSlug matters
// just as much as the section's own slug here). Includes this same
// trip's own other sections too — a past tier can "nest" a prefill
// from a differently-organized section right here, not just elsewhere.
export async function GET(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  // Admin-only, matching PrefillPanel's own page (a section's Edit
  // page, under /admin) — this hands back other trips' section/entry
  // counts, a level above what a plain contributor should see.
  const { error: authError, supabase } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  const searchParams = new URL(request.url).searchParams;
  const navGroupSlug = (searchParams.get("navGroupSlug") || "").trim();
  const slug = (searchParams.get("slug") || "").trim();
  const excludeSectionId = (searchParams.get("excludeSectionId") || "").trim();
  if (!navGroupSlug || !slug || !excludeSectionId) {
    return NextResponse.json({ error: "navGroupSlug, slug, and excludeSectionId are required" }, { status: 400 });
  }

  const candidates = await findCandidateSectionsForConceptSlug(supabase!, navGroupSlug, slug, excludeSectionId);
  return NextResponse.json({ candidates });
}
