import { NextResponse, after, type NextRequest } from "next/server";
import { getTripBySlug, getTripNav, sanitizeTripForClient } from "@/lib/sections";
import { requireWriteAccess, requireReadAccess } from "@/lib/auth";
import { upsertCustomSectionTemplate } from "@/lib/customSectionTemplates";
import { upsertCustomFieldTemplate } from "@/lib/customFieldTemplates";
import { VALID_FIELD_TYPES, type FieldType, type Section } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_CARD_LAYOUTS: Section["card_layout"][] = ["list", "grid-2", "grid-3"];

export async function GET(request: NextRequest, { params }: { params: Promise<{ tripSlug: string }> }) {
  const { tripSlug } = await params;
  const trip = await getTripBySlug(tripSlug);
  if (!trip) return NextResponse.json({ error: "Unknown trip" }, { status: 404 });

  const { error: authError } = await requireReadAccess(request, trip.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    const nav = await getTripNav(trip.id);
    // sanitizeTripForClient, not the raw row — this used to hand back
    // trip.sheet_invite_token (a real, live Sheet-editing secret, see
    // its own comment in lib/sections.ts) to anyone who asked, gated or
    // not.
    return NextResponse.json({ trip: sanitizeTripForClient(trip), nav });
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
    supportsConcerns,
    cardLayout,
    navGroupId,
    newNavGroupLabel,
    fieldDefs,
    // Set by the template-buttons flow (both the 3 built-ins and any
    // custom template picked from the list below them) — instantiating
    // a template shouldn't re-capture itself back into the templates
    // table, only genuinely new "New section" submissions should.
    skipTemplateCapture,
    // Explicit ordering within the nav group — see lib/sectionLabels.ts's
    // PRIMARY_TIER_SORT_ORDER/PAST_TIER_SORT_ORDER. Every caller that
    // knows it's creating one half of an Options/Past-style pair passes
    // this; a genuinely standalone section (no pair) omits it and just
    // gets the bare default below, same as always.
    sortOrder,
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
    let resolvedNavGroupLabel = newNavGroupLabel || null;
    // A client-supplied navGroupId is otherwise trusted outright — an
    // admin with write access to trip A shouldn't be able to land a new
    // section under trip B's own nav group just by knowing/guessing its
    // uuid, so confirm it's actually one of this trip's own groups
    // first, same as every other id this route is handed gets checked.
    if (resolvedNavGroupId) {
      const { data: ownedGroup } = await supabase!
        .from("nav_groups")
        .select("id")
        .eq("id", resolvedNavGroupId)
        .eq("trip_id", trip.id)
        .maybeSingle();
      if (!ownedGroup) {
        return NextResponse.json({ error: "Unknown nav group for this trip" }, { status: 400 });
      }
    }
    if (!resolvedNavGroupId && newNavGroupLabel) {
      const groupSlug = newNavGroupLabel
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      // Reuse an existing group for this trip+slug — a prior attempt
      // that created the nav_group then failed on the section insert
      // (e.g. schema cache lag) otherwise leaves an empty shell that
      // blocks every retry with nav_groups_trip_id_slug_key.
      const { data: existingGroup } = await supabase!
        .from("nav_groups")
        .select("id, label")
        .eq("trip_id", trip.id)
        .eq("slug", groupSlug)
        .maybeSingle();
      if (existingGroup) {
        resolvedNavGroupId = existingGroup.id;
        resolvedNavGroupLabel = existingGroup.label;
      } else {
        // Lands after every nav group this trip already has — a
        // hardcoded 999 here (what this used to insert) ties every
        // brand-new group at the same value, so which one a trip's own
        // top nav (or the homepage's own "first section" link) treats
        // as "first" ends up depending on undefined tie-breaking rather
        // than actual intent. Confirmed live: most trips' nav_groups
        // are stuck exactly like that.
        const { data: maxRow } = await supabase!
          .from("nav_groups")
          .select("sort_order")
          .eq("trip_id", trip.id)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;
        const { data: group, error: groupError } = await supabase!
          .from("nav_groups")
          .insert({ trip_id: trip.id, slug: groupSlug, label: newNavGroupLabel, sort_order: nextSortOrder })
          .select()
          .single();
        if (groupError) throw new Error(groupError.message);
        resolvedNavGroupId = group.id;
      }
    } else if (resolvedNavGroupId && !resolvedNavGroupLabel) {
      // Only needed for template capture below (e.g. a counterpart
      // section landing in the nav group its primary just created) —
      // skip the lookup whenever capture wouldn't run anyway.
      if (!skipTemplateCapture) {
        const { data: group } = await supabase!.from("nav_groups").select("label").eq("id", resolvedNavGroupId).maybeSingle();
        resolvedNavGroupLabel = group?.label || null;
      }
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
        empty_message: emptyMessage || "Nothing here yet",
        supports_pairing: !!supportsPairing,
        has_map: !!hasMap,
        supports_ratings: !!supportsRatings,
        supports_concerns: !!supportsConcerns,
        card_layout: cardLayout || "list",
        sort_order: typeof sortOrder === "number" ? sortOrder : 999,
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

      // Best-effort, same reasoning as the nav-group capture below —
      // every named field becomes pickable on any other section/trip
      // too (see FieldDefsEditor's own template picker). Deferred to
      // after() (not just left unawaited) so these are guaranteed to
      // actually run instead of racing the response.
      for (const f of fieldDefs as Record<string, unknown>[]) {
        after(() =>
          upsertCustomFieldTemplate(supabase!, trip.id, {
            key: f.key as string,
            label: f.label as string,
            field_type: f.field_type as FieldType,
            show_on_overview: !!f.show_on_overview,
            required: !!f.required,
            options: (f.options as { choices?: string[]; aliases?: string[] } | undefined) || undefined,
          }).catch((err) => console.error("Field template capture failed:", err))
        );
      }
    }

    // Best-effort — a custom nav group's usefulness on THIS trip never
    // depends on it, so a failure here shouldn't fail the section it
    // was capturing.
    if (!skipTemplateCapture && resolvedNavGroupLabel) {
      after(() =>
        upsertCustomSectionTemplate(supabase!, resolvedNavGroupLabel, trip.id, {
          slug: section.slug,
          label: section.label,
          subNavLabel: section.sub_nav_label,
          addPlaceholder: section.add_placeholder,
          emptyMessage: section.empty_message,
          supportsPairing: section.supports_pairing,
          hasMap: section.has_map,
          supportsRatings: section.supports_ratings,
          supportsConcerns: section.supports_concerns,
          cardLayout: section.card_layout,
          fieldDefs: (fieldDefs || []).map((f: Record<string, unknown>) => ({
            key: f.key,
            label: f.label,
            field_type: f.field_type,
            show_on_overview: !!f.show_on_overview,
            options: f.options || undefined,
          })),
        }).catch((err) => console.error("Template capture failed:", err))
      );
    }

    // Pull matching Future Interests manuals into this Options/primary
    // section as original entries (and drop the FI rows). Best-effort.
    if (resolvedNavGroupId) {
      const { tryPromoteFutureInterestsForNewSection } = await import("@/lib/futureInterestPromote");
      await tryPromoteFutureInterestsForNewSection(supabase!, {
        sectionId: section.id,
        sectionSlug: section.slug,
        tripId: trip.id,
        tripCompleted: !!trip.completed,
        navGroupId: resolvedNavGroupId,
      });
    }

    return NextResponse.json({ section }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
