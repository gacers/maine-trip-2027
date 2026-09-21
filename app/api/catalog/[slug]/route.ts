import { NextResponse } from "next/server";
import { requireSiteEditorAccess } from "@/lib/auth";
import { getCatalogForCategory } from "@/lib/catalog";
import { isSiteCategorySlug } from "@/lib/siteCategories";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSiteCategorySlug(slug)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 404 });
  }

  const { error: authError } = await requireSiteEditorAccess();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    const items = await getCatalogForCategory(slug);
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
