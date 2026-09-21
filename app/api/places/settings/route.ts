import { NextResponse, type NextRequest } from "next/server";
import { requireSiteEditorAccess } from "@/lib/auth";
import { isSiteCategorySlug, type SiteCategorySlug } from "@/lib/siteCategories";
import { getPlacesSurfaceSettings, setPlacesSurfaceSettings } from "@/lib/siteSurfaceSettings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const { error: authError } = await requireSiteEditorAccess();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    const settings = await getPlacesSurfaceSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { error: authError } = await requireSiteEditorAccess();
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = Array.isArray(body.enabledCategories) ? body.enabledCategories : [];
  const enabledCategories = raw.filter(
    (s): s is SiteCategorySlug => typeof s === "string" && isSiteCategorySlug(s)
  );

  try {
    const settings = await setPlacesSurfaceSettings({ enabledCategories });
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
