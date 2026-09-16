import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Admin-only, sortOrder only for now — this exists purely to back
// SectionsAdmin's own drag-to-reorder for the top-level nav tabs
// (Stays/Food & Drink/Activities/...), same idea as the sections PATCH
// route already supports for reordering within one group.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; navGroupSlug: string }> }
) {
  const { tripSlug, navGroupSlug } = await params;
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
  if (typeof body.sortOrder !== "number") {
    return NextResponse.json({ error: "sortOrder (number) is required" }, { status: 400 });
  }

  const { error } = await supabase!
    .from("nav_groups")
    .update({ sort_order: body.sortOrder })
    .eq("trip_id", trip.id)
    .eq("slug", navGroupSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
