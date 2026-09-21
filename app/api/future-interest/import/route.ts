import { NextResponse, type NextRequest } from "next/server";
import { requireSiteEditorAccess } from "@/lib/auth";
import { importUnvisitedOptions } from "@/lib/futureInterest";
import { isSiteCategorySlug } from "@/lib/siteCategories";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Pull unvisited Options-tier places from accessible trips into Future
// Interest for one category (skips duplicates by source entry / URL).
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
  if (!isSiteCategorySlug(categorySlug)) {
    return NextResponse.json({ error: "categorySlug is required" }, { status: 400 });
  }

  try {
    const result = await importUnvisitedOptions(categorySlug);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
