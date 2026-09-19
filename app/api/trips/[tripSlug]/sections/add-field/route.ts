import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug } from "@/lib/sections";
import { requireWriteAccess } from "@/lib/auth";
import { exportSection } from "@/lib/sheetsExport";
import { isImportDestination } from "@/lib/entrySync";
import { upsertCustomFieldTemplate } from "@/lib/customFieldTemplates";
import type { Section, FieldType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Adds ONE already-known field (from /api/field-templates — the exact
// same list FieldDefsEditor's own "+ Add existing field..." offers) to
// a section's field_defs, keyed by id rather than the usual nav-group/
// section-slug path — the one caller that needs this (EntryEditForm's
// own "+ Add existing field..." control, for a field the section
// doesn't have yet but an entry could use right now) already has the
// entry's own sectionId on hand and has no reason to also carry
// navGroupSlug/sectionSlug all the way down through EntryCard's props
// just for this (same reasoning as entries/[entryId]/import-source's
// own id-based lookup). Admin-only, same as every other field_defs
// write — an editor/contributor can fill a field in, not add one to
// the schema.
export async function POST(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
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
  const sectionId = (body.sectionId as string | undefined)?.trim();
  const key = (body.key as string | undefined)?.trim();
  const label = (body.label as string | undefined)?.trim();
  const fieldType = body.fieldType as string | undefined;
  if (!sectionId || !key || !label || !fieldType) {
    return NextResponse.json({ error: "sectionId, key, label, and fieldType are required" }, { status: 400 });
  }

  try {
    const { data: section, error: sectionError } = await supabase!
      .from("sections")
      .select("*, field_defs(*)")
      .eq("id", sectionId)
      .eq("trip_id", trip.id)
      .maybeSingle();
    if (sectionError) throw new Error(sectionError.message);
    if (!section) return NextResponse.json({ error: "Unknown section" }, { status: 404 });

    // Same rule the sections PATCH route enforces for any other
    // field_defs write — this section's own fields mirror one or more
    // real sources (see lib/entrySync.ts) and can't be edited directly.
    if (await isImportDestination(sectionId)) {
      return NextResponse.json(
        { error: "This section's fields are synced from its import source(s) — edit them there instead." },
        { status: 400 }
      );
    }

    const existingDefs = (section.field_defs || []) as { key: string; sort_order: number }[];
    if (existingDefs.some((f) => f.key === key)) {
      return NextResponse.json({ error: `This section already has a "${label}" field.` }, { status: 409 });
    }
    const nextSortOrder = existingDefs.reduce((max, f) => (f.sort_order > max ? f.sort_order : max), -1) + 1;

    const { error: insError } = await supabase!.from("field_defs").insert({
      section_id: sectionId,
      key,
      label,
      field_type: fieldType,
      storage: "jsonb",
      show_on_overview: body.showOnOverview === true,
      required: body.required === true,
      options: body.options || null,
      sort_order: nextSortOrder,
    });
    if (insError) throw new Error(insError.message);

    // Best-effort — this is already a known template in practice (it
    // came from that same list), so this just keeps it current rather
    // than actually introducing anything new.
    upsertCustomFieldTemplate(supabase!, trip.id, {
      key,
      label,
      field_type: fieldType as FieldType,
      show_on_overview: body.showOnOverview === true,
      required: body.required === true,
      options: (body.options as { choices?: string[]; aliases?: string[] } | undefined) || undefined,
    }).catch((err) => console.error("Field template capture failed:", err));

    const { data: freshSection, error: freshError } = await supabase!
      .from("sections")
      .select("*, field_defs(*)")
      .eq("id", sectionId)
      .single();
    if (freshError) throw new Error(freshError.message);
    await exportSection(supabase!, trip, freshSection as Section);
    return NextResponse.json({ section: freshSection });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
