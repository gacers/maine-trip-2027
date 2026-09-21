import { NextResponse, type NextRequest } from "next/server";
import { requireSiteEditorAccess } from "@/lib/auth";
import { isSiteCategorySlug } from "@/lib/siteCategories";
import { syncFieldsForSiteCategory, type SiteCategoryFieldRow } from "@/lib/siteCategoryFields";
import type { FieldType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Sync shared type/fields for a site category onto every trip section
// in that category — Categories / Future Interests / Places Manage.
export async function PUT(request: NextRequest) {
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

  const rawFields = Array.isArray(body.fields) ? body.fields : [];
  const fields: SiteCategoryFieldRow[] = [];
  for (const row of rawFields) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const key = typeof r.key === "string" ? r.key.trim() : "";
    const label = typeof r.label === "string" ? r.label.trim() : "";
    const fieldType = r.fieldType as FieldType | undefined;
    if (!key || !label || !fieldType) continue;
    fields.push({
      key,
      label,
      fieldType,
      showOnOverview: r.showOnOverview === true,
      required: r.required === true,
      options: (r.options as { choices?: string[]; aliases?: string[] } | null) || null,
    });
  }

  try {
    const next = await syncFieldsForSiteCategory(categorySlug, fields);
    return NextResponse.json({ fields: next });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
