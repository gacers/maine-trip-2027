import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug, getSectionBySlug } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";
import type { FieldType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_FIELD_TYPES: FieldType[] = [
  "text",
  "textarea",
  "url",
  "image_url",
  "number",
  "count",
  "price",
  "select",
  "boolean",
  "date",
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; sectionSlug: string }> }
) {
  const { tripSlug, sectionSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });
  const section = await getSectionBySlug(trip.id, sectionSlug);
  if (!section) return NextResponse.json({ error: "Unknown section" }, { status: 404 });
  return NextResponse.json({ trip, section });
}

// Replaces the section's whole field_defs list with whatever's given
// (simplest correct semantics for a form that submits its full current
// state, rather than diffing individual field rows).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; sectionSlug: string }> }
) {
  const { tripSlug, sectionSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });
  const section = await getSectionBySlug(trip.id, sectionSlug);
  if (!section) return NextResponse.json({ error: "Unknown section" }, { status: 404 });

  const { error: authError, supabase } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    label,
    subNavLabel,
    addPlaceholder,
    emptyMessage,
    supportsPairing,
    hasMap,
    supportsRanking,
    supportsRatings,
    compactCards,
    navGroupId,
    enabled,
    fieldDefs,
  } = body;

  const patch: Record<string, unknown> = {};
  if (label !== undefined) patch.label = label;
  if (subNavLabel !== undefined) patch.sub_nav_label = subNavLabel;
  if (addPlaceholder !== undefined) patch.add_placeholder = addPlaceholder;
  if (emptyMessage !== undefined) patch.empty_message = emptyMessage;
  if (supportsPairing !== undefined) patch.supports_pairing = !!supportsPairing;
  if (hasMap !== undefined) patch.has_map = !!hasMap;
  if (supportsRanking !== undefined) patch.supports_ranking = !!supportsRanking;
  if (supportsRatings !== undefined) patch.supports_ratings = !!supportsRatings;
  if (compactCards !== undefined) patch.compact_cards = !!compactCards;
  if (navGroupId !== undefined) patch.nav_group_id = navGroupId;
  if (enabled !== undefined) patch.enabled = !!enabled;

  if (fieldDefs) {
    for (const f of fieldDefs) {
      if (!f.key || !f.label || !VALID_FIELD_TYPES.includes(f.field_type)) {
        return NextResponse.json({ error: `Invalid field definition: ${JSON.stringify(f)}` }, { status: 400 });
      }
    }
  }

  try {
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase!.from("sections").update(patch).eq("id", section.id);
      if (error) throw new Error(error.message);
    }

    if (fieldDefs) {
      const { error: delError } = await supabase!.from("field_defs").delete().eq("section_id", section.id);
      if (delError) throw new Error(delError.message);
      if (fieldDefs.length > 0) {
        const rows = fieldDefs.map((f: Record<string, unknown>, i: number) => ({
          section_id: section.id,
          key: f.key,
          label: f.label,
          field_type: f.field_type,
          storage: "jsonb",
          show_on_overview: !!f.show_on_overview,
          required: !!f.required,
          options: f.options || null,
          sort_order: i,
        }));
        const { error: insError } = await supabase!.from("field_defs").insert(rows);
        if (insError) throw new Error(insError.message);
      }
    }

    const updated = await getSectionBySlug(trip.id, sectionSlug);
    return NextResponse.json({ section: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; sectionSlug: string }> }
) {
  const { tripSlug, sectionSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });
  const section = await getSectionBySlug(trip.id, sectionSlug);
  if (!section) return NextResponse.json({ error: "Unknown section" }, { status: 404 });

  const { error: authError, supabase } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    const { error } = await supabase!.from("sections").delete().eq("id", section.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
