import { NextResponse, type NextRequest } from "next/server";
import { requireSiteEditorAccess } from "@/lib/auth";
import { createFutureInterestItem, listFutureInterest } from "@/lib/futureInterest";
import { resolveEntryCountry } from "@/lib/resolveEntryCountry";
import { isSiteCategorySlug } from "@/lib/siteCategories";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { error: authError } = await requireSiteEditorAccess();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  const category = request.nextUrl.searchParams.get("category") || "";
  if (!isSiteCategorySlug(category)) {
    return NextResponse.json({ error: "category query param required" }, { status: 400 });
  }
  const includeVisited = request.nextUrl.searchParams.get("includeVisited") === "1";

  try {
    const items = await listFutureInterest(category, { includeVisited });
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { error: authError, supabase } = await requireSiteEditorAccess();
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
    const lat = typeof body.lat === "number" ? body.lat : body.lat === null ? null : undefined;
    const lng = typeof body.lng === "number" ? body.lng : body.lng === null ? null : undefined;
    const country = await resolveEntryCountry(supabase!, lat, lng, null);

    const item = await createFutureInterestItem({
      categorySlug,
      title: typeof body.title === "string" ? body.title : null,
      url: typeof body.url === "string" ? body.url : null,
      posterImage: typeof body.posterImage === "string" ? body.posterImage : null,
      description: typeof body.description === "string" ? body.description : null,
      lat,
      lng,
      country,
      data: body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : {},
      sourceEntryId: typeof body.sourceEntryId === "string" ? body.sourceEntryId : null,
    });
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
