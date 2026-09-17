import type { SupabaseClient } from "@supabase/supabase-js";
import type { FieldType } from "@/lib/types";

export interface CustomFieldTemplate {
  id: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  show_on_overview: boolean;
  required: boolean;
  options: { choices?: string[]; aliases?: string[] } | null;
  created_from_trip_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CapturedField {
  key: string;
  label: string;
  field_type: FieldType;
  show_on_overview: boolean;
  required: boolean;
  options?: { choices?: string[]; aliases?: string[] } | null;
}

// Called right after a section's field_defs are written (create or
// edit — see the sections POST/PATCH routes), once per field. Every
// named field becomes reusable on any other section/trip automatically,
// no separate "save as template" step — the same idea as
// upsertCustomSectionTemplate, just one field at a time rather than a
// whole nav group's worth. Unlike sections' merge-by-slug (which
// accumulates an array), a field template is just its own latest
// definition — re-defining "phone" anywhere simply overwrites this row
// with whatever it looks like now.
export async function upsertCustomFieldTemplate(
  supabase: SupabaseClient,
  tripId: string,
  field: CapturedField
): Promise<void> {
  const fieldKey = field.key?.trim();
  const label = field.label?.trim();
  if (!fieldKey || !label) return;

  const { data: existing } = await supabase
    .from("custom_field_templates")
    .select("id")
    .eq("field_key", fieldKey)
    .maybeSingle();

  const row = {
    field_key: fieldKey,
    label,
    field_type: field.field_type,
    show_on_overview: !!field.show_on_overview,
    required: !!field.required,
    options: field.options || null,
  };

  if (!existing) {
    await supabase.from("custom_field_templates").insert({ ...row, created_from_trip_id: tripId });
    return;
  }

  await supabase
    .from("custom_field_templates")
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq("id", existing.id);
}
