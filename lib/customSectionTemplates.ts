import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServiceRole } from "@/lib/supabaseServer";
import type { TemplateFieldDef } from "@/lib/sectionTemplates";

// The 3 built-in templates' own nav groups never get captured as
// "custom" ones — creating one of these through the ordinary "New
// section" form (rather than the template buttons) just keeps the
// existing built-in template in sync with itself, not a duplicate.
const DEFAULT_NAV_GROUP_LABELS = new Set(["stays", "food & drink", "activities"]);

export interface CustomTemplateSection {
  slug: string;
  label: string;
  subNavLabel: string | null;
  addPlaceholder: string | null;
  emptyMessage: string | null;
  supportsPairing: boolean;
  hasMap: boolean;
  supportsRatings: boolean;
  cardLayout: "list" | "grid-2" | "grid-3";
  fieldDefs: TemplateFieldDef[];
}

export interface CustomSectionTemplate {
  id: string;
  template_key: string;
  nav_group_label: string;
  sections: CustomTemplateSection[];
  created_from_trip_id: string | null;
  created_at: string;
  updated_at: string;
}

export function slugifyTemplateKey(navGroupLabel: string): string {
  return navGroupLabel
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isDefaultNavGroupLabel(navGroupLabel: string): boolean {
  return DEFAULT_NAV_GROUP_LABELS.has(navGroupLabel.trim().toLowerCase());
}

// Called right after a section is created via the ordinary "New
// section" admin form (never from the built-in template buttons or
// from instantiating a custom template elsewhere — both pass
// `skipTemplateCapture: true`, see the sections POST route). Every
// custom nav group an admin sets up becomes reusable on every other
// trip automatically, with no separate "save as template" step — the
// template row just merges in each section as it's created (the
// primary section, then its "previously visited" counterpart, then any
// more added later), so one always reflects the fullest version of that
// nav group any trip has built so far.
export async function upsertCustomSectionTemplate(
  supabase: SupabaseClient,
  navGroupLabel: string,
  tripId: string,
  section: CustomTemplateSection
): Promise<void> {
  if (isDefaultNavGroupLabel(navGroupLabel)) return;
  const templateKey = slugifyTemplateKey(navGroupLabel);
  if (!templateKey) return;

  const { data: existing } = await supabase
    .from("custom_section_templates")
    .select("id, sections")
    .eq("template_key", templateKey)
    .maybeSingle();

  if (!existing) {
    await supabase.from("custom_section_templates").insert({
      template_key: templateKey,
      nav_group_label: navGroupLabel,
      sections: [section],
      created_from_trip_id: tripId,
    });
    return;
  }

  const sections: CustomTemplateSection[] = Array.isArray(existing.sections) ? existing.sections : [];
  const withoutThisSlug = sections.filter((s) => s.slug !== section.slug);
  await supabase
    .from("custom_section_templates")
    .update({
      nav_group_label: navGroupLabel,
      sections: [...withoutThisSlug, section],
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);
}

export interface RemoveFieldEverywhereResult {
  sectionsAffected: number;
}

// "Remove this field from every section of this type" — FieldDefsEditor's
// own bulk-remove, for fixing an unwanted field once instead of visiting
// every trip's own matching section one at a time. "This type" means the
// same concept-matching findCandidateSectionsForConceptSlug already uses
// for the Prefill panel: same nav group SLUG (not label — a custom nav
// group's slug is unique to it, but "food-drink"/"activities"/"houses"
// are shared by every trip's own built-in groups) and the same section
// slug, or its "-visited" counterpart (both tiers of one concept share
// one field template in practice — see SectionForm's own counterpart
// creation, which starts them identical). Runs as the service role,
// same reasoning as lib/entrySync.ts: this trip's own write access
// doesn't extend to every OTHER trip whose matching section also gets
// touched here, and this is a deliberate, explicitly-confirmed bulk
// system operation, not a per-trip edit.
//
// Skips a section that's itself an entrySync destination
// (import_source_section_id set) — that section's own fields are
// already governed by a real, live source elsewhere (see
// lib/entrySync.ts); this legacy template-matching mechanism has no
// business also touching it. Also strips the key from this nav group's
// own shared template, so a brand-new section created from it later
// doesn't bring the removed field right back.
export async function removeFieldEverywhere(
  navGroupSlug: string,
  sectionSlug: string,
  fieldKey: string
): Promise<RemoveFieldEverywhereResult> {
  const supabase = supabaseServiceRole();
  const conceptSlug = sectionSlug.replace(/-visited$/, "");

  const { data: groups, error: groupsError } = await supabase.from("nav_groups").select("id, label").eq("slug", navGroupSlug);
  if (groupsError) throw new Error(groupsError.message);
  if (!groups || groups.length === 0) return { sectionsAffected: 0 };

  const { data: sections, error: sectionsError } = await supabase
    .from("sections")
    .select("id")
    .in(
      "nav_group_id",
      groups.map((g) => g.id)
    )
    .in("slug", [conceptSlug, `${conceptSlug}-visited`])
    .is("import_source_section_id", null);
  if (sectionsError) throw new Error(sectionsError.message);
  if (!sections || sections.length === 0) return { sectionsAffected: 0 };

  const sectionIds = sections.map((s) => s.id);
  const { error: delError, count } = await supabase
    .from("field_defs")
    .delete({ count: "exact" })
    .in("section_id", sectionIds)
    .eq("key", fieldKey);
  if (delError) throw new Error(delError.message);

  // Best-effort — every nav group label sharing this slug (in practice
  // there's only ever one, but the group itself doesn't enforce that)
  // gets its own template's matching key stripped too.
  for (const group of groups) {
    const templateKey = slugifyTemplateKey(group.label);
    if (!templateKey) continue;
    const { data: template } = await supabase
      .from("custom_section_templates")
      .select("id, sections")
      .eq("template_key", templateKey)
      .maybeSingle();
    if (!template) continue;
    const templateSections: CustomTemplateSection[] = Array.isArray(template.sections) ? template.sections : [];
    const updatedSections = templateSections.map((s) => ({ ...s, fieldDefs: s.fieldDefs.filter((f) => f.key !== fieldKey) }));
    try {
      await supabase
        .from("custom_section_templates")
        .update({ sections: updatedSections, updated_at: new Date().toISOString() })
        .eq("id", template.id);
    } catch (err) {
      console.error("Template field-strip failed:", err);
    }
  }

  return { sectionsAffected: count || 0 };
}
