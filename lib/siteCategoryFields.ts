import { supabaseServiceRole } from "@/lib/supabaseServer";
import { upsertCustomFieldTemplate } from "@/lib/customFieldTemplates";
import {
  ACTIVITIES_TYPE_FIELD_DEFS,
  FOOD_DRINK_TYPE_FIELD_DEFS,
  STATUS_FIELD_DEFS,
  type TemplateFieldDef,
} from "@/lib/sectionTemplates";
import { isStatusBooleanKey, MOVED_ADDRESS_KEY } from "@/lib/statusFields";
import type { SiteCategorySlug } from "@/lib/siteCategories";
import type { FieldDef, FieldType } from "@/lib/types";

async function sectionIdsForCategory(categorySlug: string): Promise<string[]> {
  const supabase = supabaseServiceRole();
  const { data: navGroups, error: ngError } = await supabase
    .from("nav_groups")
    .select("id")
    .eq("slug", categorySlug);
  if (ngError) throw new Error(ngError.message);
  const navIds = (navGroups || []).map((g) => g.id);
  if (navIds.length === 0) return [];
  const { data: sections, error: secError } = await supabase
    .from("sections")
    .select("id")
    .in("nav_group_id", navIds)
    .eq("enabled", true);
  if (secError) throw new Error(secError.message);
  return (sections || []).map((s) => s.id);
}

function asFieldDef(f: TemplateFieldDef, sectionId = ""): FieldDef {
  return {
    id: f.key,
    section_id: sectionId,
    key: f.key,
    label: f.label,
    field_type: f.field_type,
    storage: "jsonb",
    core_column: null,
    options: f.options || null,
    sort_order: 0,
    show_on_overview: f.show_on_overview,
    required: false,
  };
}

function isProtectedStatusKey(key: string): boolean {
  return isStatusBooleanKey(key) || key === MOVED_ADDRESS_KEY;
}

/** Suggested type tags when seeding a new Food & Drink / Activities schema.
 * Not re-forced onto sections — admins trim per section in the designer. */
export function defaultTypeDefsForCategory(slug: string): TemplateFieldDef[] {
  if (slug === "food-drink") return FOOD_DRINK_TYPE_FIELD_DEFS;
  if (slug === "activities") return ACTIVITIES_TYPE_FIELD_DEFS;
  return [];
}

/** Status + optional starter types (Manage empty-state / docs). */
export function baseDefsForCategory(slug: string): TemplateFieldDef[] {
  return [...STATUS_FIELD_DEFS, ...defaultTypeDefsForCategory(slug)];
}

/**
 * Pin Closed / Moved / New address onto every section (any category).
 * Type tags are NOT re-added — remove them in Section Designer / Manage
 * and they stay gone.
 */
export async function ensureBaseFieldDefsOnSection(
  sectionId: string,
  _categorySlug?: string
): Promise<void> {
  const base = STATUS_FIELD_DEFS;
  const supabase = supabaseServiceRole();
  const { data: existing } = await supabase
    .from("field_defs")
    .select("id, key, sort_order")
    .eq("section_id", sectionId);
  const have = new Set((existing || []).map((r) => r.key));

  for (const f of base) {
    if (have.has(f.key)) continue;
    const { error } = await supabase.from("field_defs").insert({
      section_id: sectionId,
      key: f.key,
      label: f.label,
      field_type: f.field_type,
      storage: "jsonb",
      show_on_overview: f.show_on_overview,
      required: false,
      options: f.options || null,
      sort_order: 1000 + have.size,
    });
    if (error) throw new Error(error.message);
    have.add(f.key);
  }

  const { data: allDefs } = await supabase
    .from("field_defs")
    .select("id, key, sort_order")
    .eq("section_id", sectionId)
    .order("sort_order", { ascending: true });
  if (!allDefs?.length) return;

  const statusKeys = base.map((f) => f.key);
  const statusKeySet = new Set(statusKeys);
  const extras = allDefs.filter((r) => !statusKeySet.has(r.key));
  const byKey = new Map(allDefs.map((r) => [r.key, r]));

  let sortOrder = 0;
  for (const key of statusKeys) {
    const row = byKey.get(key);
    if (!row) continue;
    if (row.sort_order !== sortOrder) {
      await supabase.from("field_defs").update({ sort_order: sortOrder }).eq("id", row.id);
    }
    sortOrder++;
  }
  for (const row of extras) {
    if (row.sort_order !== sortOrder) {
      await supabase.from("field_defs").update({ sort_order: sortOrder }).eq("id", row.id);
    }
    sortOrder++;
  }
}

/** Prefer status fields at the front; never invent missing type tags. */
export function mergeBaseFieldDefs(_categorySlug: string, fieldDefs: FieldDef[]): FieldDef[] {
  const byKey = new Map(fieldDefs.map((f) => [f.key, f]));
  for (const f of STATUS_FIELD_DEFS) {
    if (!byKey.has(f.key)) byKey.set(f.key, asFieldDef(f));
  }
  const ordered: FieldDef[] = [];
  const seen = new Set<string>();
  for (const f of STATUS_FIELD_DEFS) {
    const row = byKey.get(f.key);
    if (row) {
      ordered.push(row);
      seen.add(f.key);
    }
  }
  for (const f of fieldDefs) {
    if (seen.has(f.key)) continue;
    ordered.push(f);
    seen.add(f.key);
  }
  return ordered;
}

/** Promote boolean keys that only live on Future Interests item.data
 * (created before AddFieldSelect synced to templates) onto the shared
 * category schema so trip cards pick them up too. */
export async function syncFutureInterestTypesToCategory(categorySlug: string): Promise<void> {
  const supabase = supabaseServiceRole();
  const { data: items, error } = await supabase
    .from("future_interest_items")
    .select("data")
    .eq("category_slug", categorySlug);
  if (error) throw new Error(error.message);

  const known = new Set((await getFieldDefsForSiteCategory(categorySlug)).map((f) => f.key));
  const reserved = new Set(["__notes", "__concerns"]);

  for (const item of items || []) {
    const data = (item.data || {}) as Record<string, unknown>;
    for (const [key, value] of Object.entries(data)) {
      if (reserved.has(key) || known.has(key)) continue;
      if (value !== true && value !== "true") continue;
      const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      await addFieldToSiteCategory({
        categorySlug,
        key,
        label,
        fieldType: "boolean",
        showOnOverview: true,
        required: false,
      });
      known.add(key);
    }
  }
}

/** Union of field_defs used on any trip section in this site category —
 * so Future Interests shows the same type checkboxes as trip cards.
 * Always includes Closed/Moved; type tags come from live sections only. */
export async function getFieldDefsForSiteCategory(categorySlug: string): Promise<FieldDef[]> {
  const supabase = supabaseServiceRole();
  const byKey = new Map<string, FieldDef>();

  for (const f of STATUS_FIELD_DEFS) {
    byKey.set(f.key, asFieldDef(f));
  }

  const { data: navGroups, error: ngError } = await supabase
    .from("nav_groups")
    .select("id")
    .eq("slug", categorySlug);
  if (ngError) throw new Error(ngError.message);
  const navIds = (navGroups || []).map((g) => g.id);

  if (navIds.length === 0) {
    // No trip sections yet — seed starter types so Manage isn't empty.
    for (const f of defaultTypeDefsForCategory(categorySlug)) {
      byKey.set(f.key, asFieldDef(f));
    }
    return orderStatusFirst([...byKey.values()]);
  }

  const { data: sections, error: secError } = await supabase
    .from("sections")
    .select("id")
    .in("nav_group_id", navIds)
    .eq("enabled", true);
  if (secError) throw new Error(secError.message);
  const sectionIds = (sections || []).map((s) => s.id);
  if (sectionIds.length === 0) {
    for (const f of defaultTypeDefsForCategory(categorySlug)) {
      byKey.set(f.key, asFieldDef(f));
    }
    return orderStatusFirst([...byKey.values()]);
  }

  for (const sectionId of sectionIds) {
    await ensureBaseFieldDefsOnSection(sectionId, categorySlug);
  }

  const { data: defs, error: defError } = await supabase
    .from("field_defs")
    .select("*")
    .in("section_id", sectionIds)
    .order("sort_order", { ascending: true });
  if (defError) throw new Error(defError.message);

  for (const row of (defs || []) as FieldDef[]) {
    if (!byKey.has(row.key)) byKey.set(row.key, { ...row, section_id: "", id: row.key });
  }

  return orderStatusFirst([...byKey.values()]);
}

function orderStatusFirst(defs: FieldDef[]): FieldDef[] {
  const ordered: FieldDef[] = [];
  const seen = new Set<string>();
  for (const f of STATUS_FIELD_DEFS) {
    const row = defs.find((d) => d.key === f.key);
    if (row) {
      ordered.push(row);
      seen.add(f.key);
    }
  }
  for (const row of defs) {
    if (seen.has(row.key)) continue;
    ordered.push(row);
    seen.add(row.key);
  }
  return ordered;
}


export interface SiteCategoryFieldInput {
  categorySlug: string;
  key: string;
  label: string;
  fieldType: FieldType;
  showOnOverview?: boolean;
  required?: boolean;
  options?: { choices?: string[]; aliases?: string[] } | null;
}

/** Upsert the shared field template and add the field_def to every
 * enabled section in this site category — same outcome as using
 * "+ Add existing/Create new field" on a trip card, visible everywhere. */
export async function addFieldToSiteCategory(input: SiteCategoryFieldInput): Promise<FieldDef> {
  const supabase = supabaseServiceRole();
  const key = input.key.trim();
  const label = input.label.trim();
  if (!key || !label) throw new Error("key and label are required");

  // Template capture — no specific trip; use empty trip id only for the
  // created_from column when inserting (nullable on update path).
  const { data: anyTrip } = await supabase.from("trips").select("id").limit(1).maybeSingle();
  await upsertCustomFieldTemplate(supabase, anyTrip?.id || "", {
    key,
    label,
    field_type: input.fieldType,
    show_on_overview: input.showOnOverview === true,
    required: input.required === true,
    options: input.options || undefined,
  });

  const { data: navGroups, error: ngError } = await supabase
    .from("nav_groups")
    .select("id")
    .eq("slug", input.categorySlug);
  if (ngError) throw new Error(ngError.message);
  const navIds = (navGroups || []).map((g) => g.id);

  if (navIds.length > 0) {
    const { data: sections, error: secError } = await supabase
      .from("sections")
      .select("id")
      .in("nav_group_id", navIds)
      .eq("enabled", true);
    if (secError) throw new Error(secError.message);

    for (const section of sections || []) {
      const { data: existing } = await supabase
        .from("field_defs")
        .select("id")
        .eq("section_id", section.id)
        .eq("key", key)
        .maybeSingle();
      if (existing) continue;

      const { data: maxRow } = await supabase
        .from("field_defs")
        .select("sort_order")
        .eq("section_id", section.id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextSort = (maxRow?.sort_order ?? -1) + 1;

      await supabase.from("field_defs").insert({
        section_id: section.id,
        key,
        label,
        field_type: input.fieldType,
        storage: "jsonb",
        show_on_overview: input.showOnOverview === true,
        required: input.required === true,
        options: input.options || null,
        sort_order: nextSort,
      });
    }
  }

  return {
    id: key,
    section_id: "",
    key,
    label,
    field_type: input.fieldType,
    storage: "jsonb",
    core_column: null,
    options: input.options || null,
    sort_order: 0,
    show_on_overview: input.showOnOverview === true,
    required: input.required === true,
  };
}

export interface SiteCategoryFieldRow {
  key: string;
  label: string;
  fieldType: FieldType;
  showOnOverview?: boolean;
  required?: boolean;
  options?: { choices?: string[]; aliases?: string[] } | null;
}

/** Replace the shared type/fields schema for a site category: upsert
 * each row onto templates + every enabled section, drop keys that left
 * the editor. Used by Categories / Future Interests / Places Manage. */
export async function syncFieldsForSiteCategory(
  categorySlug: string,
  fields: SiteCategoryFieldRow[]
): Promise<FieldDef[]> {
  const supabase = supabaseServiceRole();
  const nextKeys = new Set(fields.map((f) => f.key.trim()).filter(Boolean));
  const previous = await getFieldDefsForSiteCategory(categorySlug);
  const previousKeys = previous.map((f) => f.key);
  const sectionIds = await sectionIdsForCategory(categorySlug);

  for (const field of fields) {
    const key = field.key.trim();
    const label = field.label.trim();
    if (!key || !label) continue;
    await addFieldToSiteCategory({
      categorySlug,
      key,
      label,
      fieldType: field.fieldType,
      showOnOverview: field.showOnOverview === true,
      required: field.required === true,
      options: field.options || null,
    });

    // Update label/type/options on existing defs (addField skips when present).
    if (sectionIds.length > 0) {
      await supabase
        .from("field_defs")
        .update({
          label,
          field_type: field.fieldType,
          show_on_overview: field.showOnOverview === true,
          required: field.required === true,
          options: field.options || null,
        })
        .in("section_id", sectionIds)
        .eq("key", key);
    }
  }

  for (const key of previousKeys) {
    if (nextKeys.has(key)) continue;
    // Closed / Moved / New address stay — type tags may be removed.
    if (isProtectedStatusKey(key)) continue;
    if (sectionIds.length === 0) continue;
    await supabase.from("field_defs").delete().in("section_id", sectionIds).eq("key", key);
  }

  return getFieldDefsForSiteCategory(categorySlug);
}
