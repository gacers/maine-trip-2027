import type { SupabaseClient } from "@supabase/supabase-js";
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
