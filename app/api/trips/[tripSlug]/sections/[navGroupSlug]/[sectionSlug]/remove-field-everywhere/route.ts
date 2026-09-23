import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug, getSectionBySlug } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";
import { removeFieldEverywhere } from "@/lib/customSectionTemplates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// FieldDefsEditor's own "Remove from all" — deletes one field (by key)
// from every section that matches this one's own "type" (same nav
// group slug + section slug/its "-visited" counterpart, across every
// trip — see removeFieldEverywhere's own comment on exactly what that
// matches), plus this nav group's own shared template, instead of an
// admin visiting every trip's matching section one at a time. This
// section's own current field_defs aren't touched directly here —
// they're one of the matches removeFieldEverywhere itself finds and
// updates, same as every other one.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; navGroupSlug: string; sectionSlug: string }> }
) {
  const { tripSlug, navGroupSlug, sectionSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });
  const section = await getSectionBySlug(trip.id, navGroupSlug, sectionSlug);
  if (!section) return NextResponse.json({ error: "Unknown section" }, { status: 404 });

  const { error: authError, raterKey } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });
  // This route's own blast radius (every trip sharing this nav-group/
  // section-slug pattern — see removeFieldEverywhere) isn't bounded by
  // the caller's own trip, unlike everything else requireWriteAccess
  // gates — so a trip-scoped bearer key, which is otherwise a
  // legitimate "admin" of just this one trip, isn't enough here. Only a
  // real interactive admin session (raterKey "admin:<user.id>", never
  // "key:<api_keys.id>") gets through.
  if (!raterKey?.startsWith("admin:")) {
    return NextResponse.json({ error: "Sign in as an admin to remove a field from every trip" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const fieldKey = typeof body.fieldKey === "string" ? body.fieldKey.trim() : "";
  if (!fieldKey) return NextResponse.json({ error: "fieldKey is required" }, { status: 400 });

  try {
    const result = await removeFieldEverywhere(navGroupSlug, sectionSlug, fieldKey);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
