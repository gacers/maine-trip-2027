import { NextResponse, type NextRequest } from "next/server";
import { requireSiteEditorAccess } from "@/lib/auth";
import { isSiteCategorySlug } from "@/lib/siteCategories";
import { addFieldToSiteCategory } from "@/lib/siteCategoryFields";
import { supabaseServer } from "@/lib/supabaseServer";
import type { FieldType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Every named field (key+label+type) ever defined on any section,
// across every trip — see lib/customFieldTemplates.ts for how these
// get captured. Not trip- or section-scoped: a field defined once is
// offered everywhere.
export async function GET() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("custom_field_templates")
    .select("id, field_key, label, field_type, show_on_overview, required, options")
    .order("label", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data || [] });
}

// Create/upsert a shared field template and add it to every section in
// a site category — used by Future Interests's same AddFieldSelect so a
// type created there shows up on trip cards too.
export async function POST(request: NextRequest) {
  const { error: authError } = await requireSiteEditorAccess();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const categorySlug = typeof body.categorySlug === "string" ? body.categorySlug : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(categorySlug)) {
    return NextResponse.json({ error: "categorySlug is required" }, { status: 400 });
  }
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const fieldType = body.fieldType as FieldType | undefined;
  if (!key || !label || !fieldType) {
    return NextResponse.json({ error: "key, label, and fieldType are required" }, { status: 400 });
  }

  try {
    const field = await addFieldToSiteCategory({
      categorySlug,
      key,
      label,
      fieldType,
      showOnOverview: body.showOnOverview === true,
      required: body.required === true,
      options: (body.options as { choices?: string[]; aliases?: string[] } | null) || null,
    });
    return NextResponse.json({ field });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
