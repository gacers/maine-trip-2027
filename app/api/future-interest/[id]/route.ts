import { NextResponse, type NextRequest } from "next/server";
import { requireSiteEditorAccess } from "@/lib/auth";
import { deleteFutureInterestItem, updateFutureInterestItem } from "@/lib/futureInterest";
import { isSiteCategorySlug } from "@/lib/siteCategories";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error: authError } = await requireSiteEditorAccess();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ("title" in body) patch.title = body.title ?? null;
  if ("url" in body) patch.url = body.url ?? null;
  if ("posterImage" in body) patch.poster_image = body.posterImage ?? null;
  if ("description" in body) patch.description = body.description ?? null;
  if ("lat" in body) patch.lat = body.lat === "" || body.lat == null ? null : Number(body.lat);
  if ("lng" in body) patch.lng = body.lng === "" || body.lng == null ? null : Number(body.lng);
  if ("country" in body) patch.country = body.country || null;
  if ("visited" in body) patch.visited = !!body.visited;
  if ("data" in body && body.data && typeof body.data === "object") patch.data = body.data;
  if (typeof body.categorySlug === "string" && isSiteCategorySlug(body.categorySlug)) {
    patch.category_slug = body.categorySlug;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const item = await updateFutureInterestItem(id, patch);
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error: authError } = await requireSiteEditorAccess();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    await deleteFutureInterestItem(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
