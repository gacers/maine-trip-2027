import { NextResponse, type NextRequest } from "next/server";
import { getTripBySlug, getSectionBySlug, sanitizeTripForClient } from "@/lib/sections";
import { requireWriteAccess, requireReadAccess } from "@/lib/auth";
import { upsertCustomSectionTemplate } from "@/lib/customSectionTemplates";
import { upsertCustomFieldTemplate } from "@/lib/customFieldTemplates";
import { propagateFieldDefsFromSource, isImportDestination } from "@/lib/entrySync";
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; navGroupSlug: string; sectionSlug: string }> }
) {
  const { tripSlug, navGroupSlug, sectionSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });
  const section = await getSectionBySlug(trip.id, navGroupSlug, sectionSlug);
  if (!section) return NextResponse.json({ error: "Unknown section" }, { status: 404 });

  const { error: authError } = await requireReadAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  // sanitizeTripForClient — same fix as the sections list GET route,
  // this used to hand back trip.sheet_invite_token as-is.
  return NextResponse.json({ trip: sanitizeTripForClient(trip), section });
}

// Replaces the section's whole field_defs list with whatever's given
// (simplest correct semantics for a form that submits its full current
// state, rather than diffing individual field rows).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; navGroupSlug: string; sectionSlug: string }> }
) {
  const { tripSlug, navGroupSlug, sectionSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });
  const section = await getSectionBySlug(trip.id, navGroupSlug, sectionSlug);
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
    supportsRatings,
    supportsConcerns,
    cardLayout,
    navGroupId,
    // Moves this section into a brand-new nav group instead of an
    // existing one — same idea as the sections POST route's own
    // newNavGroupLabel, so a miscategorized section (e.g. filed under
    // an existing group by mistake) can be corrected from its own Edit
    // page, not just at creation time.
    newNavGroupLabel,
    enabled,
    fieldDefs,
    // Backs SectionsAdmin's own drag-to-reorder within a nav group —
    // see lib/sectionLabels.ts's PRIMARY_TIER_SORT_ORDER/PAST_TIER_SORT_ORDER
    // for the same field set at creation time.
    sortOrder,
  } = body;

  if (cardLayout !== undefined && !VALID_CARD_LAYOUTS.includes(cardLayout)) {
    return NextResponse.json({ error: `Invalid cardLayout: ${cardLayout}` }, { status: 400 });
  }

  // A section synced from one or more others (see lib/entrySync.ts)
  // has its own field_defs mirrored from them and locked here —
  // editing them has to happen on a source section, which then
  // propagates to every one of its own destinations, this one
  // included.
  if (fieldDefs !== undefined && (await isImportDestination(section.id))) {
    return NextResponse.json(
      { error: "This section's fields are synced from its import source(s) — edit them there instead." },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = {};
  if (label !== undefined) patch.label = label;
  if (subNavLabel !== undefined) patch.sub_nav_label = subNavLabel;
  if (addPlaceholder !== undefined) patch.add_placeholder = addPlaceholder;
  if (emptyMessage !== undefined) patch.empty_message = emptyMessage;
  if (supportsPairing !== undefined) patch.supports_pairing = !!supportsPairing;
  if (hasMap !== undefined) patch.has_map = !!hasMap;
  if (supportsRatings !== undefined) patch.supports_ratings = !!supportsRatings;
  if (supportsConcerns !== undefined) patch.supports_concerns = !!supportsConcerns;
  if (cardLayout !== undefined) patch.card_layout = cardLayout;
  if (navGroupId !== undefined) patch.nav_group_id = navGroupId;
  if (enabled !== undefined) patch.enabled = !!enabled;
  if (typeof sortOrder === "number") patch.sort_order = sortOrder;

  if (fieldDefs) {
    for (const f of fieldDefs) {
      if (!f.key || !f.label || !VALID_FIELD_TYPES.includes(f.field_type)) {
        return NextResponse.json({ error: `Invalid field definition: ${JSON.stringify(f)}` }, { status: 400 });
      }
    }
  }

  try {
    if (newNavGroupLabel && newNavGroupLabel.trim()) {
      const groupSlug = newNavGroupLabel
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const { data: group, error: groupError } = await supabase!
        .from("nav_groups")
        .insert({ trip_id: trip.id, slug: groupSlug, label: newNavGroupLabel.trim(), sort_order: 999 })
        .select()
        .single();
      if (groupError) throw new Error(groupError.message);
      patch.nav_group_id = group.id;

      // Moving a section into a brand-new group is functionally the
      // same "this is a real custom category now" signal the sections
      // POST route captures on create — without this, a section
      // originally miscategorized under a built-in group (where
      // capture is deliberately skipped, see isDefaultNavGroupLabel)
      // stays invisible as a template even after being moved to its
      // own group, since PATCH otherwise never calls this at all.
      // Best-effort, same as the POST route's own capture call.
      upsertCustomSectionTemplate(supabase!, newNavGroupLabel.trim(), trip.id, {
        slug: section.slug,
        label: (patch.label as string | undefined) ?? section.label,
        subNavLabel: (patch.sub_nav_label as string | undefined) ?? section.sub_nav_label,
        addPlaceholder: (patch.add_placeholder as string | undefined) ?? section.add_placeholder,
        emptyMessage: (patch.empty_message as string | undefined) ?? section.empty_message,
        supportsPairing: (patch.supports_pairing as boolean | undefined) ?? section.supports_pairing,
        hasMap: (patch.has_map as boolean | undefined) ?? section.has_map,
        supportsRatings: (patch.supports_ratings as boolean | undefined) ?? section.supports_ratings,
        supportsConcerns: (patch.supports_concerns as boolean | undefined) ?? section.supports_concerns,
        cardLayout: (patch.card_layout as Section["card_layout"] | undefined) ?? section.card_layout,
        fieldDefs: (fieldDefs || section.field_defs || []).map((f: Record<string, unknown>) => ({
          key: f.key as string,
          label: f.label as string,
          field_type: f.field_type as FieldType,
          show_on_overview: !!f.show_on_overview,
          options: (f.options as { aliases?: string[] } | undefined) || undefined,
        })),
      }).catch((err) => console.error("Template capture failed:", err));
    }

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

        // Best-effort, same as the sections POST route's own capture.
        for (const f of fieldDefs as Record<string, unknown>[]) {
          upsertCustomFieldTemplate(supabase!, trip.id, {
            key: f.key as string,
            label: f.label as string,
            field_type: f.field_type as FieldType,
            show_on_overview: !!f.show_on_overview,
            required: !!f.required,
            options: (f.options as { choices?: string[]; aliases?: string[] } | undefined) || undefined,
          }).catch((err) => console.error("Field template capture failed:", err));
        }
      }

      // Best-effort — this section might itself be the import source
      // for one or more other sections (possibly on other trips
      // entirely), whose own field_defs need to stay mirrored to
      // whatever just got saved here.
      propagateFieldDefsFromSource(section.id).catch((err) => console.error("Field defs propagation failed:", err));
    }

    // Not getSectionBySlug(trip.id, navGroupSlug, sectionSlug) here —
    // that's scoped to the *request's* nav group slug, which no longer
    // matches once newNavGroupLabel just moved this section elsewhere.
    // Looking it up by its own id instead works regardless of whether
    // it moved.
    const { data: updated, error: fetchError } = await supabase!
      .from("sections")
      .select("*, field_defs(*)")
      .eq("id", section.id)
      .single();
    if (fetchError) throw new Error(fetchError.message);
    updated.field_defs = (updated.field_defs || []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order);

    // Regular edit to a section that already lives in a custom nav
    // group (the newNavGroupLabel branch above already captured the
    // "just moved into a brand-new group" case) — re-sync that group's
    // template too, so e.g. removing a field here also stops it being
    // offered on new trips built from this template. Only worth the
    // extra write when something template-relevant actually changed;
    // isDefaultNavGroupLabel inside the upsert itself is what actually
    // skips this for the 3 built-in groups.
    const templateRelevantChange =
      fieldDefs !== undefined ||
      label !== undefined ||
      subNavLabel !== undefined ||
      addPlaceholder !== undefined ||
      emptyMessage !== undefined ||
      supportsPairing !== undefined ||
      hasMap !== undefined ||
      supportsRatings !== undefined ||
      supportsConcerns !== undefined ||
      cardLayout !== undefined;
    if (templateRelevantChange && !(newNavGroupLabel && newNavGroupLabel.trim())) {
      const { data: group } = await supabase!.from("nav_groups").select("label").eq("id", updated.nav_group_id).maybeSingle();
      if (group?.label) {
        upsertCustomSectionTemplate(supabase!, group.label, trip.id, {
          slug: updated.slug,
          label: updated.label,
          subNavLabel: updated.sub_nav_label,
          addPlaceholder: updated.add_placeholder,
          emptyMessage: updated.empty_message,
          supportsPairing: updated.supports_pairing,
          hasMap: updated.has_map,
          supportsRatings: updated.supports_ratings,
          supportsConcerns: updated.supports_concerns,
          cardLayout: updated.card_layout,
          fieldDefs: (updated.field_defs || []).map((f: Record<string, unknown>) => ({
            key: f.key as string,
            label: f.label as string,
            field_type: f.field_type as FieldType,
            show_on_overview: !!f.show_on_overview,
            options: (f.options as { choices?: string[]; aliases?: string[] } | undefined) || undefined,
          })),
        }).catch((err) => console.error("Template capture failed:", err));
      }
    }

    return NextResponse.json({ section: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tripSlug: string; navGroupSlug: string; sectionSlug: string }> }
) {
  const { tripSlug, navGroupSlug, sectionSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });
  const section = await getSectionBySlug(trip.id, navGroupSlug, sectionSlug);
  if (!section) return NextResponse.json({ error: "Unknown section" }, { status: 404 });

  const { error: authError, supabase } = await requireWriteAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    const { error } = await supabase!.from("sections").delete().eq("id", section.id);
    if (error) throw new Error(error.message);

    // An empty nav group left behind after its last section is gone
    // isn't just clutter — SectionsAdmin's own template buttons key
    // off nav_groups existing at all to decide whether a template's
    // already "used" (see existingGroupLabels), so a leftover empty
    // one permanently blocked that same template from ever being
    // added again (confirmed live). Best-effort: a trip's own count
    // check is a courtesy, not something worth failing this delete
    // over if it errors.
    const { count, error: countError } = section.nav_group_id
      ? await supabase!.from("sections").select("id", { count: "exact", head: true }).eq("nav_group_id", section.nav_group_id)
      : { count: null, error: null };
    if (section.nav_group_id && !countError && count === 0) {
      await supabase!
        .from("nav_groups")
        .delete()
        .eq("id", section.nav_group_id)
        .then(({ error: deleteGroupError }) => {
          if (deleteGroupError) console.error("Empty nav group cleanup failed:", deleteGroupError);
        });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
