import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug, getTripNav } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";
import type { FieldType, Section } from "@/lib/types";

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

const VALID_CARD_LAYOUTS: Section["card_layout"][] = ["list", "grid-2", "grid-3"];

export async function GET(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  try {
    const nav = await getTripNav(trip.id);
    return NextResponse.json({ trip, nav });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError, supabase } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    slug,
    label,
    subNavLabel,
    addPlaceholder,
    emptyMessage,
    supportsPairing,
    hasMap,
    supportsRatings,
    cardLayout,
    navGroupId,
    newNavGroupLabel,
    fieldDefs,
  } = body;

  if (!slug || !label) {
    return NextResponse.json({ error: "slug and label are required" }, { status: 400 });
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ error: "slug must be lowercase letters/numbers separated by hyphens" }, { status: 400 });
  }
  if (!navGroupId && !newNavGroupLabel) {
    return NextResponse.json({ error: "Pick an existing nav group or name a new one" }, { status: 400 });
  }
  if (cardLayout !== undefined && !VALID_CARD_LAYOUTS.includes(cardLayout)) {
    return NextResponse.json({ error: `Invalid cardLayout: ${cardLayout}` }, { status: 400 });
  }
  for (const f of fieldDefs || []) {
    if (!f.key || !f.label || !VALID_FIELD_TYPES.includes(f.field_type)) {
      return NextResponse.json({ error: `Invalid field definition: ${JSON.stringify(f)}` }, { status: 400 });
    }
  }

  try {
    let resolvedNavGroupId = navGroupId || null;
    if (!resolvedNavGroupId && newNavGroupLabel) {
      const groupSlug = newNavGroupLabel
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const { data: group, error: groupError } = await supabase!
        .from("nav_groups")
        .insert({ trip_id: trip.id, slug: groupSlug, label: newNavGroupLabel, sort_order: 999 })
        .select()
        .single();
      if (groupError) throw new Error(groupError.message);
      resolvedNavGroupId = group.id;
    }

    const { data: section, error: sectionError } = await supabase!
      .from("sections")
      .insert({
        trip_id: trip.id,
        nav_group_id: resolvedNavGroupId,
        slug,
        label,
        sub_nav_label: subNavLabel || label,
        add_placeholder: addPlaceholder || "Paste a link...",
        empty_message: emptyMessage || "Nothing here yet — paste a link above.",
        supports_pairing: !!supportsPairing,
        has_map: !!hasMap,
        supports_ratings: !!supportsRatings,
        card_layout: cardLayout || "list",
        sort_order: 999,
      })
      .select()
      .single();
    if (sectionError) throw new Error(sectionError.message);

    if (fieldDefs?.length > 0) {
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
      const { error: fieldError } = await supabase!.from("field_defs").insert(rows);
      if (fieldError) throw new Error(fieldError.message);
    }

    return NextResponse.json({ section }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
